import os
import wandb
from opt.eval import Eval
from opt.config import init_config
import json

if __name__ == '__main__':
    test_prompt = "Based on the user's current session interactions, you need to answer the following subtasks step by step:\n"\
                    "1. Discover combinations of items within the session, where the number of combinations can be one or more. Consider the order and timing of the interactions to identify meaningful patterns.\n"\
                    "2. For each combination, infer the user's interactive intent by analyzing the attributes and genres of the items. For example, if the combination consists of multiple comedy movies, infer that the user is in the mood for comedies. If the combination includes items from different genres, consider the common themes or elements among them.\n"\
                    "3. Select the intent from the inferred ones that best represents the user's current preferences. Consider the frequency, recency, and diversity of the interactions to determine the most relevant intent.\n"\
                    "4. Based on the selected intent, rerank the 20 items in the candidate set according to the possibility of potential user interactions. Use the inferred intent to identify relevant attributes and genres in the candidate set items. Assign higher rankings to items that match the inferred intent and have similar attributes or genres to the items in the user's session interactions.\n"\
                    "Note that the order of all items in the candidate set must be given, and the items for ranking must be within the candidate set. The candidate set consists of movie titles, and the attributes to consider include genres (e.g., comedy, drama, action), release years, directors, and actors.\n"\
                    "Provide your ranking results with item indices, and ensure that the ranking is based on the inferred user intent and the attributes of the items in the candidate set.\n"

    conf = init_config()
    data_path = "./ALL_dataset/ml-1m/expand/"
    test_file = f"{data_path}test_seed_42_100cand.json"

    with open(test_file, 'r', encoding='utf-8') as f:
        test_data = json.load(f)

    key = conf['deepinfra_api_key']
    if conf['use_wandb']:
        wandb.login(key=conf['wandb_api_key'])
        conf.pop('deepinfra_api_key')
        run = wandb.init(
            project=f"PO4ISR_{conf['dataset']}_test",
            config=conf,
            name=f"seed_{conf['seed']}",
        )
        text_table = wandb.Table(columns=["Input", "Target", "Response"])
    else:
        text_table = None
    conf['deepinfra_api_key'] = key

    eval_model = Eval(conf, test_data, text_table)
    results, target_rank_list, error_list = eval_model.run(test_prompt)

    result_save_path = f"./res/metric_res/{conf['dataset']}/"
    if not os.path.exists(result_save_path):
        os.makedirs(result_save_path)
    results.to_csv(f"{result_save_path}ma4_3.1-70B-Ins_100cand.csv", index=False)
    
    if conf['use_wandb']:
        run.log({"texts": text_table})