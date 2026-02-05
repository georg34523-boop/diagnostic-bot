"""
Telegram бот для диагностики
Принимает сообщения от клиентов и пересылает в веб-панель
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import ContentType
from dotenv import load_dotenv
from supabase import create_client, Client

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Инициализация бота и диспетчера
bot = Bot(token=os.getenv('BOT_TOKEN'))
dp = Dispatcher()

# Инициализация Supabase
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)


# =============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =============================================

async def is_user_authorized(telegram_id: int, username: Optional[str] = None) -> bool:
    """Проверяем, авторизован ли пользователь (оплатил)"""
    try:
        # Проверяем по telegram_id
        result = supabase.table('authorized_users').select('*').eq('telegram_id', telegram_id).execute()
        if result.data:
            return True
        
        # Проверяем по username если есть
        if username:
            result = supabase.table('authorized_users').select('*').eq('telegram_username', username.lower()).execute()
            if result.data:
                # Обновляем telegram_id для будущих проверок
                supabase.table('authorized_users').update({
                    'telegram_id': telegram_id
                }).eq('telegram_username', username.lower()).execute()
                return True
        
        return False
    except Exception as e:
        logger.error(f"Ошибка проверки авторизации: {e}")
        return False


async def get_or_create_client(telegram_id: int, user: types.User) -> Optional[dict]:
    """Получаем или создаём клиента в базе"""
    try:
        # Проверяем существует ли клиент
        result = supabase.table('clients').select('*').eq('telegram_id', telegram_id).execute()
        
        if result.data:
            return result.data[0]
        
        # Создаём нового клиента
        new_client = {
            'telegram_id': telegram_id,
            'telegram_username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'status': 'new'
        }
        
        result = supabase.table('clients').insert(new_client).execute()
        logger.info(f"Создан новый клиент: {telegram_id}")
        return result.data[0] if result.data else None
        
    except Exception as e:
        logger.error(f"Ошибка создания клиента: {e}")
        return None


async def save_message(client_id: str, direction: str, content_type: str, 
                       text_content: Optional[str] = None, 
                       file_url: Optional[str] = None,
                       file_name: Optional[str] = None,
                       telegram_file_id: Optional[str] = None) -> Optional[dict]:
    """Сохраняем сообщение в базу"""
    try:
        message_data = {
            'client_id': client_id,
            'direction': direction,
            'content_type': content_type,
            'text_content': text_content,
            'file_url': file_url,
            'file_name': file_name,
            'telegram_file_id': telegram_file_id,
            'is_read': False
        }
        
        result = supabase.table('messages').insert(message_data).execute()
        return result.data[0] if result.data else None
        
    except Exception as e:
        logger.error(f"Ошибка сохранения сообщения: {e}")
        return None


async def upload_file_to_storage(file: types.File, bot: Bot, file_name: str) -> Optional[str]:
    """Загружаем файл в Supabase Storage"""
    try:
        # Скачиваем файл
        file_bytes = await bot.download_file(file.file_path)
        file_content = file_bytes.read()
        
        # Генерируем уникальное имя
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        storage_path = f"uploads/{timestamp}_{file_name}"
        
        # Загружаем в Supabase Storage
        result = supabase.storage.from_('diagnostic-files').upload(
            storage_path,
            file_content
        )
        
        # Получаем публичный URL
        public_url = supabase.storage.from_('diagnostic-files').get_public_url(storage_path)
        return public_url
        
    except Exception as e:
        logger.error(f"Ошибка загрузки файла: {e}")
        return None


# =============================================
# ОБРАБОТЧИКИ КОМАНД
# =============================================

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    """Обработка команды /start"""
    user = message.from_user
    
    # Проверяем авторизацию
    if not await is_user_authorized(user.id, user.username):
        await message.answer(
            "👋 Добро пожаловать!\n\n"
            "К сожалению, у вас пока нет доступа к диагностике.\n\n"
            "Если вы уже оплатили — напишите в поддержку, и мы добавим вас в систему."
        )
        return
    
    # Создаём или получаем клиента
    client = await get_or_create_client(user.id, user)
    
    if client:
        await message.answer(
            "👋 Добро пожаловать в бот диагностики!\n\n"
            "Здесь вы можете:\n"
            "📸 Отправить фото для диагностики\n"
            "💬 Задать вопросы эксперту\n"
            "📄 Получить рекомендации\n\n"
            "Просто напишите сообщение или отправьте фото, и эксперт вам ответит!"
        )
    else:
        await message.answer(
            "Произошла ошибка. Пожалуйста, попробуйте позже или напишите в поддержку."
        )


@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    """Обработка команды /help"""
    await message.answer(
        "📋 Как пользоваться ботом:\n\n"
        "1. Отправьте фото лица для диагностики\n"
        "2. Эксперт проанализирует и ответит\n"
        "3. Получите рекомендации\n"
        "4. Запишитесь на звонок для детального разбора\n\n"
        "Вы можете отправлять:\n"
        "📸 Фото\n"
        "🎥 Видео\n"
        "🎤 Голосовые сообщения\n"
        "📄 Документы\n"
        "💬 Текстовые сообщения"
    )


# =============================================
# ОБРАБОТЧИКИ СООБЩЕНИЙ
# =============================================

@dp.message(F.content_type == ContentType.TEXT)
async def handle_text(message: types.Message):
    """Обработка текстовых сообщений"""
    user = message.from_user
    
    # Проверяем авторизацию
    if not await is_user_authorized(user.id, user.username):
        await message.answer(
            "⚠️ У вас нет доступа к боту.\n"
            "Если вы уже оплатили — напишите в поддержку."
        )
        return
    
    # Получаем или создаём клиента
    client = await get_or_create_client(user.id, user)
    if not client:
        await message.answer("Произошла ошибка. Попробуйте позже.")
        return
    
    # Сохраняем сообщение
    await save_message(
        client_id=client['id'],
        direction='client',
        content_type='text',
        text_content=message.text
    )
    
    await message.answer(
        "✅ Сообщение получено!\n"
        "Эксперт ответит вам в ближайшее время."
    )


@dp.message(F.content_type == ContentType.PHOTO)
async def handle_photo(message: types.Message):
    """Обработка фото"""
    user = message.from_user
    
    if not await is_user_authorized(user.id, user.username):
        await message.answer("⚠️ У вас нет доступа к боту.")
        return
    
    client = await get_or_create_client(user.id, user)
    if not client:
        await message.answer("Произошла ошибка. Попробуйте позже.")
        return
    
    # Берём фото максимального размера
    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    
    # Загружаем в storage
    file_url = await upload_file_to_storage(file, bot, f"photo_{photo.file_id}.jpg")
    
    # Сохраняем сообщение
    await save_message(
        client_id=client['id'],
        direction='client',
        content_type='photo',
        text_content=message.caption,
        file_url=file_url,
        telegram_file_id=photo.file_id
    )
    
    await message.answer(
        "📸 Фото получено!\n"
        "Эксперт проанализирует и ответит вам."
    )


@dp.message(F.content_type == ContentType.VIDEO)
async def handle_video(message: types.Message):
    """Обработка видео"""
    user = message.from_user
    
    if not await is_user_authorized(user.id, user.username):
        await message.answer("⚠️ У вас нет доступа к боту.")
        return
    
    client = await get_or_create_client(user.id, user)
    if not client:
        await message.answer("Произошла ошибка. Попробуйте позже.")
        return
    
    video = message.video
    file = await bot.get_file(video.file_id)
    
    file_url = await upload_file_to_storage(file, bot, f"video_{video.file_id}.mp4")
    
    await save_message(
        client_id=client['id'],
        direction='client',
        content_type='video',
        text_content=message.caption,
        file_url=file_url,
        telegram_file_id=video.file_id
    )
    
    await message.answer("🎥 Видео получено! Эксперт скоро ответит.")


@dp.message(F.content_type == ContentType.VOICE)
async def handle_voice(message: types.Message):
    """Обработка голосовых сообщений"""
    user = message.from_user
    
    if not await is_user_authorized(user.id, user.username):
        await message.answer("⚠️ У вас нет доступа к боту.")
        return
    
    client = await get_or_create_client(user.id, user)
    if not client:
        await message.answer("Произошла ошибка. Попробуйте позже.")
        return
    
    voice = message.voice
    file = await bot.get_file(voice.file_id)
    
    file_url = await upload_file_to_storage(file, bot, f"voice_{voice.file_id}.ogg")
    
    await save_message(
        client_id=client['id'],
        direction='client',
        content_type='voice',
        file_url=file_url,
        telegram_file_id=voice.file_id
    )
    
    await message.answer("🎤 Голосовое сообщение получено!")


@dp.message(F.content_type == ContentType.DOCUMENT)
async def handle_document(message: types.Message):
    """Обработка документов"""
    user = message.from_user
    
    if not await is_user_authorized(user.id, user.username):
        await message.answer("⚠️ У вас нет доступа к боту.")
        return
    
    client = await get_or_create_client(user.id, user)
    if not client:
        await message.answer("Произошла ошибка. Попробуйте позже.")
        return
    
    document = message.document
    file = await bot.get_file(document.file_id)
    
    file_url = await upload_file_to_storage(file, bot, document.file_name or f"doc_{document.file_id}")
    
    await save_message(
        client_id=client['id'],
        direction='client',
        content_type='document',
        text_content=message.caption,
        file_url=file_url,
        file_name=document.file_name,
        telegram_file_id=document.file_id
    )
    
    await message.answer("📄 Документ получен!")


# =============================================
# ФУНКЦИЯ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ ИЗ ВЕБ-ПАНЕЛИ
# =============================================

async def send_message_to_client(telegram_id: int, text: str = None, 
                                  photo_url: str = None, 
                                  document_url: str = None) -> bool:
    """
    Отправка сообщения клиенту из веб-панели
    Вызывается через API
    """
    try:
        if text:
            await bot.send_message(telegram_id, text)
        if photo_url:
            await bot.send_photo(telegram_id, photo_url)
        if document_url:
            await bot.send_document(telegram_id, document_url)
        return True
    except Exception as e:
        logger.error(f"Ошибка отправки сообщения клиенту {telegram_id}: {e}")
        return False


# =============================================
# ЗАПУСК БОТА
# =============================================

async def main():
    """Главная функция запуска бота"""
    logger.info("Запуск бота...")
    
    # Удаляем webhook если был
    await bot.delete_webhook(drop_pending_updates=True)
    
    # Запускаем polling
    await dp.start_polling(bot)


if __name__ == '__main__':
    asyncio.run(main())
