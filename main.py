import os
import asyncio
import logging
import aiohttp
from datetime import datetime
from dotenv import load_dotenv
from io import BytesIO

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, BufferedInputFile
from supabase import create_client, Client

load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота
BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not BOT_TOKEN or not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing environment variables")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Инициализация Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


async def is_authorized(username: str) -> bool:
    """Проверка авторизации пользователя"""
    if not username:
        return False
    result = supabase.table("authorized_users").select("id").eq(
        "telegram_username", username.lower()
    ).execute()
    return len(result.data) > 0


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
async def cmd_start(message: Message):
    """Обработка команды /start"""
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer(
            "👋 Добро пожаловать!\n\n"
            "К сожалению, у вас пока нет доступа к диагностике.\n\n"
            "Если вы уже оплатили — напишите в поддержку, и мы добавим вас в систему."
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
    username = message.from_user.username
    
    if not await is_authorized(username):
        await message.answer("⛔ У вас нет доступа. Напишите /start для информации.")
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
                        # Скачиваем файл и отправляем как голосовое
                        async with aiohttp.ClientSession() as session:
                            async with session.get(msg["file_url"]) as resp:
                                if resp.status == 200:
                                    audio_data = await resp.read()
                                    voice_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                    await bot.send_voice(telegram_id, voice_file)
                    
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


async def main():
    """Главная функция"""
    logger.info("Starting bot...")
    
    # Запускаем отправку сообщений от эксперта в фоне
    asyncio.create_task(send_expert_messages())
    
    # Запускаем бота
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
