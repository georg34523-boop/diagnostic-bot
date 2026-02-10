import os
import asyncio
import logging
import aiohttp
import hashlib
import hmac
import secrets
from datetime import datetime
from dotenv import load_dotenv
from io import BytesIO
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import Message, BufferedInputFile
from supabase import create_client, Client
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота
BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
WFP_SECRET_KEY = os.getenv("WFP_SECRET_KEY", "")  # Секретный ключ WayForPay

if not BOT_TOKEN or not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing environment variables")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Инициализация Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def generate_token():
    """Генерация уникального токена"""
    return f"pay_{secrets.token_urlsafe(16)}"


async def verify_payment_token(token: str, telegram_id: int) -> dict:
    """Проверка и активация токена оплаты"""
    result = supabase.table("payment_tokens").select("*").eq("token", token).execute()
    
    if not result.data:
        return {"success": False, "error": "Код не найден"}
    
    token_data = result.data[0]
    
    if token_data["status"] == "used":
        return {"success": False, "error": "Этот код уже был использован"}
    
    if token_data["status"] == "expired":
        return {"success": False, "error": "Срок действия кода истёк"}
    
    # Проверяем срок действия
    if token_data["expires_at"]:
        expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
        if datetime.now(expires_at.tzinfo) > expires_at:
            supabase.table("payment_tokens").update({"status": "expired"}).eq("id", token_data["id"]).execute()
            return {"success": False, "error": "Срок действия кода истёк"}
    
    # Активируем токен
    supabase.table("payment_tokens").update({
        "status": "used",
        "used_by_telegram_id": telegram_id,
        "used_at": datetime.utcnow().isoformat()
    }).eq("id", token_data["id"]).execute()
    
    return {"success": True, "data": token_data}


async def is_authorized_by_telegram_id(telegram_id: int) -> bool:
    """Проверка авторизации по telegram_id"""
    result = supabase.table("authorized_users").select("id").eq(
        "telegram_id", telegram_id
    ).execute()
    return len(result.data) > 0


async def is_authorized(username: str = None, telegram_id: int = None) -> bool:
    """Проверка авторизации пользователя"""
    # Сначала проверяем по telegram_id
    if telegram_id:
        result = supabase.table("authorized_users").select("id").eq(
            "telegram_id", telegram_id
        ).execute()
        if len(result.data) > 0:
            return True
    
    # Потом по username
    if username:
        result = supabase.table("authorized_users").select("id").eq(
            "telegram_username", username.lower()
        ).execute()
        if len(result.data) > 0:
            return True
    
    return False


async def authorize_user(telegram_id: int, username: str = None, email: str = None):
    """Добавить пользователя в авторизованные"""
    # Проверяем, не авторизован ли уже
    if await is_authorized(username, telegram_id):
        return
    
    user_data = {
        "telegram_id": telegram_id,
        "telegram_username": username.lower() if username else None,
        "email": email
    }
    supabase.table("authorized_users").insert(user_data).execute()


async def get_or_create_client(user: types.User) -> dict:
    """Получить или создать клиента"""
    result = supabase.table("clients").select("*").eq(
        "telegram_id", user.id
    ).execute()
    
    if result.data:
        return result.data[0]
    
    new_client = {
        "telegram_id": user.id,
        "telegram_username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": "new"
    }
    result = supabase.table("clients").insert(new_client).execute()
    return result.data[0]


async def save_message(client_id: str, direction: str, content_type: str, 
                       text_content: str = None, file_url: str = None,
                       file_name: str = None, telegram_file_id: str = None):
    """Сохранить сообщение в базу"""
    message_data = {
        "client_id": client_id,
        "direction": direction,
        "content_type": content_type,
        "text_content": text_content,
        "file_url": file_url,
        "file_name": file_name,
        "telegram_file_id": telegram_file_id,
        "is_read": direction == "expert"
    }
    supabase.table("messages").insert(message_data).execute()
    
    # Обновляем время последнего сообщения клиента
    supabase.table("clients").update(
        {"updated_at": datetime.utcnow().isoformat()}
    ).eq("id", client_id).execute()


