from tqdm import tqdm
from opt.metrics import Metric
from opt.request import Request
from opt.utils import extract_item_list
import concurrent.futures

class Eval():
    def __init__(self, config, data, text_table):
        self.conf = config
        self.requset = Request(config)
        self.data = data
        self.text_table = text_table
        self.error_list = []
        self.target_rank_list = []
    
    def run(self, prompt):
        self.normal_eval(prompt)
        metric = Metric(self.target_rank_list, self.conf)
        result = metric.run()

        return result, self.target_rank_list, self.error_list
    
    def record_error(self, data, response):
        tmp = {}
        tmp['response'] = response
        tmp['target'] = data['target']
        tmp['input'] = data['input']
        tmp['target_index'] = data['target_index']
        
        return tmp

    def normal_eval(self, prompt):
        def process_data(data):
            for i in range(3):  
                response = self.requset.request(user=data['input'], system=prompt)
                result_list = extract_item_list(response, data['target'])
                if not result_list:
                    continue
                elif 0 < int(result_list[-1]) < self.conf['candidate_size'] + 1:
                    return int(result_list[-1]), response
            return self.conf['candidate_size'] + 1, response

        with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
            futures = {executor.submit(process_data, data): data for data in self.data}
            for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures)):
                data = futures[future]
                try:
                    rank, response = future.result()
                    self.target_rank_list.append(rank)
                    self.text_table.add_data(data['input'], data['target'], response)
                    if rank >= self.conf['candidate_size'] + 1:
                        error = self.record_error(data, response)
                        self.error_list.append(error)
                except Exception as e:
                    print(f"Error processing data: {e}")
                    self.target_rank_list.append(self.conf['candidate_size'] + 1)
                    error = self.record_error(data, "Error in processing")
                    self.error_list.append(error)