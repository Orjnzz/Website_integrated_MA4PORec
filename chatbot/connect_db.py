import os
import chainlit as cl
import asyncio
import re
import json
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

IMAGE_BASE_PATH = "./src/public/imgs/product_image"

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
    * **QUAN TRỌNG**: Khi truy vấn về sản phẩm, LUÔN bao gồm cột `product_avt_img` để có thể hiển thị hình ảnh.

4.  **TRÌNH BÀY KẾT QUẢ THÂN THIỆN (User-Friendly Response):**
    **MẪU TRÌNH BÀY CHUẨN:**
    ```
    🛍️ **Các sản phẩm máy lạnh hiện có tại TechTwo:**

    💨 **[Tên sản phẩm]** - **[Hãng]**
    💰 Giá: [giá] VNĐ
    ⭐ Đánh giá: [số sao]/5 sao
    📝 [Mô tả ngắn về sản phẩm]
    [Lặp lại cho các sản phẩm khác]
    
    📞 Liên hệ ngay để được tư vấn và có giá tốt nhất!
    [PRODUCT_IMAGES: tên_file_ảnh1, tên_file_ảnh2, ...]
    ```
    * **Không trả về dữ liệu thô:** Sau khi có kết quả từ SQL, đừng chỉ liệt kê chúng. Hãy phân tích và tổng hợp thông tin thành một câu trả lời hoàn chỉnh, ngắn gọn, tự nhiên, dễ hiểu bằng tiếng Việt để cho người dùng dễ dàng nắm bắt được nhất.
    * **Xử lý kết quả rỗng:** Nếu truy vấn không trả về kết quả nào, đừng im lặng. Hãy lịch sự thông báo cho người dùng: "Rất tiếc, tôi không tìm thấy thông tin nào phù hợp với yêu cầu của bạn."
    * **FORMAT ĐẶC BIỆT CHO HÌNH ẢNH**: Khi có thông tin về sản phẩm và có dữ liệu về hình ảnh từ cột product_avt_img, hãy LUÔN LUÔN kết thúc câu trả lời bằng dòng chính xác này: 
        "[PRODUCT_IMAGES: tên_file_ảnh1, tên_file_ảnh2, ...]"
        Ví dụ: "[PRODUCT_IMAGES: P1_avt.jpg, P2_avt.jpg, P3_avt.jpg]"
        
        **LƯU Ý QUAN TRỌNG**: Dòng này phải được viết CHÍNH XÁC như ví dụ, không thêm dấu chấm hay ký tự khác.

5.  **TUYỆT ĐỐI BẢO MẬT (Security First):**
    * Chỉ được phép thực hiện các câu lệnh `SELECT`. Cấm tuyệt đối các hành vi thay đổi dữ liệu như `INSERT`, `UPDATE`, `DELETE`.

6.  **QUAN TRỌNG NHẤT - ĐỊNH DẠNG ĐẦU RA (Output Format):**
    * Bạn phải trả lời theo định dạng gồm một chuỗi suy nghĩ và hành động.
    * Khi bạn đã có câu trả lời cuối cùng cho người dùng, bạn **BẮT BUỘC** phải bắt đầu bằng `Final Answer:`.
    * Nếu có hình ảnh sản phẩm, LUÔN kết thúc bằng dòng "[PRODUCT_IMAGES: ...]".
"""

def extract_product_images(response_text):
    """
    Extract ALL product image filenames from response text using a robust regex.
    Handles multiple [PRODUCT_IMAGES: ...] occurrences and potential newlines/spaces.
    """
    all_images = []
    print(f"DEBUG: Searching for images in response: {response_text}")
    
    pattern = r'\[PRODUCT_IMAGES:\s*(.*?)\]'
    matches = re.findall(pattern, response_text, re.DOTALL) 
    
    if matches:
        print(f"DEBUG: Found {len(matches)} PRODUCT_IMAGES blocks.")
        for image_list_str in matches:
            current_images = [img.strip().strip("'\"") for img in image_list_str.split(',') if img.strip()]
            all_images.extend(current_images)
        print(f"DEBUG: Processed all extracted images: {all_images}")
    else:
        print("DEBUG: No [PRODUCT_IMAGES: ...] pattern found.")
    
    return all_images

def clean_response_text(response_text):
    """
    Removes ALL [PRODUCT_IMAGES: ...] lines from the response text.
    Uses the same robust pattern as extract_product_images for consistency.
    """
    clean_pattern = r'\[PRODUCT_IMAGES:\s*(.*?)\]'
    cleaned_text = re.sub(clean_pattern, '', response_text, flags=re.DOTALL).strip()
    return cleaned_text

def create_image_path(image_filename):
    """Create full path to image file"""
    if not image_filename:
        return None
        
    product_id_match = re.match(r'([A-Za-z0-9]+)_', image_filename)
    if product_id_match:
        product_id = product_id_match.group(1)
    else:
        print(f"WARNING: Could not extract product ID from filename: {image_filename}. Using root image path.")
        product_id = ""
    full_path = os.path.join(IMAGE_BASE_PATH, product_id, image_filename)
    print(f"DEBUG: Created image path: {full_path}")
    return full_path

def create_product_card_content(answer):
    """Create formatted content for product cards"""
    content = f"""
