import random
import time
import numpy as np
import re
import json

class RetryModel:
    def __init__(self, model, max_retries=100, base_delay=1):
        self.model = model
        self.max_retries = max_retries  
        self.base_delay = base_delay    

    def response(self, messages):
        for attempt in range(self.max_retries):
            try:
                return self.model.response(messages)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                print(f"Error: {e}. Retrying in {round(delay, 2)} seconds.")
                time.sleep(delay)
        raise Exception("Max retries exceeded")

    def __getattr__(self, name):
        return getattr(self.model, name)

def extract_item_json_list(response,target):
    try:
        if isinstance(response, str):
            data = json.loads(response)
        else:
            data = response
        target = target.replace("&amp;", "&").replace("&reg;","®")   
        for key,value in data.items():
            try:
                if value.strip().lower().replace("&amp;", "&").replace("&reg;", "®") == target.strip().lower():
                    return [int(key)]
            except AttributeError:
                continue
        return []
    except json.JSONDecodeError:
        return []

def extract_wrapped_json(response):
    pattern = r'<START>(.*?)<END>'
    match = re.search(pattern, response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            return None
    return None

def extract_edit_prompt(response):
    pattern = r'<START>\s*(.*?)\s*<END>'
    result_list = re.findall(pattern, response, re.DOTALL)
    if len(result_list) == 0:
        pattern = r'<START>(.*?)<END>'
        result_list = re.findall(pattern, response, re.DOTALL)
    return result_list 

def ndcg(target_index, max_rank=20):
    if target_index <= 0 or target_index > max_rank:
        return 0.0
    return 1.0 / np.log2(target_index + 1)

def extract_item_list(response, target):
    try:
        response = response.replace(" ", " ")
        target = target.replace(" ", " ").replace("&amp;", "&").replace("&reg;","®")
        index = response.rfind(target)
        if index != -1:
            preceding_text = response[:index].strip()
            numbers = re.findall(r'\d+', preceding_text)
            if numbers:
                result_list = numbers
            else:
                result_list = []
        else:
            result_list = []
    except:
        result_list = []
    return result_list