import os
import chainlit as cl
import asyncio
from dotenv import load_dotenv

from sqlalchemy import create_engine

from langchain_community.utilities import SQLDatabase
from langchain_google_genai import ChatGoogleGenerativeAI 
from langchain_community.chat_models import ChatDeepInfra 
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.agent_toolkits.sql.base import create_sql_agent
from langchain_core.prompts import PromptTemplate
from langchain.chains import LLMChain

load_dotenv()

GREETINGS = ["hello", "hi", "xin chào", "chào bạn", "chào shop", "cảm ơn"]

DB_KEYWORDS = [
    "sản phẩm", "giá", "bao nhiêu tiền", "còn hàng", "tồn kho", "thông tin",
    "máy lạnh", "máy giặt", "tivi", "điện thoại", "laptop", "tablet", "máy tính bảng",
    "tủ lạnh", "nồi cơm", "nồi chiên", "bếp điện", "nhà cung cấp", "danh mục",
    "samsung", "lg", "sony", "casper", "xiaomi", "apple", "panasonic", "aqua",
    "đánh giá", "nhận xét", "feedback", "bảo hành"
]


general_template = """Bạn là một trợ lý ảo chuyên nghiệp của cửa hàng điện máy TechTwo. 
Nhiệm vụ của bạn là trả lời các câu hỏi chung của khách hàng một cách tự nhiên và ngắn gọn.
Ví dụ:
- Hỏi: Bạn là ai? Trả lời: Tôi là trợ lý ảo của TechTwo, luôn sẵn sàng giúp đỡ bạn.
- Hỏi: Cửa hàng ở đâu? Trả lời: Hiện tại TechTwo chỉ bán hàng online qua website bạn nhé.
- Hỏi: Chính sách bảo hành? Trả lời: Các sản phẩm đều được bảo hành chính hãng theo chính sách của nhà sản xuất. Bạn có thể cho tôi biết sản phẩm bạn quan tâm để tôi cung cấp thông tin chi tiết hơn.

Bây giờ, hãy trả lời câu hỏi sau:
Câu hỏi: {question}
Trả lời:"""
general_prompt = PromptTemplate.from_template(general_template)

