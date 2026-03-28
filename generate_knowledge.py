"""
Скрипт генерації бази знань AI агента
Запускається один раз (або періодично) для аналізу всіх діалогів
і створення компактного "Керівництва експерта"

Використання:
  python generate_knowledge.py

Потрібні змінні середовища:
  SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY
"""

import os
import json
import asyncio
import aiohttp
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


async def get_all_dialogs():
    """Отримуємо всі завершені діалоги"""
    clients_result = supabase.table("clients").select("id, first_name, status").in_(
        "status", ["diagnostic_done", "transferred_to_sales"]
    ).execute()
    
    dialogs = []
    for client in (clients_result.data or []):
        msgs_result = supabase.table("messages").select(
            "direction, content_type, text_content, file_name"
        ).eq("client_id", client["id"]).order("created_at").execute()
        
        if msgs_result.data and len(msgs_result.data) > 5:
            dialog_text = format_dialog(client, msgs_result.data)
            dialogs.append(dialog_text)
    
    return dialogs


def format_dialog(client, messages):
    """Форматуємо діалог для аналізу"""
    lines = [f"=== Клієнт: {client['first_name']} | Статус: {client['status']} ==="]
    
    for msg in messages:
        role = "КЛІЄНТ" if msg["direction"] == "client" else "СВІТЛАНА"
        
        if msg["content_type"] == "text" and msg.get("text_content"):
            lines.append(f"{role}: {msg['text_content']}")
        elif msg["content_type"] == "photo":
            caption = f" ({msg['text_content']})" if msg.get("text_content") else ""
            lines.append(f"{role}: [фото{caption}]")
        elif msg["content_type"] == "voice":
            name = msg.get("file_name", "")
            if msg["direction"] == "expert" and msg.get("text_content"):
                lines.append(f"{role}: [голосове: {msg['text_content']}]")
            else:
                lines.append(f"{role}: [голосове повідомлення]")
        elif msg["content_type"] == "video":
            name = msg.get("text_content") or msg.get("file_name", "відео")
            lines.append(f"{role}: [відео: {name}]")
        elif msg["content_type"] == "video_note":
            lines.append(f"{role}: [відео-кружок]")
        elif msg["content_type"] == "document":
            lines.append(f"{role}: [документ: {msg.get('file_name', 'файл')}]")
    
    return "\n".join(lines)


async def analyze_with_claude(dialogs):
    """Аналізуємо діалоги через Claude і створюємо базу знань"""
    
    # Розбиваємо діалоги на групи по 3-4 (щоб не перевищити ліміт контексту)
    batch_size = 4
    batches = [dialogs[i:i+batch_size] for i in range(0, len(dialogs), batch_size)]
    
    all_analyses = []
    
    for i, batch in enumerate(batches):
        print(f"Аналізую пачку {i+1}/{len(batches)} ({len(batch)} діалогів)...")
        
        dialogs_text = "\n\n---\n\n".join(batch)
        
        prompt = f"""Проаналізуй ці реальні діалоги Світлани Гаврилюк з клієнтами з діагностики обличчя.

Витягни:
1. Типові фрази Світлани для кожної ситуації (вітання, подяка, фіксація часу, початок діагностики, комплімент, закриття)
2. Як вона описує кожну зону обличчя при різних проблемах (лоб, очі, носогубка, овал, шия) - конкретні формулювання
3. Як вона відповідає на часті питання клієнтів (про масаж, тейпування, косметологію, колаген, медикуб і тд)
4. Як вона переходить до продажу навчання
5. Як працює з запереченнями (клієнт не хоче дзвонити, хоче подумати, не має часу)
6. Особливості її стилю (скорочення, емоджі, довжина повідомлень)
7. Помилки яких вона НЕ робить (що вона ніколи не каже)

Діалоги:

{dialogs_text}

Відповідай компактно, без води. Тільки конкретні фрази і паттерни."""

        analysis = await call_claude(prompt)
        if analysis:
            all_analyses.append(analysis)
            print(f"  ✅ Пачка {i+1} проаналізована")
        else:
            print(f"  ❌ Помилка пачки {i+1}")
    
    # Тепер зводимо все в єдине компактне керівництво
    print("\nСтворюю єдине керівництво...")
    
    combined = "\n\n===\n\n".join(all_analyses)
    
    final_prompt = f"""На основі аналізу {len(dialogs)} реальних діалогів Світлани Гаврилюк, створи компактне КЕРІВНИЦТВО ДЛЯ AI-АГЕНТА.

Формат: чистий текст, без markdown, без списків з тире. Просто абзаци з конкретними фразами і правилами.

Розділи:
1. СТИЛЬ СПІЛКУВАННЯ — конкретні приклади фраз на кожну ситуацію
2. ДІАГНОСТИКА ПО ЗОНАХ — як описувати кожну зону при різних типах старіння, з конкретними формулюваннями
3. ЧАСТІ ПИТАННЯ — як відповідати на типові запитання клієнтів (з прикладами)
4. ПРОДАЖ — як переходити до навчання, як працювати з запереченнями
5. ТАБУ — чого НІКОЛИ не казати і не робити

Загальний обʼєм: до 3000 слів. Це має бути компактно але інформативно.

Аналізи діалогів:

{combined}"""

    knowledge = await call_claude(final_prompt)
    return knowledge


async def call_claude(prompt):
    """Виклик Claude API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 4000,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    print(f"API error {resp.status}: {error[:200]}")
                    return None
                
                data = await resp.json()
                return data["content"][0]["text"]
    except Exception as e:
        print(f"Error: {e}")
        return None


def save_knowledge(knowledge):
    """Зберігаємо базу знань в Supabase"""
    # Видаляємо стару версію
    supabase.table("ai_knowledge").delete().eq("key", "expert_guide").execute()
    
    # Зберігаємо нову
    supabase.table("ai_knowledge").insert({
        "key": "expert_guide",
        "content": knowledge
    }).execute()
    
    print(f"\n✅ База знань збережена в Supabase ({len(knowledge)} символів)")


async def main():
    print("🔍 Завантажую діалоги з Supabase...")
    dialogs = await get_all_dialogs()
    print(f"   Знайдено {len(dialogs)} завершених діалогів")
    
    if not dialogs:
        print("❌ Немає діалогів для аналізу")
        return
    
    print(f"\n🤖 Аналізую через Claude...")
    knowledge = await analyze_with_claude(dialogs)
    
    if knowledge:
        save_knowledge(knowledge)
        
        # Також зберігаємо локально для перевірки
        with open("knowledge_output.txt", "w", encoding="utf-8") as f:
            f.write(knowledge)
        print(f"📄 Також збережено в knowledge_output.txt")
    else:
        print("❌ Не вдалося створити базу знань")


if __name__ == "__main__":
    asyncio.run(main())