async def upload_file_to_storage(file_bytes: bytes, file_name: str) -> str:
    """Загрузить файл в Supabase Storage"""
    try:
        file_path = f"uploads/{file_name}"
        supabase.storage.from_("diagnostic-files").upload(
            file_path, file_bytes, {"content-type": "application/octet-stream"}
        )
        public_url = supabase.storage.from_("diagnostic-files").get_public_url(file_path)
        return public_url
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return None


@dp.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject):
    """Обработка команды /start с возможным токеном"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    # Проверяем, есть ли токен в команде (deep link)
    if command.args and command.args.startswith("pay_"):
        token = command.args
        result = await verify_payment_token(token, telegram_id)
        
        if result["success"]:
            # Авторизуем пользователя
            email = result["data"].get("email")
            await authorize_user(telegram_id, username, email)
            await get_or_create_client(message.from_user)
            
            await message.answer(
                "✅ Оплата подтверждена!\n\n"
                "Добро пожаловать в бот диагностики! 🎉\n\n"
                "Здесь вы можете:\n"
                "📸 Отправить фото для диагностики\n"
                "💬 Задать вопросы эксперту\n"
                "📄 Получить рекомендации\n\n"
                "Просто напишите сообщение или отправьте фото, и эксперт вам ответит!"
            )
            return
        else:
            await message.answer(
                f"❌ {result['error']}\n\n"
                "Если у вас возникли проблемы с доступом, напишите в поддержку."
            )
            return
    
    # Обычная проверка авторизации
    if not await is_authorized(username, telegram_id):
        await message.answer(
            "👋 Добро пожаловать!\n\n"
            "К сожалению, у вас пока нет доступа к диагностике.\n\n"
            "Для получения доступа оплатите диагностику на нашем сайте.\n"
            "После оплаты вы получите ссылку для активации."
        )
        return
    
    await get_or_create_client(message.from_user)
    
    await message.answer(
        "👋 Добро пожаловать в бот диагностики!\n\n"
        "Здесь вы можете:\n"
        "📸 Отправить фото для диагностики\n"
        "💬 Задать вопросы эксперту\n"
        "📄 Получить рекомендации\n\n"
        "Просто напишите сообщение или отправьте фото, и эксперт вам ответит!"
    )


@dp.message(Command("help"))
async def cmd_help(message: Message):
    """Обработка команды /help"""
    await message.answer(
        "📖 Как пользоваться ботом:\n\n"
        "1. Отправьте фото для диагностики\n"
        "2. Задайте вопрос текстом\n"
        "3. Дождитесь ответа эксперта\n\n"
        "Эксперт ответит вам в ближайшее время!"
    )


@dp.message(F.photo)
async def handle_photo(message: Message):
    """Обработка фото"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    # Получаем файл
    photo = message.photo[-1]  # Берём самое большое фото
    file = await bot.get_file(photo.file_id)
    file_bytes = await bot.download_file(file.file_path)
    
    # Загружаем в Storage
    file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    file_url = await upload_file_to_storage(file_bytes.read(), file_name)
    
    # Сохраняем сообщение
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="photo",
        text_content=message.caption,
        file_url=file_url,
        file_name=file_name,
        telegram_file_id=photo.file_id
    )
    
    await message.answer("📸 Фото получено! Эксперт скоро его посмотрит и ответит вам.")


@dp.message(F.video)
async def handle_video(message: Message):
    """Обработка видео"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    video = message.video
    file = await bot.get_file(video.file_id)
    file_bytes = await bot.download_file(file.file_path)
    
    file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
    file_url = await upload_file_to_storage(file_bytes.read(), file_name)
    
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="video",
        text_content=message.caption,
        file_url=file_url,
        file_name=file_name,
        telegram_file_id=video.file_id
    )
    
    await message.answer("🎬 Видео получено! Эксперт скоро посмотрит и ответит вам.")


@dp.message(F.voice)
async def handle_voice(message: Message):
    """Обработка голосового сообщения"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    voice = message.voice
    file = await bot.get_file(voice.file_id)
    file_bytes = await bot.download_file(file.file_path)
    
    file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.ogg"
    file_url = await upload_file_to_storage(file_bytes.read(), file_name)
    
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="voice",
        file_url=file_url,
        file_name=file_name,
        telegram_file_id=voice.file_id
    )
    
    await message.answer("🎤 Голосовое сообщение получено! Эксперт скоро прослушает и ответит.")


