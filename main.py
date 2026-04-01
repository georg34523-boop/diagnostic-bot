import os
import asyncio
import logging
import aiohttp
import secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from typing import Dict

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import Message, BufferedInputFile
from supabase import create_client, Client
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RAILWAY_URL = os.getenv("RAILWAY_URL", "")  # URL Railway для webhook

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Зберігаємо активні боти: {bot_token: {"bot": Bot, "dp": Dispatcher, "bot_id": uuid, "expert_id": uuid}}
active_bots: Dict[str, dict] = {}


# ==================== HELPER FUNCTIONS ====================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

async def transcribe_audio(file_bytes: bytes, file_name: str = "audio.ogg") -> str:
    """Транскрибація аудіо/відео через OpenAI Whisper API"""
    if not OPENAI_API_KEY:
        return None
    try:
        import aiohttp
        from aiohttp import FormData
        
        data = FormData()
        data.add_field('file', file_bytes, filename=file_name, content_type='audio/ogg')
        data.add_field('model', 'whisper-1')
        data.add_field('language', 'uk')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                data=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    text = result.get("text", "").strip()
                    if text:
                        logger.info(f"Transcribed: {text[:100]}...")
                        return text
                else:
                    error = await resp.text()
                    logger.warning(f"Whisper API error {resp.status}: {error[:200]}")
    except Exception as e:
        logger.warning(f"Transcription failed: {e}")
    return None

def generate_token():
    """Генерація унікального токена"""
    return f"pay_{secrets.token_urlsafe(16)}"


async def get_bot_by_token(bot_token: str) -> dict:
    """Отримати бота з бази по токену"""
    result = supabase.table("bots").select("*").eq("bot_token", bot_token).eq("is_active", True).execute()
    if result.data:
        return result.data[0]
    return None


async def load_all_bots():
    """Завантажити всі активні боти з бази"""
    result = supabase.table("bots").select("*").eq("is_active", True).execute()
    return result.data or []


async def register_webhook(bot: Bot, bot_token: str):
    """Зареєструвати webhook для бота"""
    if not RAILWAY_URL:
        logger.warning("RAILWAY_URL not set, skipping webhook registration")
        return False
    
    webhook_url = f"{RAILWAY_URL}/webhook/telegram/{bot_token}"
    try:
        await bot.set_webhook(
            webhook_url,
            allowed_updates=["message", "message_reaction", "message_reaction_count"]
        )
        logger.info(f"Webhook set for bot: {webhook_url}")
        supabase.table("bots").update({"webhook_set": True}).eq("bot_token", bot_token).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to set webhook: {e}")
        return False


async def verify_payment_token(token: str, telegram_id: int, bot_id: str) -> dict:
    """Перевірка і активація токена оплати"""
    result = supabase.table("payment_tokens").select("*").eq("token", token).execute()
    
    if not result.data:
        return {"success": False, "error": "Код не знайдено"}
    
    token_data = result.data[0]
    
    if token_data["status"] == "used":
        return {"success": False, "error": "Цей код вже був використаний"}
    
    if token_data["status"] == "expired":
        return {"success": False, "error": "Термін дії коду закінчився"}
    
    if token_data.get("expires_at"):
        expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
        if datetime.now(expires_at.tzinfo) > expires_at:
            supabase.table("payment_tokens").update({"status": "expired"}).eq("id", token_data["id"]).execute()
            return {"success": False, "error": "Термін дії коду закінчився"}
    
    supabase.table("payment_tokens").update({
        "status": "used",
        "used_by_telegram_id": telegram_id,
        "used_at": datetime.utcnow().isoformat()
    }).eq("id", token_data["id"]).execute()
    
    return {"success": True, "data": token_data}


async def is_authorized(username: str, telegram_id: int, bot_id: str) -> bool:
    """Перевірка авторизації користувача для конкретного бота"""
    if telegram_id:
        result = supabase.table("authorized_users").select("id").eq(
            "telegram_id", telegram_id
        ).eq("bot_id", bot_id).execute()
        if result.data:
            return True
    
    if username:
        result = supabase.table("authorized_users").select("id").eq(
            "telegram_username", username.lower()
        ).eq("bot_id", bot_id).execute()
        if result.data:
            # Оновлюємо telegram_id якщо його не було
            if telegram_id:
                supabase.table("authorized_users").update({"telegram_id": telegram_id}).eq(
                    "telegram_username", username.lower()
                ).eq("bot_id", bot_id).execute()
            return True
    
    return False


async def authorize_user(telegram_id: int, bot_id: str, expert_id: str, username: str = None, email: str = None, phone: str = None):
    """Додати користувача до авторизованих"""
    if await is_authorized(username, telegram_id, bot_id):
        return
    
    user_data = {
        "telegram_id": telegram_id,
        "telegram_username": username.lower() if username else None,
        "email": email,
        "phone": phone,
        "bot_id": bot_id,
        "expert_id": expert_id
    }
    supabase.table("authorized_users").insert(user_data).execute()


async def get_or_create_client(user: types.User, bot_id: str, expert_id: str, email: str = None, phone: str = None) -> dict:
    """Отримати або створити клієнта для конкретного бота"""
    result = supabase.table("clients").select("*").eq(
        "telegram_id", user.id
    ).eq("bot_id", bot_id).execute()
    
    if result.data:
        if email or phone:
            update_data = {}
            if email:
                update_data["email"] = email
            if phone:
                update_data["phone"] = phone
            if update_data:
                supabase.table("clients").update(update_data).eq("telegram_id", user.id).eq("bot_id", bot_id).execute()
        return result.data[0]
    
    new_client = {
        "telegram_id": user.id,
        "telegram_username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": "new",
        "email": email,
        "phone": phone,
        "bot_id": bot_id,
        "expert_id": expert_id
    }
    result = supabase.table("clients").insert(new_client).execute()
    return result.data[0]