sql_agent_prefix = """Bạn là một trợ lý AI chuyên gia về cơ sở dữ liệu MySQL của cửa hàng điện máy TechTwo.
Nhiệm vụ của bạn là trả lời các câu hỏi của người dùng bằng cách chuyển đổi câu hỏi đó thành các câu lệnh SQL chính xác và hiệu quả.
Hãy luôn trả lời bằng tiếng Việt.

** NGUYÊN TẮC HÀNH ĐỘNG:**

1.  **LUÔN LUÔN SUY NGHĨ TRƯỚC KHI HÀNH ĐỘNG (Thought Process):**
    * **Phân tích yêu cầu:** "Người dùng thực sự muốn biết điều gì? Các từ khóa chính là gì?"
    * **Xác định chiến lược:** "Để trả lời câu hỏi này, mình cần thông tin từ những bảng nào? Mình sẽ cần kết nối (JOIN) chúng như thế nào? Những cột nào chứa thông tin mình cần?"
    * **Dự đoán kết quả:** "Câu lệnh SQL mình sắp tạo sẽ trả về dữ liệu gì?"

2.  **HIỂU SÂU VỀ DỮ LIỆU (Data Schema Interpretation):**
    * **Ưu tiên các cột mô tả:** Khi người dùng hỏi chung chung về "thông tin", "chi tiết", "mô tả", "tính năng", "thông số", hãy ưu tiên tìm và truy vấn các cột có tên chứa `description`, `details`, `content`, `specification`.
    * **Nhận biết các thực thể chính:**
        * `products`: Chứa tên và mô tả chung của sản phẩm.
        * `categories`: Dùng để lọc sản phẩm theo loại (ví dụ: 'Tivi', 'Máy giặt').
        * `product_variants`: Cực kỳ quan trọng, chứa **giá (`price`)** và **số lượng tồn kho (`quantity`)** cho từng phiên bản sản phẩm. Luôn JOIN với bảng này khi người dùng hỏi về giá hoặc tình trạng còn hàng.
        * `suppliers`: Chứa thông tin về nhà cung cấp/hãng sản xuất.
        * `feedbacks`: Chứa đánh giá, nhận xét của khách hàng.

3.  **KỸ THUẬT TRUY VẤN LINH HOẠT (Flexible Querying):**
    * **Sử dụng `LIKE`:** Đối với các truy vấn dạng văn bản (tên sản phẩm, tên danh mục), hãy dùng `LIKE '%từ khóa%'` để tăng khả năng tìm thấy kết quả, phòng trường hợp người dùng không gõ chính xác.
    * **Sử dụng `JOIN` một cách thông minh:** Hiểu rõ mối quan hệ giữa các bảng để kết nối chúng lại khi một câu hỏi đòi hỏi thông tin từ nhiều nơi.
    * **Tổng hợp dữ liệu:** Khi được hỏi các câu liên quan đến số lượng ("có bao nhiêu loại tivi?"), hãy cân nhắc dùng `COUNT()`. Khi được hỏi về giá cao nhất/thấp nhất, hãy dùng `MAX()`/`MIN()`.

4.  **TRÌNH BÀY KẾT QUẢ THÂN THIỆN (User-Friendly Response):**
    * **Không trả về dữ liệu thô:** Sau khi có kết quả từ SQL, đừng chỉ liệt kê chúng. Hãy phân tích và tổng hợp thông tin thành một câu trả lời hoàn chỉnh, ngắn gọn, tự nhiên, dễ hiểu bằng tiếng Việt để cho người dùng dễ dàng nắm bắt được nhất.
    * **Xử lý kết quả rỗng:** Nếu truy vấn không trả về kết quả nào, đừng im lặng. Hãy lịch sự thông báo cho người dùng: "Rất tiếc, tôi không tìm thấy thông tin nào phù hợp với yêu cầu của bạn."

5.  **TUYỆT ĐỐI BẢO MẬT (Security First):**
    * Chỉ được phép thực hiện các câu lệnh `SELECT`. Cấm tuyệt đối các hành vi thay đổi dữ liệu như `INSERT`, `UPDATE`, `DELETE`.

6.  **QUAN TRỌNG NHẤT - ĐỊNH DẠNG ĐẦU RA (Output Format):**
    * Bạn phải trả lời theo định dạng gồm một chuỗi suy nghĩ và hành động.
    * Khi bạn đã có câu trả lời cuối cùng cho người dùng, bạn **BẮT BUỘC** phải bắt đầu bằng `Final Answer:`.
    * **Ví dụ khi có kết quả:**
        ```
        Thought: Người dùng muốn biết giá của iPhone 15. Tôi cần truy vấn bảng product_variants.
        Action: sql_db_query
        Action Input: SELECT price FROM product_variants WHERE product_name LIKE '%iPhone 15%'
        Observation: [(30000000)]
        Thought: Tôi đã có giá. Bây giờ tôi sẽ trả lời người dùng.
        Final Answer: Dạ, giá của sản phẩm iPhone 15 là 30,000,000đ ạ.
        ```
    * **Ví dụ khi kết quả rỗng:**
        ```
        Thought: Người dùng hỏi về một sản phẩm không có trong CSDL. Truy vấn trả về kết quả rỗng.
        Observation: []
        Thought: Tôi không tìm thấy thông tin. Tôi cần thông báo cho người dùng.
        Final Answer: Rất tiếc, tôi không tìm thấy thông tin nào phù hợp với yêu cầu của bạn.
        ```    
"""
#Tạo 1 luồng riêng để chạy với deepinfra api key/ Google api key thì k cần
def run_agent_in_thread(agent, user_input):
    return agent.invoke({"input": user_input})