@dp.message(F.video_note)
async def handle_video_note(message: Message):
    """Обработка видео-кружочка"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    video_note = message.video_note
    file = await bot.get_file(video_note.file_id)
    file_bytes = await bot.download_file(file.file_path)
    
    file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_circle.mp4"
    file_url = await upload_file_to_storage(file_bytes.read(), file_name)
    
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="video_note",
        file_url=file_url,
        file_name=file_name,
        telegram_file_id=video_note.file_id
    )
    
    await message.answer("⭕ Видео-кружок получен! Эксперт скоро посмотрит и ответит.")


@dp.message(F.document)
async def handle_document(message: Message):
    """Обработка документа"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    document = message.document
    file = await bot.get_file(document.file_id)
    file_bytes = await bot.download_file(file.file_path)
    
    file_name = f"{message.from_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{document.file_name}"
    file_url = await upload_file_to_storage(file_bytes.read(), file_name)
    
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="document",
        text_content=message.caption,
        file_url=file_url,
        file_name=document.file_name,
        telegram_file_id=document.file_id
    )
    
    await message.answer("📄 Документ получен! Эксперт скоро посмотрит и ответит.")


@dp.message(F.text)
async def handle_text(message: Message):
    """Обработка текстового сообщения"""
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    if not await is_authorized(username, telegram_id):
        await message.answer("⛔ У вас нет доступа. Оплатите диагностику на сайте для получения доступа.")
        return
    
    client = await get_or_create_client(message.from_user)
    
    await save_message(
        client_id=client["id"],
        direction="client",
        content_type="text",
        text_content=message.text
    )
    
    await message.answer("✉️ Сообщение получено! Эксперт скоро ответит вам.")


