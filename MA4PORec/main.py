import json
import os
import random
from dotenv import load_dotenv
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
from agno.models.openai.like import OpenAILike
from agents import EvalAgent, DetectErrrorAgent, InferReasonAgent, RefinePromptAgent, AugmentAgent, SelectionAgent
from opt.utils import RetryModel, ndcg, extract_item_list

load_dotenv()
DEEPINFRA_API_KEY = os.getenv('DEEPINFRA_API_KEY')

original_model = OpenAILike(
    id="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    api_key=DEEPINFRA_API_KEY,
    base_url="https://api.deepinfra.com/v1/openai",
)

llm_model = RetryModel(original_model, max_retries=1000, base_delay=1)

data_path = "./ALL_dataset/ml-1m/expand/"
train_file = f"{data_path}train_50_100cand.json"
val_file = f"{data_path}valid_100cand.json"

with open(train_file, 'r') as f:
    train_data = json.load(f)
with open(val_file, 'r') as f:
    val_data = json.load(f)

config = {
    'search_depth': 1,
    'beam_width': 5,
    'batch_size': 16,
    # 'batch_size': 8,
    'num_feedbacks': 2,
    'error_size': 16,
    # 'addition_sample': 2,
    'addition_sample': 3,
    'time_steps': 16,
    'explore_param': 2,
    'sample_num': 32,
}

initial_prompt = (
    """
    Based on the user's current session interactions, you need to answer the following subtasks step by step:
    1. Discover combinations of items within the session, where the number of combinations can be one or more.
    2. Based on the items within each combination, infer the user's interactive intent within each combination.
    3. Select the intent from the inferred ones that best represents the user's current preferences.
    4. Based on the selected intent, please rerank the 20 items in the candidate set according to the possibility of potential user interactions and show me your ranking results with item index.
    Note that the order of all items in the candidate set must be given, and the items for ranking must be within the candidate set.
    """
)

eval_agent = EvalAgent(model=llm_model)
detect_error_agent = DetectErrrorAgent()
infer_reason_agent = InferReasonAgent(model=llm_model)
refine_agent = RefinePromptAgent(model=llm_model)
augment_agent = AugmentAgent(model=llm_model)
selection_agent = SelectionAgent(model=llm_model)

beam = [initial_prompt]
print("Processing...")

def process_error_feedback(prompt, error):
    reasons = infer_reason_agent.infer(error['input'], prompt, config['num_feedbacks'])
    refined_prompt = refine_agent.refine(prompt, error['input'], reasons)
    augmented_prompts = augment_agent.augment(refined_prompt, config['addition_sample'])
    return [refined_prompt] + augmented_prompts

for depth in tqdm(range(config['search_depth'])):
    candidate_prompts = []
    for prompt in beam:
        batch = random.sample(train_data, min(config['batch_size'], len(train_data)))
        error_cases = []
        with ThreadPoolExecutor(max_workers=100) as executor:
            responses = list(executor.map(lambda d: eval_agent.evaluate(prompt, d), batch))
        for data, response in zip(batch, responses):
            if detect_error_agent.detect_error(response, data['target']):
                error_cases.append({'input': data['input'], 'output': response})
        error_cases = [e for e in error_cases if e.get('input') is not None]

        try:
            errors_group = random.sample(error_cases, config['error_size'])
        except ValueError:
            errors_group = error_cases

        with ThreadPoolExecutor(max_workers=10) as executor:
            processed_results = list(executor.map(lambda err: process_error_feedback(prompt, err), errors_group))
        # processed_results = [process_error_feedback(prompt, err) for err in errors_group]
        
        for prompts in processed_results:
            candidate_prompts.extend(prompts)

    beam = selection_agent.select(candidate_prompts, train_data, config['time_steps'], config['explore_param'], config['sample_num'], config['beam_width'])


def compute_data_reward(prompt, d, eval_agent):
    prediction = eval_agent.evaluate(prompt, d)
    result_list = extract_item_list(prediction, d['target'])
    if result_list:
        target_idx = int(result_list[-1])
        return ndcg(target_idx)
    return 0

def compute_reward(prompt, data):
    with ThreadPoolExecutor(max_workers=100) as executor:
        rewards = list(executor.map(lambda d: compute_data_reward(prompt, d, eval_agent), data))
    total_reward = sum(rewards)
    return total_reward / len(data)

best_prompt = max(beam, key=lambda p: compute_reward(p, val_data))
print("Best prompt:\n", best_prompt)