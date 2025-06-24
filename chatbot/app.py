import os
from dotenv import load_dotenv
from openai import AsyncOpenAI
import chainlit as cl


load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")

client = AsyncOpenAI(
    api_key=groq_api_key,
    base_url="https://api.groq.com/openai/v1"
)

cl.instrument_openai()

settings = {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.7,
    "max_tokens": 1000, 
}

SYSTEM_MESSAGE = """
Bạn là một trợ lý hữu ích, trả lời bằng tiếng Việt.
Bạn tập trung vào việc cung cấp thông tin chính xác và hữu ích.
Hãy giữ câu trả lời ngắn gọn và dễ hiểu.
"""

@cl.on_chat_start
async def on_chat_start():
    await cl.Message(content="Xin chào! Tôi là trợ lý ảo. Tôi có thể giúp gì cho bạn?").send()
    
    cl.user_session.set("system_message", SYSTEM_MESSAGE)

@cl.on_message
async def on_message(message: cl.Message):
    system_message = cl.user_session.get("system_message")
    
    message_history = []
    
    chat_history = cl.user_session.get("chat_history", [])
    message_history.extend(chat_history)
    message_history.append({"role": "user", "content": message.content})
    
    messages = [
        {"role": "system", "content": system_message},
    ]
    messages.extend(message_history)
    
    thinking_msg = cl.Message(content="Đang suy nghĩ...")
    await thinking_msg.send()
    
    try:
        response = await client.chat.completions.create(
            messages=messages,
            **settings
        )
        
        response_content = response.choices[0].message.content
        
        message_history.append({"role": "assistant", "content": response_content})
        cl.user_session.set("chat_history", message_history)
        
        await thinking_msg.remove()
        
        await cl.Message(content=response_content).send()
    except Exception as e:
        await thinking_msg.update(content=f"Đã xảy ra lỗi: {str(e)}")

# @cl.on_settings_update
# async def setup_css():
#     await cl.local_file("styles.css").send()

