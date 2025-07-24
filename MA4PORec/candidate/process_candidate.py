import json
from tqdm import tqdm
import re
import torch
import random
from transformers import AutoTokenizer, AutoModelForSequenceClassification

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

with open("./train_50_100cand.json", 'r') as json_file:
    train_data = json.load(json_file)

with open("./valid_100cand.json", 'r') as json_file:
    valid_data = json.load(json_file)

with open("./test_932s_100cand.json", 'r') as json_file:
    test_data = json.load(json_file)

# model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"
model_name = "cross-encoder/ms-marco-MiniLM-L-12-v2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name).to(device)
print(device)

def extract_target_index(candidate_set, target):
    pattern = re.compile(r'(\d+)\."([^"]+)"')
    for candidate_str in candidate_set:
        match = pattern.match(candidate_str)
        if match:
            idx, candidate = match.groups()
            if target == candidate:
                return int(idx)
    return 0

def format_candidate_set(candidate_set):
    formatted_set = []
    for idx, item in enumerate(candidate_set,start=1):
        formatted_item = f'{idx}."{item}"'
        formatted_set.append(formatted_item)
    return formatted_set

def main(sample_data,output_filename):
    results = []

    for data in tqdm(sample_data):
        candidate_items = re.findall(r'\d+\."([^"]+)"', data['input'].split('\nCandidate set: ')[1])
        current_session_interactions = re.findall(r'\d+\."([^"]+)"', data['input'].split('\nCandidate set: ')[0].split('Current session interactions: ')[1])
        hist_items = data['input'].split('\nCandidate set: ')[0].split('Current session interactions: ')[1]

        scores = []
        for candidate in candidate_items:
            pairs = [(interaction, candidate) for interaction in current_session_interactions]
            inputs = tokenizer(pairs, truncation=True, padding=True, return_tensors="pt")

            inputs = {key: val.to(device) for key, val in inputs.items()}

            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits.squeeze(-1)

            average_score = logits.mean().item()
            scores.append((candidate, average_score))

        top_candidates = [item for item, score in sorted(scores, key=lambda x: x[1], reverse=True)[:20]]
        target_item = data['target']

        if target_item not in top_candidates:
            if len(top_candidates) == 20:
                del_idx = random.randint(0, 19)
                top_candidates.pop(del_idx)
            top_candidates.append(target_item)
        candidate_set = format_candidate_set(top_candidates)
        target_index = extract_target_index(candidate_set, target_item)

        results.append({
            "target": target_item,
            "target_index": target_index,
            "input": f"Current session interactions: {hist_items}\nCandidate Set: [{', '.join(candidate_set)}]"
        })

    output_path = f"/content/{output_filename}"
    with open(output_path, 'w') as outfile:
        json.dump(results, outfile, indent=2)

main(train_data, "train_50s_data_processed.json")
main(valid_data, "valid_data_processed.json")
main(test_data, "test_data_processed.json")
print("Processing candidate completed!")