async def save_message(client_id: str, direction: str, content_type: str, 
                       text_content: str = None, file_url: str = None,
                       file_name: str = None, telegram_file_id: str = None,
                       telegram_message_id: int = None, reply_to_message_id: str = None):
    """Зберегти повідомлення в базу"""
    message_data = {
        "client_id": client_id,
        "direction": direction,
        "content_type": content_type,
        "text_content": text_content,
        "file_url": file_url,
        "file_name": file_name,
        "telegram_file_id": telegram_file_id,
        "telegram_message_id": telegram_message_id,
        "is_read": direction == "expert"
    }
    if reply_to_message_id:
        message_data["reply_to_message_id"] = reply_to_message_id
    result = supabase.table("messages").insert(message_data).execute()
    supabase.table("clients").update({"updated_at": datetime.utcnow().isoformat()}).eq("id", client_id).execute()
    return result.data[0] if result.data else None


async def upload_file_to_storage(file_bytes: bytes, file_name: str) -> str:
    """Завантажити файл в Supabase Storage"""
    try:
        file_path = f"uploads/{file_name}"
        supabase.storage.from_("diagnostic-files").upload(file_path, file_bytes, {"content-type": "application/octet-stream"})
        public_url = supabase.storage.from_("diagnostic-files").get_public_url(file_path)
        return public_url
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return None


# ==================== BOT HANDLERS FACTORY ====================

