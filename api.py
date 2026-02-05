"""
API сервер для веб-панели
Обрабатывает запросы от фронтенда и отправляет сообщения через бота
"""

import os
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from aiogram import Bot

load_dotenv()

# Инициализация
app = FastAPI(title="Diagnostic Bot API")

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

# Telegram Bot
bot = Bot(token=os.getenv('BOT_TOKEN'))


# =============================================
# МОДЕЛИ ДАННЫХ
# =============================================

class SendMessageRequest(BaseModel):
    client_id: str
    text: Optional[str] = None
    file_url: Optional[str] = None
    content_type: str = "text"


class UpdateStatusRequest(BaseModel):
    client_id: str
    status: str


class UpdateNotesRequest(BaseModel):
    client_id: str
    notes: str


class CreateReminderRequest(BaseModel):
    client_id: str
    reminder_text: str
    remind_at: datetime


class AddAuthorizedUserRequest(BaseModel):
    telegram_username: Optional[str] = None
    telegram_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None


# =============================================
# API ENDPOINTS
# =============================================

@app.get("/")
async def root():
    return {"status": "ok", "message": "Diagnostic Bot API"}


# --- Клиенты ---

@app.get("/api/clients")
async def get_clients():
    """Получить список всех клиентов"""
    try:
        result = supabase.table('clients').select('*').order('updated_at', desc=True).execute()
        return {"clients": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clients/{client_id}")
async def get_client(client_id: str):
    """Получить информацию о клиенте"""
    try:
        result = supabase.table('clients').select('*').eq('id', client_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Клиент не найден")
        return {"client": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/clients/{client_id}/status")
async def update_client_status(client_id: str, request: UpdateStatusRequest):
    """Обновить статус клиента"""
    valid_statuses = ['new', 'diagnostic_scheduled', 'diagnostic_done', 'call_scheduled', 'call_done']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Неверный статус. Допустимые: {valid_statuses}")
    
    try:
        result = supabase.table('clients').update({
            'status': request.status
        }).eq('id', client_id).execute()
        return {"success": True, "client": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/clients/{client_id}/notes")
async def update_client_notes(client_id: str, request: UpdateNotesRequest):
    """Обновить заметки по клиенту"""
    try:
        result = supabase.table('clients').update({
            'notes': request.notes
        }).eq('id', client_id).execute()
        return {"success": True, "client": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Сообщения ---

@app.get("/api/clients/{client_id}/messages")
async def get_messages(client_id: str):
    """Получить сообщения клиента"""
    try:
        result = supabase.table('messages').select('*').eq('client_id', client_id).order('created_at').execute()
        return {"messages": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clients/{client_id}/messages")
async def send_message(client_id: str, request: SendMessageRequest, background_tasks: BackgroundTasks):
    """Отправить сообщение клиенту"""
    try:
        # Получаем telegram_id клиента
        client_result = supabase.table('clients').select('telegram_id').eq('id', client_id).execute()
        if not client_result.data:
            raise HTTPException(status_code=404, detail="Клиент не найден")
        
        telegram_id = client_result.data[0]['telegram_id']
        
        # Отправляем в Telegram
        if request.text:
            await bot.send_message(telegram_id, request.text)
        if request.file_url and request.content_type == 'photo':
            await bot.send_photo(telegram_id, request.file_url)
        if request.file_url and request.content_type == 'document':
            await bot.send_document(telegram_id, request.file_url)
        
        # Сохраняем в базу
        message_data = {
            'client_id': client_id,
            'direction': 'expert',
            'content_type': request.content_type,
            'text_content': request.text,
            'file_url': request.file_url,
            'is_read': True
        }
        result = supabase.table('messages').insert(message_data).execute()
        
        return {"success": True, "message": result.data[0] if result.data else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/clients/{client_id}/messages/read")
async def mark_messages_read(client_id: str):
    """Отметить сообщения как прочитанные"""
    try:
        supabase.table('messages').update({
            'is_read': True
        }).eq('client_id', client_id).eq('direction', 'client').execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Напоминания ---

@app.get("/api/reminders")
async def get_reminders(completed: bool = False):
    """Получить список напоминаний"""
    try:
        query = supabase.table('reminders').select('*, clients(first_name, last_name, telegram_username)')
        if not completed:
            query = query.eq('is_completed', False)
        result = query.order('remind_at').execute()
        return {"reminders": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clients/{client_id}/reminders")
async def get_client_reminders(client_id: str):
    """Получить напоминания по клиенту"""
    try:
        result = supabase.table('reminders').select('*').eq('client_id', client_id).order('remind_at').execute()
        return {"reminders": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reminders")
async def create_reminder(request: CreateReminderRequest):
    """Создать напоминание"""
    try:
        reminder_data = {
            'client_id': request.client_id,
            'reminder_text': request.reminder_text,
            'remind_at': request.remind_at.isoformat(),
            'is_completed': False
        }
        result = supabase.table('reminders').insert(reminder_data).execute()
        return {"success": True, "reminder": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str):
    """Отметить напоминание как выполненное"""
    try:
        result = supabase.table('reminders').update({
            'is_completed': True
        }).eq('id', reminder_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Авторизованные пользователи ---

@app.get("/api/authorized-users")
async def get_authorized_users():
    """Получить список авторизованных пользователей"""
    try:
        result = supabase.table('authorized_users').select('*').order('created_at', desc=True).execute()
        return {"users": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/authorized-users")
async def add_authorized_user(request: AddAuthorizedUserRequest):
    """Добавить авторизованного пользователя"""
    try:
        user_data = {
            'telegram_username': request.telegram_username.lower().replace('@', '') if request.telegram_username else None,
            'telegram_id': request.telegram_id,
            'email': request.email,
            'phone': request.phone
        }
        # Убираем None значения
        user_data = {k: v for k, v in user_data.items() if v is not None}
        
        result = supabase.table('authorized_users').insert(user_data).execute()
        return {"success": True, "user": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/authorized-users/{user_id}")
async def remove_authorized_user(user_id: str):
    """Удалить авторизованного пользователя"""
    try:
        supabase.table('authorized_users').delete().eq('id', user_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Аналитика ---

@app.get("/api/analytics")
async def get_analytics():
    """Получить аналитику по воронке"""
    try:
        # Количество клиентов по статусам
        clients = supabase.table('clients').select('status').execute()
        
        status_counts = {
            'new': 0,
            'diagnostic_scheduled': 0,
            'diagnostic_done': 0,
            'call_scheduled': 0,
            'call_done': 0
        }
        
        for client in clients.data:
            status = client['status']
            if status in status_counts:
                status_counts[status] += 1
        
        # Общее количество
        total = len(clients.data)
        
        # Непрочитанные сообщения
        unread = supabase.table('messages').select('id', count='exact').eq('direction', 'client').eq('is_read', False).execute()
        
        # Активные напоминания на сегодня
        today = datetime.now().date().isoformat()
        reminders_today = supabase.table('reminders').select('id', count='exact').eq('is_completed', False).lte('remind_at', today + 'T23:59:59').execute()
        
        return {
            "total_clients": total,
            "status_counts": status_counts,
            "unread_messages": unread.count if unread.count else 0,
            "reminders_today": reminders_today.count if reminders_today.count else 0,
            "conversion_rates": {
                "to_diagnostic": round(status_counts['diagnostic_done'] / total * 100, 1) if total > 0 else 0,
                "to_call": round(status_counts['call_done'] / total * 100, 1) if total > 0 else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================
# ЗАПУСК СЕРВЕРА
# =============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