async def send_expert_messages():
    """Отправка сообщений от эксперта клиентам"""
    processed_ids = set()
    
    while True:
        try:
            # Получаем непрочитанные сообщения от эксперта
            result = supabase.table("messages").select(
                "*, clients(telegram_id)"
            ).eq("direction", "expert").eq("is_read", False).execute()
            
            for msg in result.data:
                if msg["id"] in processed_ids:
                    continue
                
                telegram_id = msg.get("clients", {}).get("telegram_id")
                if not telegram_id:
                    continue
                
                try:
                    # Отправляем сообщение в зависимости от типа
                    if msg["content_type"] == "text" and msg.get("text_content"):
                        await bot.send_message(telegram_id, msg["text_content"])
                    
                    elif msg["content_type"] == "photo" and msg.get("file_url"):
                        await bot.send_photo(
                            telegram_id, 
                            msg["file_url"],
                            caption=msg.get("text_content")
                        )
                    
                    elif msg["content_type"] == "video" and msg.get("file_url"):
                        await bot.send_video(
                            telegram_id,
                            msg["file_url"],
                            caption=msg.get("text_content")
                        )
                    
                    elif msg["content_type"] == "voice" and msg.get("file_url"):
                        # Скачиваем файл и конвертируем в ogg opus для правильного waveform
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    audio_data = await resp.read()
                                    
                                    # Сохраняем временный файл
                                    import tempfile
                                    
                                    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp_in:
                                        tmp_in.write(audio_data)
                                        tmp_in_path = tmp_in.name
                                    
                                    tmp_out_path = tmp_in_path.replace('.webm', '.ogg')
                                    
                                    try:
                                        # Конвертируем в ogg opus с правильными параметрами
                                        process = await asyncio.create_subprocess_exec(
                                            'ffmpeg', '-y', '-i', tmp_in_path,
                                            '-acodec', 'libopus',
                                            '-ac', '1',  # моно
                                            '-ar', '48000',  # частота дискретизации
                                            '-b:a', '128k',  # битрейт
                                            '-vbr', 'on',
                                            tmp_out_path,
                                            stdout=asyncio.subprocess.PIPE,
                                            stderr=asyncio.subprocess.PIPE
                                        )
                                        stdout, stderr = await process.communicate()
                                        
                                        if process.returncode == 0 and os.path.exists(tmp_out_path):
                                            # Читаем конвертированный файл
                                            with open(tmp_out_path, 'rb') as f:
                                                ogg_data = f.read()
                                            
                                            voice_file = BufferedInputFile(ogg_data, filename="voice.ogg")
                                            await bot.send_voice(telegram_id, voice_file)
                                            logger.info(f"Voice sent with ffmpeg conversion")
                                        else:
                                            logger.error(f"FFmpeg failed: {stderr.decode()}")
                                            voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                            await bot.send_voice(telegram_id, voice_file)
                                    except Exception as e:
                                        logger.error(f"FFmpeg error: {e}")
                                        # Если ffmpeg не сработал, отправляем как есть
                                        voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                        await bot.send_voice(telegram_id, voice_file)
                                    finally:
                                        # Удаляем временные файлы
                                        if os.path.exists(tmp_in_path):
                                            os.remove(tmp_in_path)
                                        if os.path.exists(tmp_out_path):
                                            os.remove(tmp_out_path)
                    
                    elif msg["content_type"] == "audio" and msg.get("file_url"):
                        # Скачиваем файл и отправляем как аудио
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    audio_data = await resp.read()
                                    audio_file = BufferedInputFile(audio_data, filename="audio.mp3")
                                    await bot.send_audio(telegram_id, audio_file)
                    
                    elif msg["content_type"] == "document" and msg.get("file_url"):
                        await bot.send_document(
                            telegram_id,
                            msg["file_url"],
                            caption=msg.get("text_content")
                        )
                    
                    elif msg["content_type"] == "video_note" and msg.get("file_url"):
                        # Скачиваем видео и конвертируем в круглый формат для video_note
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    video_data = await resp.read()
                                    
                                    import tempfile
                                    
                                    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp_in:
                                        tmp_in.write(video_data)
                                        tmp_in_path = tmp_in.name
                                    
                                    tmp_out_path = tmp_in_path.replace('.webm', '_round.mp4')
                                    
                                    try:
                                        # Конвертируем в круглый MP4 (384x384) с правильной ориентацией
                                        process = await asyncio.create_subprocess_exec(
                                            'ffmpeg', '-y', '-i', tmp_in_path,
                                            '-vf', 'crop=min(iw\\,ih):min(iw\\,ih),scale=384:384,transpose=1',
                                            '-c:v', 'libx264',
                                            '-preset', 'fast',
                                            '-c:a', 'aac',
                                            '-b:a', '128k',
                                            '-t', '60',
                                            '-metadata:s:v', 'rotate=0',
                                            tmp_out_path,
                                            stdout=asyncio.subprocess.PIPE,
                                            stderr=asyncio.subprocess.PIPE
                                        )
                                        stdout, stderr = await process.communicate()
                                        
                                        if process.returncode == 0 and os.path.exists(tmp_out_path):
                                            with open(tmp_out_path, 'rb') as f:
                                                mp4_data = f.read()
                                            
                                            video_note_file = BufferedInputFile(mp4_data, filename="video_note.mp4")
                                            await bot.send_video_note(telegram_id, video_note_file)
                                            logger.info(f"Video note sent with ffmpeg conversion")
                                        else:
                                            logger.error(f"FFmpeg video_note failed: {stderr.decode()}")
                                            video_file = BufferedInputFile(video_data, filename="video.mp4")
                                            await bot.send_video(telegram_id, video_file)
                                    except Exception as e:
                                        logger.error(f"FFmpeg video_note error: {e}")
                                        video_file = BufferedInputFile(video_data, filename="video.mp4")
                                        await bot.send_video(telegram_id, video_file)
                                    finally:
                                        if os.path.exists(tmp_in_path):
                                            os.remove(tmp_in_path)
                                        if os.path.exists(tmp_out_path):
                                            os.remove(tmp_out_path)
                    
                    # Помечаем как прочитанное
                    supabase.table("messages").update(
                        {"is_read": True}
                    ).eq("id", msg["id"]).execute()
                    
                    processed_ids.add(msg["id"])
                    logger.info(f"Sent message {msg['id']} to {telegram_id}")
                    
                except Exception as e:
                    logger.error(f"Error sending message {msg['id']}: {e}")
                    processed_ids.add(msg["id"])
            
        except Exception as e:
            logger.error(f"Error in send_expert_messages: {e}")
        
        await asyncio.sleep(2)  # Проверяем каждые 2 секунды