def create_bot_handlers(bot: Bot, dp: Dispatcher, bot_token: str, bot_id: str, expert_id: str, welcome_message: str):
    """Створити обробники для конкретного бота"""
    
    async def get_welcome_message():
        """Отримати актуальне привітальне повідомлення з бази"""
        result = supabase.table("bots").select("welcome_message").eq("id", bot_id).execute()
        if result.data and result.data[0].get("welcome_message"):
            return result.data[0]["welcome_message"]
        return "👋 Вітаю! Надішліть фото для діагностики 📸"
    
    @dp.message(CommandStart())
    async def cmd_start(message: Message, command: CommandObject):
        telegram_id = message.from_user.id
        username = message.from_user.username
        
        if command.args and command.args.startswith("pay_"):
            token = command.args
            result = await verify_payment_token(token, telegram_id, bot_id)
            
            if result["success"]:
                email = result["data"].get("email")
                phone = result["data"].get("phone")
                await authorize_user(telegram_id, bot_id, expert_id, username, email, phone)
                await get_or_create_client(message.from_user, bot_id, expert_id, email, phone)
                
                current_welcome = await get_welcome_message()
                await message.answer(current_welcome)
                return
            else:
                await message.answer(f"❌ {result['error']}\n\nЯкщо виникли проблеми, напишіть в підтримку.")
                return
        
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer(
                "👋 Вітаю!\n\n"
                "На жаль, у вас поки немає доступу.\n\n"
                "Для отримання доступу оплатіть діагностику на сайті."
            )
            return
        
        await get_or_create_client(message.from_user, bot_id, expert_id)
        current_welcome = await get_welcome_message()
        await message.answer(current_welcome)

    @dp.message(Command("help"))
    async def cmd_help(message: Message):
        await message.answer("📖 Як користуватися ботом:\n\n1. Надішліть фото для діагностики\n2. Задайте питання текстом\n3. Дочекайтесь відповіді експерта")

    @dp.message(F.photo)
    async def handle_photo(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        file_bytes = await bot.download_file(file.file_path)
        file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        file_url = await upload_file_to_storage(file_bytes.read(), file_name)
        await save_message(client_id=client["id"], direction="client", content_type="photo", text_content=message.caption, file_url=file_url, file_name=file_name, telegram_file_id=photo.file_id, telegram_message_id=message.message_id)
        # AI Agent
        await trigger_ai_agent(client, bot_id)

    @dp.message(F.video)
    async def handle_video(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        video = message.video
        file = await bot.get_file(video.file_id)
        file_bytes = await bot.download_file(file.file_path)
        file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        file_url = await upload_file_to_storage(file_bytes.read(), file_name)
        await save_message(client_id=client["id"], direction="client", content_type="video", text_content=message.caption, file_url=file_url, file_name=file_name, telegram_file_id=video.file_id, telegram_message_id=message.message_id)

    @dp.message(F.voice)
    async def handle_voice(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        voice = message.voice
        file = await bot.get_file(voice.file_id)
        file_bytes = await bot.download_file(file.file_path)
        audio_data = file_bytes.read()
        file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.ogg"
        file_url = await upload_file_to_storage(audio_data, file_name)
        # Транскрибація голосового
        transcription = await transcribe_audio(audio_data, file_name)
        text_content = f"[Голосове] {transcription}" if transcription else None
        await save_message(client_id=client["id"], direction="client", content_type="voice", text_content=text_content, file_url=file_url, file_name=file_name, telegram_file_id=voice.file_id, telegram_message_id=message.message_id)
        # AI Agent
        await trigger_ai_agent(client, bot_id)

    @dp.message(F.video_note)
    async def handle_video_note(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        video_note = message.video_note
        file = await bot.get_file(video_note.file_id)
        file_bytes = await bot.download_file(file.file_path)
        video_data = file_bytes.read()
        file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_circle.mp4"
        file_url = await upload_file_to_storage(video_data, file_name)
        # Транскрибація аудіо з кружка
        transcription = await transcribe_audio(video_data, file_name)
        text_content = f"[Відео-кружок] {transcription}" if transcription else None
        await save_message(client_id=client["id"], direction="client", content_type="video_note", text_content=text_content, file_url=file_url, file_name=file_name, telegram_file_id=video_note.file_id, telegram_message_id=message.message_id)

    @dp.message(F.document)
    async def handle_document(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        document = message.document
        file = await bot.get_file(document.file_id)
        file_bytes = await bot.download_file(file.file_path)
        file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{document.file_name}"
        file_url = await upload_file_to_storage(file_bytes.read(), file_name)
        await save_message(client_id=client["id"], direction="client", content_type="document", text_content=message.caption, file_url=file_url, file_name=document.file_name, telegram_file_id=document.file_id, telegram_message_id=message.message_id)

    async def get_reply_id(message: Message) -> str:
        """Отримати ID повідомлення в базі, на яке відповідає клієнт"""
        if message.reply_to_message:
            reply_tg_id = message.reply_to_message.message_id
            result = supabase.table("messages").select("id").eq("telegram_message_id", reply_tg_id).execute()
            if result.data:
                return result.data[0]["id"]
        return None

    @dp.message(F.text)
    async def handle_text(message: Message):
        telegram_id = message.from_user.id
        username = message.from_user.username
        if not await is_authorized(username, telegram_id, bot_id):
            await message.answer("⛔ У вас немає доступу.")
            return
        client = await get_or_create_client(message.from_user, bot_id, expert_id)
        reply_id = await get_reply_id(message)
        await save_message(client_id=client["id"], direction="client", content_type="text", text_content=message.text, telegram_message_id=message.message_id, reply_to_message_id=reply_id)
        # AI Agent
        await trigger_ai_agent(client, bot_id)

    async def trigger_ai_agent(client: dict, current_bot_id: str):
        """Викликає AI агента якщо він увімкнений для клієнта"""
        try:
            from ai_agent import is_ai_enabled_for_client, get_ai_response, process_ai_actions, get_templates_for_bot
            
            if not await is_ai_enabled_for_client(client["id"], supabase):
                return
            
            # Отримуємо історію повідомлень
            msg_result = supabase.table("messages").select("*").eq("client_id", client["id"]).order("created_at").execute()
            messages_history = msg_result.data or []
            
            # Отримуємо шаблони
            templates = await get_templates_for_bot(current_bot_id, supabase)
            
            # Отримуємо відповідь від AI
            actions = await get_ai_response(client, messages_history, templates, supabase)
            
            if actions:
                await process_ai_actions(actions, client, bot, supabase, current_bot_id)
                logger.info(f"AI agent processed {len(actions)} actions for client {client['id']}")
        except Exception as e:
            logger.error(f"AI agent trigger error: {e}")

    @dp.message_reaction()
    async def handle_reaction(event: types.MessageReactionUpdated):
        """Обробка реакцій від клієнтів"""
        try:
            telegram_id = event.user.id if event.user else None
            if not telegram_id:
                return
            
            message_id = event.message_id
            
            # Збираємо нові реакції
            new_reactions = []
            for r in (event.new_reaction or []):
                if hasattr(r, 'emoji') and r.emoji:
                    new_reactions.append(r.emoji)
                elif hasattr(r, 'custom_emoji_id') and r.custom_emoji_id:
                    new_reactions.append(f"custom:{r.custom_emoji_id}")
            
            # Знаходимо повідомлення в базі по telegram_message_id
            result = supabase.table("messages").select("id").eq(
                "telegram_message_id", message_id
            ).execute()
            
            if result.data:
                msg_db_id = result.data[0]["id"]
                reactions_str = ",".join(new_reactions) if new_reactions else None
                supabase.table("messages").update({
                    "reactions": reactions_str
                }).eq("id", msg_db_id).execute()
                logger.info(f"Reaction updated for message {msg_db_id}: {reactions_str}")
            else:
                logger.warning(f"Message not found for telegram_message_id={message_id}")
        except Exception as e:
            logger.error(f"Reaction handler error: {e}")


async def initialize_bot(bot_data: dict) -> bool:
    """Ініціалізувати одного бота"""
    bot_token = bot_data["bot_token"]
    bot_id = bot_data["id"]
    expert_id = bot_data["expert_id"]
    welcome_message = bot_data.get("welcome_message", "")
    
    if bot_token in active_bots:
        logger.info(f"Bot {bot_token[:20]}... already active")
        return True
    
    try:
        bot = Bot(token=bot_token)
        dp = Dispatcher()
        create_bot_handlers(bot, dp, bot_token, bot_id, expert_id, welcome_message)
        await register_webhook(bot, bot_token)
        
        active_bots[bot_token] = {
            "bot": bot,
            "dp": dp,
            "bot_id": bot_id,
            "expert_id": expert_id
        }
        
        logger.info(f"Bot initialized: {bot_data.get('bot_username', 'unknown')}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize bot: {e}")
        return False


async def initialize_all_bots():
    """Ініціалізувати всі боти з бази"""
    bots = await load_all_bots()
    logger.info(f"Found {len(bots)} active bots")
    for bot_data in bots:
        await initialize_bot(bot_data)


# ==================== SEND EXPERT MESSAGES ====================

async def send_expert_messages():
    """Відправка повідомлень від експертів клієнтам"""
    processed_ids = set()
    
    # При старті позначаємо всі старі непрочитані як прочитані (щоб не відправляти повторно при рестарті)
    try:
        old_cutoff = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        supabase.table("messages").update({"is_read": True}).eq("direction", "expert").eq("is_read", False).lt("created_at", old_cutoff).execute()
        logger.info("Marked old unread expert messages as read (prevent re-send on restart)")
    except Exception as e:
        logger.warning(f"Failed to mark old messages: {e}")
    
    while True:
        try:
            result = supabase.table("messages").select("*, clients(telegram_id, expert_id)").eq("direction", "expert").eq("is_read", False).execute()
            
            for msg in result.data:
                if msg["id"] in processed_ids:
                    continue
                
                telegram_id = msg.get("clients", {}).get("telegram_id")
                expert_id = msg.get("clients", {}).get("expert_id")
                
                if not telegram_id or not expert_id:
                    continue
                
                bot_entry = None
                for token, data in active_bots.items():
                    if data["expert_id"] == expert_id:
                        bot_entry = data
                        break
                
                if not bot_entry:
                    logger.warning(f"No bot found for expert {expert_id}")
                    continue
                
                bot = bot_entry["bot"]
                
                try:
                    sent_message = None
                    
                    # Визначаємо reply_to_message_id для Telegram
                    tg_reply_to = None
                    if msg.get("reply_to_message_id"):
                        reply_msg = supabase.table("messages").select("telegram_message_id").eq("id", msg["reply_to_message_id"]).execute()
                        if reply_msg.data and reply_msg.data[0].get("telegram_message_id"):
                            tg_reply_to = reply_msg.data[0]["telegram_message_id"]
                    
                    if msg["content_type"] == "text" and msg.get("text_content"):
                        sent_message = await bot.send_message(telegram_id, msg["text_content"], reply_to_message_id=tg_reply_to)
                    elif msg["content_type"] == "photo" and msg.get("file_url"):
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    photo_data = await resp.read()
                                    photo_file = BufferedInputFile(photo_data, filename="photo.jpg")
                                    sent_message = await bot.send_photo(telegram_id, photo_file, caption=msg.get("text_content"))
                    elif msg["content_type"] == "video" and msg.get("file_url"):
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    video_data = await resp.read()
                                    video_size_mb = len(video_data) / (1024 * 1024)
                                    logger.info(f"Downloaded video: {video_size_mb:.1f}MB")
                                    
                                    import subprocess
                                    import os as _os
                                    
                                    input_path = f"/tmp/vid_{msg['id']}.mp4"
                                    thumb_path = f"/tmp/thumb_{msg['id']}.jpg"
                                    compressed_path = f"/tmp/comp_{msg['id']}.mp4"
                                    
                                    with open(input_path, 'wb') as f:
                                        f.write(video_data)
                                    
                                    # 1. Генеруємо thumbnail (JPEG, макс 320px, макс 200KB)
                                    thumb_file = None
                                    try:
                                        subprocess.run([
                                            'ffmpeg', '-y', '-i', input_path,
                                            '-ss', '00:00:01', '-vframes', '1',
                                            '-vf', 'scale=320:-2',
                                            '-q:v', '5',
                                            thumb_path
                                        ], capture_output=True, timeout=30)
                                        
                                        if _os.path.exists(thumb_path) and 0 < _os.path.getsize(thumb_path) <= 200000:
                                            with open(thumb_path, 'rb') as f:
                                                thumb_file = BufferedInputFile(f.read(), filename="thumb.jpg")
                                            logger.info(f"Thumbnail OK: {_os.path.getsize(thumb_path)} bytes")
                                    except Exception as th_err:
                                        logger.warning(f"Thumbnail failed: {th_err}")
                                    
                                    # 2. Якщо > 49MB — стискаємо
                                    send_data = video_data
                                    if video_size_mb > 49:
                                        try:
                                            import json as _json
                                            probe = subprocess.run([
                                                'ffprobe', '-v', 'quiet', '-show_format',
                                                '-print_format', 'json', input_path
                                            ], capture_output=True, timeout=15)
                                            duration = 60
                                            if probe.returncode == 0:
                                                dur = _json.loads(probe.stdout.decode()).get('format', {}).get('duration')
                                                if dur:
                                                    duration = max(int(float(dur)), 1)
                                            target_br = int((45 * 8 * 1024) / duration)
                                            logger.info(f"Compressing: dur={duration}s, bitrate={target_br}kbps")
                                            subprocess.run([
                                                'ffmpeg', '-y', '-i', input_path,
                                                '-c:v', 'libx264', '-b:v', f'{target_br}k',
                                                '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k',
                                                '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
                                                compressed_path
                                            ], capture_output=True, timeout=600)
                                            if _os.path.exists(compressed_path) and 0 < _os.path.getsize(compressed_path) <= 49 * 1024 * 1024:
                                                with open(compressed_path, 'rb') as f:
                                                    send_data = f.read()
                                                logger.info(f"Compressed: {video_size_mb:.1f}MB -> {len(send_data)/1024/1024:.1f}MB")
                                        except Exception as comp_err:
                                            logger.warning(f"Compression failed: {comp_err}")
                                    
                                    # 3. Один send_document з thumbnail і caption
                                    video_file = BufferedInputFile(send_data, filename="video.mp4")
                                    sent_message = await bot.send_document(
                                        telegram_id, video_file,
                                        caption=msg.get("text_content"),
                                        thumbnail=thumb_file
                                    )
                                    logger.info(f"Video sent: {len(send_data)/1024/1024:.1f}MB, thumb={'yes' if thumb_file else 'no'}")
                                    
                                    for p in [input_path, thumb_path, compressed_path]:
                                        try:
                                            if _os.path.exists(p):
                                                _os.unlink(p)
                                        except:
                                            pass
                    elif msg["content_type"] == "voice" and msg.get("file_url"):
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    audio_data = await resp.read()
                                    
                                    # Конвертуємо в OGG OPUS через FFmpeg
                                    import subprocess
                                    import tempfile
                                    import os
                                    
                                    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as input_file:
                                        input_file.write(audio_data)
                                        input_path = input_file.name
                                    
                                    output_path = input_path.replace('.webm', '.ogg')
                                    
                                    try:
                                        # FFmpeg конвертація в OGG OPUS
                                        process = subprocess.run([
                                            'ffmpeg', '-y', '-i', input_path,
                                            '-c:a', 'libopus', '-b:a', '64k',
                                            '-vn', output_path
                                        ], capture_output=True, timeout=30)
                                        
                                        if process.returncode == 0 and os.path.exists(output_path):
                                            with open(output_path, 'rb') as f:
                                                ogg_data = f.read()
                                            voice_file = BufferedInputFile(ogg_data, filename="voice.ogg")
                                        else:
                                            # Якщо FFmpeg не спрацював - відправляємо як є
                                            voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                    except Exception as conv_err:
                                        logger.warning(f"FFmpeg conversion failed: {conv_err}")
                                        voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                    finally:
                                        # Cleanup temp files
                                        if os.path.exists(input_path):
                                            os.unlink(input_path)
                                        if os.path.exists(output_path):
                                            os.unlink(output_path)
                                    
                                    sent_message = await bot.send_voice(telegram_id, voice_file)
                    elif msg["content_type"] == "document" and msg.get("file_url"):
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    doc_data = await resp.read()
                                    doc_file = BufferedInputFile(doc_data, filename=msg.get("file_name", "document"))
                                    sent_message = await bot.send_document(telegram_id, doc_file, caption=msg.get("text_content"))
                    elif msg["content_type"] == "video_note" and msg.get("file_url"):
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    video_data = await resp.read()
                                    
                                    # Конвертуємо в MP4 H.264 через FFmpeg
                                    import subprocess
                                    import tempfile
                                    import os
                                    
                                    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as input_file:
                                        input_file.write(video_data)
                                        input_path = input_file.name
                                    
                                    output_path = input_path.replace('.webm', '.mp4')
                                    
                                    try:
                                        # FFmpeg конвертація в MP4 H.264 + AAC, квадратне відео 384x384
                                        process = subprocess.run([
                                            'ffmpeg', '-y', '-i', input_path,
                                            '-vf', 'scale=384:384:force_original_aspect_ratio=increase,crop=384:384',
                                            '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
                                            '-c:a', 'aac', '-b:a', '128k',
                                            '-movflags', '+faststart',
                                            '-t', '60',
                                            output_path
                                        ], capture_output=True, timeout=60)
                                        
                                        if process.returncode == 0 and os.path.exists(output_path):
                                            with open(output_path, 'rb') as f:
                                                mp4_data = f.read()
                                            video_file = BufferedInputFile(mp4_data, filename="video_note.mp4")
                                        else:
                                            logger.warning(f"FFmpeg video conversion failed: {process.stderr.decode()}")
                                            video_file = BufferedInputFile(video_data, filename="video_note.mp4")
                                    except Exception as conv_err:
                                        logger.warning(f"FFmpeg video conversion error: {conv_err}")
                                        video_file = BufferedInputFile(video_data, filename="video_note.mp4")
                                    finally:
                                        # Cleanup temp files
                                        if os.path.exists(input_path):
                                            os.unlink(input_path)
                                        if os.path.exists(output_path):
                                            os.unlink(output_path)
                                    
                                    sent_message = await bot.send_video_note(telegram_id, video_file)
                    
                    # Зберігаємо telegram_message_id
                    update_data = {"is_read": True}
                    if sent_message:
                        update_data["telegram_message_id"] = sent_message.message_id
                    supabase.table("messages").update(update_data).eq("id", msg["id"]).execute()
                    processed_ids.add(msg["id"])
                    logger.info(f"Sent message {msg['id']} to {telegram_id}")
                except Exception as e:
                    logger.error(f"Error sending message {msg['id']}: {e}")
                    processed_ids.add(msg["id"])
        except Exception as e:
            logger.error(f"Error in send_expert_messages: {e}")
        
        await asyncio.sleep(2)


# ==================== CLIENT REMINDERS ====================

async def send_client_reminders():
    """Автоматичні нагадування клієнтам за 2 години до діагностики"""
    while True:
        try:
            # Отримуємо всі незавершені нагадування, які ще не відправлені клієнту
            result = supabase.table("reminders").select(
                "*, clients(telegram_id, bot_id, expert_id, first_name)"
            ).eq("is_completed", False).eq("client_notified", False).execute()
            
            now = datetime.utcnow()
            
            for reminder in (result.data or []):
                try:
                    remind_at_str = reminder.get("remind_at")
                    if not remind_at_str:
                        continue
                    
                    # Парсимо час нагадування
                    remind_at = datetime.fromisoformat(remind_at_str.replace("Z", "+00:00"))
                    # Переводимо в UTC для порівняння
                    if remind_at.tzinfo:
                        remind_at_utc = remind_at.astimezone(tz=None).replace(tzinfo=None)
                    else:
                        remind_at_utc = remind_at
                    
                    # Рахуємо скільки часу до діагностики
                    time_until = (remind_at_utc - now).total_seconds() / 3600  # в годинах
                    
                    # Якщо до діагностики менше 3 годин — не надсилаємо нагадування
                    # (діагностика на сьогодні, записалися нещодавно)
                    if time_until < 3 and time_until > 0:
                        # Просто позначаємо як відправлене, не турбуємо клієнта
                        supabase.table("reminders").update({
                            "client_notified": True
                        }).eq("id", reminder["id"]).execute()
                        logger.info(f"Skipped reminder (less than 3h until diagnostic): {reminder.get('id')}")
                        continue
                    
                    # Якщо діагностика вже минула — теж пропускаємо
                    if time_until < 0:
                        supabase.table("reminders").update({
                            "client_notified": True
                        }).eq("id", reminder["id"]).execute()
                        continue
                    
                    # Рахуємо час за 2 години до нагадування
                    notify_time = remind_at_utc - timedelta(hours=2)
                    
                    # Якщо зараз >= час нотифікації (за 2 години до)
                    if now >= notify_time:
                        telegram_id = reminder.get("clients", {}).get("telegram_id")
                        client_bot_id = reminder.get("clients", {}).get("bot_id")
                        expert_id = reminder.get("clients", {}).get("expert_id")
                        client_name = reminder.get("clients", {}).get("first_name", "")
                        reminder_text = reminder.get("reminder_text", "")
                        
                        if not telegram_id or not client_bot_id:
                            continue
                        
                        # Знаходимо бота
                        bot_entry = None
                        for token, data in active_bots.items():
                            if data["bot_id"] == client_bot_id:
                                bot_entry = data
                                break
                        
                        if not bot_entry:
                            continue
                        
                        # Форматуємо час для повідомлення (київський час)
                        from zoneinfo import ZoneInfo
                        kyiv_time = remind_at.astimezone(ZoneInfo("Europe/Kyiv"))
                        time_str = kyiv_time.strftime("%H:%M")
                        date_str = kyiv_time.strftime("%d.%m")
                        
                        # Відправляємо повідомлення клієнту
                        message_text = (
                            f"🔔 Нагадування!\n\n"
                            f"У вас сьогодні заплановано діагностику о {time_str} ({date_str}).\n\n"
                            f"Будь ласка, будьте на зв'язку 🤍"
                        )
                        
                        sent_msg = await bot_entry["bot"].send_message(telegram_id, message_text)
                        
                        # Зберігаємо в messages щоб відображалось в CRM
                        client_id = reminder.get("client_id")
                        if client_id:
                            await save_message(
                                client_id=client_id,
                                direction="expert",
                                content_type="text",
                                text_content=message_text,
                                telegram_message_id=sent_msg.message_id if sent_msg else None
                            )
                            # Позначаємо як прочитане (бо це автоматичне повідомлення)
                            supabase.table("messages").update({"is_read": True}).eq(
                                "client_id", client_id
                            ).eq("direction", "expert").eq("text_content", message_text).execute()
                        
                        # Позначаємо що клієнт отримав нагадування
                        supabase.table("reminders").update({
                            "client_notified": True
                        }).eq("id", reminder["id"]).execute()
                        
                        logger.info(f"Client reminder sent: {client_name} for {remind_at_str}")
                        
                except Exception as e:
                    logger.error(f"Error processing reminder {reminder.get('id')}: {e}")
            
        except Exception as e:
            logger.error(f"Error in send_client_reminders: {e}")
        
        # Перевіряємо кожні 60 секунд
        await asyncio.sleep(60)


# ==================== AI AUTO-START DIAGNOSTICS ====================

async def start_ai_diagnostics():
    """Автоматичний запуск діагностики AI агентом коли настає призначений час"""
    while True:
        try:
            from ai_agent import is_ai_enabled_for_client, get_ai_response, process_ai_actions, get_templates_for_bot
            
            # Отримуємо всі незавершені нагадування де AI увімкнений
            result = supabase.table("reminders").select(
                "*, clients(id, telegram_id, bot_id, expert_id, first_name, status, ai_enabled, phone)"
            ).eq("is_completed", False).execute()
            
            now = datetime.utcnow()
            
            for reminder in (result.data or []):
                try:
                    client_data = reminder.get("clients", {})
                    if not client_data or not client_data.get("ai_enabled"):
                        continue
                    
                    # Перевіряємо чи це нагадування про діагностику (не клієнтське)
                    if reminder.get("client_notified") is None:
                        continue
                    
                    remind_at_str = reminder.get("remind_at")
                    if not remind_at_str:
                        continue
                    
                    remind_at = datetime.fromisoformat(remind_at_str.replace("Z", "+00:00"))
                    if remind_at.tzinfo:
                        remind_at_utc = remind_at.astimezone(tz=None).replace(tzinfo=None)
                    else:
                        remind_at_utc = remind_at
                    
                    # Якщо час діагностики настав (± 5 хвилин)
                    diff_minutes = (now - remind_at_utc).total_seconds() / 60
                    if -2 <= diff_minutes <= 10:
                        # Перевіряємо чи вже не починали цю діагностику
                        # (шукаємо повідомлення "Переглядаю ваші фото" від експерта після часу нагадування)
                        client_id = client_data.get("id")
                        check_time = (remind_at_utc - timedelta(minutes=5)).isoformat()
                        recent_expert = supabase.table("messages").select("id").eq(
                            "client_id", client_id
                        ).eq("direction", "expert").gte("created_at", check_time).execute()
                        
                        if recent_expert.data and len(recent_expert.data) > 0:
                            # Вже є повідомлення від експерта — діагностика вже почалась
                            continue
                        
                        logger.info(f"AI auto-starting diagnostic for client {client_id}")
                        
                        # Знаходимо бота
                        client_bot_id = client_data.get("bot_id")
                        bot_entry = None
                        for token, data in active_bots.items():
                            if data["bot_id"] == client_bot_id:
                                bot_entry = data
                                break
                        
                        if not bot_entry:
                            continue
                        
                        # Створюємо "стартове" повідомлення яке запустить діагностику
                        start_msg = {
                            "client_id": client_id,
                            "direction": "expert",
                            "content_type": "text",
                            "text_content": "Переглядаю ваші фото і за хвилинку повертаюсь в чат 😊",
                            "is_read": False
                        }
                        supabase.table("messages").insert(start_msg).execute()
                        
                        # Позначаємо нагадування як завершене
                        supabase.table("reminders").update({
                            "is_completed": True
                        }).eq("id", reminder["id"]).execute()
                        
                        # Оновлюємо статус клієнта
                        supabase.table("clients").update({
                            "status": "diagnostic_scheduled",
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", client_id).execute()
                        
                        # Чекаємо 3 секунди (поки "переглядає фото")
                        await asyncio.sleep(3)
                        
                        # Отримуємо історію повідомлень
                        msg_result = supabase.table("messages").select("*").eq(
                            "client_id", client_id
                        ).order("created_at").execute()
                        messages_history = msg_result.data or []
                        
                        # Отримуємо шаблони
                        templates = await get_templates_for_bot(client_bot_id, supabase)
                        
                        # Запускаємо AI діагностику
                        actions = await get_ai_response(client_data, messages_history, templates, supabase)
                        if actions:
                            await process_ai_actions(actions, client_data, bot_entry["bot"], supabase, client_bot_id)
                            logger.info(f"AI diagnostic started for client {client_id}: {len(actions)} actions")
                        
                except Exception as e:
                    logger.error(f"AI diagnostic start error for reminder {reminder.get('id')}: {e}")
            
        except Exception as e:
            logger.error(f"Error in start_ai_diagnostics: {e}")
        
        # Перевіряємо кожні 30 секунд
        await asyncio.sleep(30)


# ==================== FASTAPI ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_all_bots()
    asyncio.create_task(send_expert_messages())
    asyncio.create_task(send_client_reminders())
    asyncio.create_task(start_ai_diagnostics())
    logger.info("Multi-bot server started!")
    yield
    logger.info("Server stopped!")

app = FastAPI(lifespan=lifespan)

# CORS для доступу з CRM
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшені краще вказати конкретні домени
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "message": "Multi-Bot Diagnostic API", "active_bots": len(active_bots)}


@app.get("/health")
async def health():
    return {"status": "healthy", "active_bots": len(active_bots)}


@app.post("/webhook/telegram/{bot_token}")
async def telegram_webhook(bot_token: str, request: Request):
    """Webhook для Telegram ботів"""
    if bot_token not in active_bots:
        logger.warning(f"Unknown bot token: {bot_token[:20]}...")
        raise HTTPException(status_code=404, detail="Bot not found")
    
    bot_entry = active_bots[bot_token]
    bot = bot_entry["bot"]
    dp = bot_entry["dp"]
    
    try:
        update_data = await request.json()
        update = types.Update(**update_data)
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/register-bot")
async def register_bot_api(request: Request):
    """API для реєстрації нового бота"""
    try:
        data = await request.json()
        bot_token = data.get("bot_token")
        expert_id = data.get("expert_id")
        
        if not bot_token or not expert_id:
            raise HTTPException(status_code=400, detail="bot_token and expert_id required")
        
        # Перевіряємо чи бот вже активний в пам'яті
        if bot_token in active_bots:
            raise HTTPException(status_code=400, detail="Bot already active")
        
        # Перевіряємо чи токен валідний
        try:
            test_bot = Bot(token=bot_token)
            bot_info = await test_bot.get_me()
            bot_username = bot_info.username
            bot_name = bot_info.first_name
            await test_bot.session.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid bot token: {e}")
        
        # Перевіряємо чи бот вже існує в базі
        existing = supabase.table("bots").select("id, is_active").eq("bot_token", bot_token).execute()
        if existing.data:
            if existing.data[0]["is_active"]:
                raise HTTPException(status_code=400, detail="Bot already registered")
            else:
                # Реактивуємо бота і оновлюємо expert_id (бот може перейти до іншого експерта)
                supabase.table("bots").update({
                    "is_active": True, 
                    "webhook_set": False,
                    "expert_id": expert_id
                }).eq("id", existing.data[0]["id"]).execute()
                bot_data = supabase.table("bots").select("*").eq("id", existing.data[0]["id"]).execute().data[0]
        else:
            # Додаємо в базу
            new_bot = {
                "bot_token": bot_token,
                "bot_username": bot_username,
                "bot_name": bot_name,
                "expert_id": expert_id,
                "is_active": True,
                "webhook_set": False,
                "welcome_message": "👋 Вітаю! Дякую, що записались на діагностику 🤍\n\nНайближчим часом я зв'яжусь з вами.\n\n📸 Надішліть фото для діагностики."
            }
            result = supabase.table("bots").insert(new_bot).execute()
            bot_data = result.data[0]
        
        # Ініціалізуємо бота (створюємо handlers і реєструємо webhook)
        success = await initialize_bot(bot_data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to initialize bot")
        
        return {
            "success": True,
            "bot_id": bot_data["id"],
            "bot_username": bot_username,
            "bot_name": bot_name,
            "webhook_set": True,
            "message": f"Bot @{bot_username} registered and activated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register bot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/bot/{bot_id}")
async def delete_bot_api(bot_id: str):
    """Видалити бота"""
    try:
        result = supabase.table("bots").select("*").eq("id", bot_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        
        bot_data = result.data[0]
        bot_token = bot_data["bot_token"]
        
        supabase.table("bots").update({"is_active": False}).eq("id", bot_id).execute()
        
        if bot_token in active_bots:
            bot = active_bots[bot_token]["bot"]
            try:
                await bot.delete_webhook()
            except:
                pass
            del active_bots[bot_token]
        
        return {"success": True, "message": "Bot deactivated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete bot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bots")
async def list_bots_api():
    """Список всіх активних ботів"""
    bots = await load_all_bots()
    return {"bots": [{"id": b["id"], "bot_username": b.get("bot_username"), "bot_name": b.get("bot_name"), "expert_id": b["expert_id"], "is_active": b["is_active"], "webhook_set": b.get("webhook_set", False)} for b in bots]}


@app.post("/api/create-token")
async def create_token_api(request: Request):
    """API для створення токена оплати"""
    try:
        data = await request.json()
        email = data.get("email", "")
        phone = data.get("phone", "")
        amount = data.get("amount", 0)
        order_id = data.get("order_id", "")
        bot_id = data.get("bot_id", "")
        
        token = generate_token()
        
        supabase.table("payment_tokens").insert({
            "token": token,
            "email": email,
            "phone": phone,
            "amount": amount,
            "order_id": order_id,
            "status": "unused"
        }).execute()
        
        bot_username = "bot"
        if bot_id:
            bot_result = supabase.table("bots").select("bot_username").eq("id", bot_id).execute()
            if bot_result.data:
                bot_username = bot_result.data[0]["bot_username"]
        
        return {"success": True, "token": token, "bot_link": f"https://t.me/{bot_username}?start={token}"}
    except Exception as e:
        logger.error(f"Create token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/message/{message_id}")
async def delete_message_api(message_id: str):
    """Видалити повідомлення з бази та Telegram"""
    try:
        # Отримуємо повідомлення з bot_id клієнта
        msg_result = supabase.table("messages").select("*, clients(telegram_id, bot_id)").eq("id", message_id).execute()
        if not msg_result.data:
            raise HTTPException(status_code=404, detail="Message not found")
        
        msg = msg_result.data[0]
        telegram_message_id = msg.get("telegram_message_id")
        telegram_id = msg.get("clients", {}).get("telegram_id")
        client_bot_id = msg.get("clients", {}).get("bot_id")
        
        logger.info(f"Deleting message: tg_msg_id={telegram_message_id}, tg_id={telegram_id}, bot_id={client_bot_id}")
        
        # Видаляємо з Telegram якщо є message_id
        telegram_deleted = False
        if telegram_message_id and telegram_id and client_bot_id:
            bot_entry = None
            for token, data in active_bots.items():
                if data["bot_id"] == client_bot_id:
                    bot_entry = data
                    break
            
            if bot_entry:
                try:
                    await bot_entry["bot"].delete_message(chat_id=telegram_id, message_id=telegram_message_id)
                    telegram_deleted = True
                    logger.info(f"Deleted message {telegram_message_id} from Telegram for chat {telegram_id}")
                except Exception as tg_err:
                    logger.warning(f"Could not delete from Telegram: {tg_err}")
            else:
                logger.warning(f"Bot not found for bot_id={client_bot_id}")
        else:
            logger.info(f"Missing data for Telegram delete: tg_msg_id={telegram_message_id}, tg_id={telegram_id}, bot_id={client_bot_id}")
        
        # Видаляємо з бази
        supabase.table("messages").delete().eq("id", message_id).execute()
        
        return {"success": True, "message": "Message deleted", "telegram_deleted": telegram_deleted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/react/{message_id}")
async def react_to_message(message_id: str, request: Request):
    """Поставити реакцію на повідомлення клієнта в Telegram"""
    try:
        data = await request.json()
        emoji = data.get("emoji", "👍")
        
        # Отримуємо повідомлення з telegram_message_id і bot_id клієнта
        msg_result = supabase.table("messages").select("*, clients(telegram_id, bot_id)").eq("id", message_id).execute()
        if not msg_result.data:
            raise HTTPException(status_code=404, detail="Message not found")
        
        msg = msg_result.data[0]
        telegram_message_id = msg.get("telegram_message_id")
        telegram_id = msg.get("clients", {}).get("telegram_id")
        client_bot_id = msg.get("clients", {}).get("bot_id")
        
        if not telegram_message_id or not telegram_id or not client_bot_id:
            raise HTTPException(status_code=400, detail="Missing telegram data for reaction")
        
        # Знаходимо бота
        bot_entry = None
        for token, bot_data in active_bots.items():
            if bot_data["bot_id"] == client_bot_id:
                bot_entry = bot_data
                break
        
        if not bot_entry:
            raise HTTPException(status_code=404, detail="Bot not found")
        
        # Ставимо реакцію через Telegram API
        from aiogram.types import ReactionTypeEmoji
        await bot_entry["bot"].set_message_reaction(
            chat_id=telegram_id,
            message_id=telegram_message_id,
            reaction=[ReactionTypeEmoji(emoji=emoji)]
        )
        
        # Зберігаємо реакцію експерта в базу
        current_reactions = msg.get("reactions") or ""
        expert_reaction = f"expert:{emoji}"
        if current_reactions:
            reactions_list = current_reactions.split(",")
            # Видаляємо попередню реакцію експерта
            reactions_list = [r for r in reactions_list if not r.startswith("expert:")]
            reactions_list.append(expert_reaction)
            new_reactions = ",".join(reactions_list)
        else:
            new_reactions = expert_reaction
        
        supabase.table("messages").update({"reactions": new_reactions}).eq("id", message_id).execute()
        
        return {"success": True, "emoji": emoji}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"React error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai-toggle/{client_id}")
async def toggle_ai(client_id: str, request: Request):
    """Увімкнути/вимкнути AI для клієнта"""
    try:
        data = await request.json()
        enabled = data.get("enabled", False)
        
        supabase.table("clients").update({"ai_enabled": enabled}).eq("id", client_id).execute()
        
        return {"success": True, "ai_enabled": enabled}
    except Exception as e:
        logger.error(f"AI toggle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