@cl.on_chat_start
async def start():
    db_user = os.getenv('DATABASE_USER')
    db_password = os.getenv('DATABASE_PASSWORD')
    db_host = os.getenv('DATABASE_HOST')
    db_name = os.getenv('DATABASE')
    google_api_key = os.getenv('GOOGLE_API_KEY')
    deepinfra_api_token = os.getenv('DEEPINFRA_API_TOKEN')


    if not google_api_key:
        await cl.Message(content="Lỗi: Không tìm thấy GOOGLE_API_KEY trong file .env.").send()
        return

    db_uri = f'mysql+mysqlconnector://{db_user}:{db_password}@{db_host}/{db_name}'

    try:
        include_tables = [
            "products", 
            "categories", 
            "product_variants", 
            "suppliers", 
            "product_details",
            "discounts",
            "feedbacks",
            "paying_methods"
        ]
        
        db = SQLDatabase(
            create_engine(db_uri),
            include_tables=include_tables,
            sample_rows_in_table_info=3
        )
        
        #Khi sử dụng GOOGL_API_KEY
        # llm = ChatGoogleGenerativeAI(
        #     model="gemini-1.5-flash-latest",
        #     temperature=0,
        #     api_key=google_api_key
        # )

        llm = ChatDeepInfra(
            model_id="meta-llama/Meta-Llama-3-70B-Instruct",
            model_kwargs={"temperature": 0.0, "max_new_tokens": 2048}
        )

        sql_toolkit = SQLDatabaseToolkit(db=db, llm=llm)
        sql_agent = create_sql_agent(
            llm=llm,
            toolkit=sql_toolkit,
            verbose=True,
            handle_parsing_errors=True,
            prefix=sql_agent_prefix
        )
        cl.user_session.set("sql_agent", sql_agent)

        general_chain = LLMChain(llm=llm, prompt=general_prompt, verbose=True)
        cl.user_session.set("general_chain", general_chain)

        await cl.Message(content="Xin chào! Tôi là trợ lý ảo của TechTwo. Tôi có thể giúp gì cho bạn?").send()

    except Exception as e:
        await cl.Message(content=f"Đã xảy ra lỗi khi khởi tạo: {str(e)}").send()


@cl.on_message
async def on_message(message: cl.Message):
    sql_agent = cl.user_session.get("sql_agent")
    general_chain = cl.user_session.get("general_chain")   

    if not sql_agent or not general_chain:
        await cl.Message(content="Lỗi: Chuỗi xử lý chưa được khởi tạo. Vui lòng làm mới trang (F5).").send()
        return

    user_message = message.content.lower()
    
    if user_message in GREETINGS:
        await cl.Message(content="Xin chào! Tôi có thể giúp gì cho bạn hôm nay?").send()
        return

    if any(keyword in user_message for keyword in DB_KEYWORDS):
        msg = cl.Message(content="Ok, vui lòng đợi trong giây lát, tôi sẽ tìm kiếm thông tin phù hợp cho bạn...")
        await msg.send()
        try:
            # cb = cl.AsyncLangchainCallbackHandler(stream_final_answer=True)
            # response = await sql_agent.ainvoke(
            #     {"input": message.content},
            #     callbacks=[cb]
            # )
            response = await asyncio.to_thread(
                run_agent_in_thread, sql_agent, message.content
            )
            answer = response.get("output", "Rất tiếc, tôi không thể tìm thấy câu trả lời.")
            msg.content = answer
            await msg.update()
        except Exception as e:
            await cl.Message(content=f"Đã xảy ra lỗi: {str(e)}").send()
        return
    
    else:
        msg = cl.Message(content="")
        await msg.send()
        
        cb = cl.AsyncLangchainCallbackHandler(stream_final_answer=True)
        response = await general_chain.acall(
            {"question": message.content},
            callbacks=[cb]
        )
        answer = response.get("text", "Rất tiếc, tôi không thể xử lý yêu cầu này.")
        msg.content = answer
        await msg.update()