# ==================== FastAPI для Webhook ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запуск при старте
    asyncio.create_task(dp.start_polling(bot))
    asyncio.create_task(send_expert_messages())
    logger.info("Bot started!")
    yield
    # Остановка
    logger.info("Bot stopped!")

app = FastAPI(lifespan=lifespan)


@app.get("/")
async def root():
    return {"status": "ok", "message": "Diagnostic Bot API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/webhook/wayforpay")
async def wayforpay_webhook(request: Request):
    """Webhook для WayForPay"""
    try:
        data = await request.json()
        logger.info(f"WayForPay webhook received: {data}")
        
        # Проверяем статус транзакции
        transaction_status = data.get("transactionStatus")
        
        if transaction_status == "Approved":
            # Оплата успешна - создаём токен
            order_id = data.get("orderReference")
            amount = data.get("amount")
            email = data.get("email", "")
            phone = data.get("phone", "")
            
            # Генерируем уникальный токен
            token = generate_token()
            
            # Сохраняем в базу
            supabase.table("payment_tokens").insert({
                "token": token,
                "email": email,
                "phone": phone,
                "amount": amount,
                "order_id": order_id,
                "status": "unused"
            }).execute()
            
            logger.info(f"Payment token created: {token} for order {order_id}")
            
            # Формируем ссылку на бота
            bot_username = "testlid12bot"  # Замени на username твоего бота
            bot_link = f"https://t.me/{bot_username}?start={token}"
            
            # WayForPay ожидает ответ в определённом формате
            response_data = {
                "orderReference": order_id,
                "status": "accept",
                "time": int(datetime.now().timestamp())
            }
            
            # Можно также вернуть ссылку для редиректа
            # Это нужно настроить на стороне WayForPay или твоего сайта
            
            return JSONResponse(content=response_data)
        
        else:
            logger.warning(f"Payment not approved: {transaction_status}")
            return JSONResponse(content={"status": "reject"})
            
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/create-token")
async def create_token_api(request: Request):
    """API для создания токена вручную (для тестов или интеграции)"""
    try:
        data = await request.json()
        
        email = data.get("email", "")
        phone = data.get("phone", "")
        amount = data.get("amount", 0)
        order_id = data.get("order_id", "")
        
        # Генерируем токен
        token = generate_token()
        
        # Сохраняем в базу
        supabase.table("payment_tokens").insert({
            "token": token,
            "email": email,
            "phone": phone,
            "amount": amount,
            "order_id": order_id,
            "status": "unused"
        }).execute()
        
        bot_username = "testlid12bot"  # Замени на username твоего бота
        bot_link = f"https://t.me/{bot_username}?start={token}"
        
        return {
            "success": True,
            "token": token,
            "bot_link": bot_link
        }
        
    except Exception as e:
        logger.error(f"Create token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/token/{token}")
async def check_token(token: str):
    """Проверка статуса токена"""
    result = supabase.table("payment_tokens").select("*").eq("token", token).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Token not found")
    
    token_data = result.data[0]
    return {
        "token": token,
        "status": token_data["status"],
        "created_at": token_data["created_at"],
        "expires_at": token_data["expires_at"]
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