## 🛒 **Thông tin sản phẩm**

{answer}

---
*💡 Bạn có thể hỏi thêm về giá cả, tình trạng kho hàng hoặc các thông số kỹ thuật khác!*
"""
    return content

def run_agent_in_thread(agent, user_input):
    """Runs the Langchain agent in a separate thread to prevent blocking the UI."""
    return agent.invoke({"input": user_input})

@cl.on_chat_start
async def start():
    """Initializes the database connection and Langchain agents when a new chat starts."""
    db_user = os.getenv('DATABASE_USER')
    db_password = os.getenv('DATABASE_PASSWORD')
    db_host = os.getenv('DATABASE_HOST')
    db_name = os.getenv('DATABASE')
    google_api_key = os.getenv('GOOGLE_API_KEY')
    deepinfra_api_token = os.getenv('DEEPINFRA_API_KEY')

    if not google_api_key and not deepinfra_api_token:
        await cl.Message(content="Lỗi: Không tìm thấy bất kỳ API_KEY nào trong file .env. Vui lòng kiểm tra lại.").send()
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
        
        if deepinfra_api_token:
            llm = ChatDeepInfra(
                model_id="google/gemini-2.0-flash-001", 
                # model_kwargs={"temperature": 0.0, "max_new_tokens": 2048},
                deepinfra_api_token=deepinfra_api_token
            )
            print("INFO: Using ChatDeepInfra for LLM.")
        elif google_api_key:
            llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash-latest",
                temperature=0,
                api_key=google_api_key
            )
            print("INFO: Using ChatGoogleGenerativeAI for LLM.")
        else:
            await cl.Message(content="Lỗi: Không có LLM nào được cấu hình (thiếu GOOGLE_API_KEY hoặc DEEPINFRA_API_KEY).").send()
            return

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
        await cl.Message(content=f"Đã xảy ra lỗi khi khởi tạo: {str(e)}. Vui lòng kiểm tra cấu hình database và API keys.").send()

@cl.on_message
async def on_message(message: cl.Message):
    """Handles incoming user messages, routing them to the appropriate agent."""
    sql_agent = cl.user_session.get("sql_agent")
    general_chain = cl.user_session.get("general_chain")   

    if not sql_agent or not general_chain:
        await cl.Message(content="Lỗi: Hệ thống chưa được khởi tạo hoàn chỉnh. Vui lòng làm mới trang (F5) hoặc thử lại sau ít phút.").send()
        return

    user_message = message.content.lower()
    
    if user_message in GREETINGS:
        await cl.Message(content="Xin chào! Tôi có thể giúp gì cho bạn hôm nay?").send()
        return

    if any(keyword in user_message for keyword in DB_KEYWORDS):
        msg = cl.Message(content="🔍 Đang tìm kiếm thông tin sản phẩm cho bạn...")
        await msg.send()
        
        try:
            response = await asyncio.to_thread(
                run_agent_in_thread, sql_agent, message.content
            )
            full_response_text = response.get("output", "Rất tiếc, tôi không thể tìm thấy câu trả lời phù hợp với yêu cầu về sản phẩm của bạn.")
            print(f"DEBUG: Full response from agent: {full_response_text}")
            
            product_images = extract_product_images(full_response_text)
            print(f"DEBUG: Extracted images for display: {product_images}")
            
            clean_answer = clean_response_text(full_response_text)
            print(f"DEBUG: Cleaned answer for display: {clean_answer}")
            
            elements = []
            if product_images:
                print(f"DEBUG: Preparing {len(product_images)} images for display.")
                for i, img_filename in enumerate(product_images[:3]): 
                    img_path = create_image_path(img_filename)
                    if img_path and os.path.exists(img_path): 
                        try:
                            image_element = cl.Image(
                                name=f"product_{i+1}",
                                display="inline",
                                path=img_path,
                                size="medium"
                            )
                            elements.append(image_element)
                            print(f"DEBUG: Added image element: {img_path}")
                        except Exception as img_error:
                            print(f"ERROR: Failed to create Chainlit image element for {img_path}: {img_error}")
                    else:
                        print(f"WARNING: Image file not found at expected path: {img_path}. Skipping this image.")

            formatted_content = create_product_card_content(clean_answer)
            
            msg.content = formatted_content
            msg.elements = elements if elements else []
            await msg.update()
            
        except Exception as e:
            print(f"CRITICAL ERROR: SQL Agent or message processing failed: {e}")
            await cl.Message(content=f"❌ Rất tiếc, đã xảy ra lỗi trong quá trình xử lý yêu cầu của bạn: {str(e)}. Vui lòng thử lại sau.").send()
        return
    
    else:
        msg = cl.Message(content="🤔 Đang suy nghĩ câu trả lời...")
        await msg.send()
        
        cb = cl.AsyncLangchainCallbackHandler(stream_final_answer=True)
        response = await general_chain.acall(
            {"question": message.content},
            callbacks=[cb]
        )
        answer = response.get("text", "Rất tiếc, tôi không thể xử lý yêu cầu này. Bạn có muốn hỏi về sản phẩm không?")
        msg.content = answer
        await msg.update()
