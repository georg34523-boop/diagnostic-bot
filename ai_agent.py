"""
AI Agent для B$W Diagnostik CRM
Автономний агент для проведення діагностик обличчя
Модель: Claude Haiku 4.5
"""

import os
import logging
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = "claude-haiku-4-5-20251001"
KYIV_TZ = ZoneInfo("Europe/Kyiv")


# ==================== СИСТЕМНИЙ ПРОМПТ ====================

SYSTEM_PROMPT = """Ти — Світлана Гаврилюк, експерт з діагностики обличчя та природного омолодження. Спілкуєшся з клієнтами через Telegram. Відповідай українською.

## ТВІЙ СТИЛЬ (дуже важливо!)
Пиши ТОЧНО як жива людина в месенджері. Ось приклади ТВОЇХ реальних повідомлень:

"Дякую за фото🫂 Все перегляну."
"Фіксую 🫂"
"Переглядаю ваші фото і за хвилинку повертаюсь в чат 😊"
"Супер👍"
"Це супер, що ви вже працюєте 👌"
"Звісно задавайте питання, чи голосовими чи текстом. Як вам зручно"
"Рада що було корисно ♥️"
"В разі чого я тут на зв'язку 🌸"
"Якщо будуть якісь питання, пишіть я на зв'язку 🌸"
"Гарного вечора 🫂"

## ЗАБОРОНИ (щоб не виглядати як AI):
НЕ ВИКОРИСТОВУЙ НІКОЛИ:
- Довге тире (—), використовуй коротке (-) або кому
- Марковані списки з крапками (•) чи тире
- Нумеровані списки (1. 2. 3.)
- Жирний текст чи форматування markdown
- Слова: "безумовно", "зрозуміло", "чудово", "абсолютно", "фактично", "по суті", "насамперед", "зокрема", "однозначно"
- Занадто ідеальні та довгі речення
- Кілька емоджі підряд

ЗАМІСТЬ ЦЬОГО:
- Пиши просто і природно
- Короткі речення, 1-3 речення на повідомлення
- Іноді можна зробити помилку або скорочення як жива людина
- Емоджі використовуй помірно, не в кожному повідомленні
- Розбивай думку на кілька окремих повідомлень

## ПРИКЛАДИ ТВОЇХ ДІАГНОСТИК (з реальних діалогів):

### Приклад визначення типу старіння:
"По фото бачу, що у вас комбінований тип старіння, але з перевагою деформаційно-набрякового. Тобто основні зміни йдуть не від зморшок, а від набряків і того, що тканини трохи зміщуються вниз."

"У вас м'язовий тип старіння (ближче до нормального, без деформації). У вас немає «сповзання» тканин вниз, контур щелепи чіткий, щоки не важкі."

"По типу старіння у вас формується комбінований тип: мімічний + деформаційний. Це означає, що поєднуються дві основні причини: напруга м'язів і поступове зміщення тканин вниз через набряк."

### Приклад розбору по зонах:
ЛОБ: "Лоб і верх обличчя виглядають досить спокійно, без критичних змін, це плюс. Є напруга в міжбрівці. Потрібно працювати над розслабленням, масаж апоневрозу, чола та скронь."

ОЧІ: "Під очима видно легку тінь і м'якість тканин. Це не виглядає як сильний набряк, швидше як тонка шкіра, невелика втома зони. Працювати тут треба дуже делікатно: легкий лімфодренаж, розслаблення скронь."

НОСОГУБКА: "По середній третині бачу, що щоки самі по собі не важкі, але є легка тенденція до поглиблення носогубної зони. Якщо працювати лише по самій носогубці, ефект буде слабкий. Потрібно розслабляти жувальні м'язи, працювати з виличною зоною."

ОВАЛ: "По овалу обличчя поки ситуація досить хороша. Контур є, але вже видно легкий натяк на втрату чіткості в нижній третині. Значний вплив має шия, платизма, жувальні м'язи."

ШИЯ: "Шия у вас гарна і довга, але саме через таку будову будь-яка напруга там дуже швидко відбивається на обличчі. Тому робота з шиєю для вас це не «додатково», а база."

### Приклад рекомендацій:
"Масаж краще робити на постійній основі, приділяючи мінімум часу але щодня. Бо тут спрацьовує накопичувальний ефект."

"Не обов'язково працювати зі всіма зонами щодня, можна по черзі. Сьогодні чоло, апоневроз. Завтра носогубку і жувальні м'язи і тд."

"У вашому випадку масаж і тейпування будуть працювати дуже добре, бо основна причина змін це не шкіра, а напруга м'язів і місцями застій рідини."

"Якщо коротко, масаж дає рух і зміни, а тейпи утримують результат."

### Приклад відповіді на питання про косметологію:
"Особисто для себе люблю плазмотерапію, мікротоки. Покращує тонус і якість шкіри. Але це як додатковий варіант. Основна робота з м'язами)"

### Приклад закриття на продаж:
"Ці техніки, які є в каналі можна робити, вони не складні і безпечні."
[потім шаблон "text_pro_navchannia"]
[якщо клієнт зацікавлений — шаблон "text_peredaiu_pomichnytsi"]

### Приклад роботи з запереченнями:
Клієнт не хоче дзвонити: "Але якщо вам зручніше, то скажу помічниці хай зв'яжеться з вами перепискою 😊"
Клієнт хоче спочатку спробувати: "Звичайно 🫂 в разі чого я на зв'язку. Але також хотіла зазначити, що зараз для дівчат з діагностики я даю більш вигідні умови на навчання 🫂"

## ФЛОУ ДІАГНОСТИКИ

### ФАЗА 1: ПРИЙМАННЯ
Коли клієнт надсилає фото і опис:
- Подякуй за фото
- Запропонуй 2 конкретні часи на діагностику (сьогодні або завтра)
- Діагностика від 20 до 30 хвилин у форматі переписки

Коли клієнт обрав час:
- {"action": "schedule", "date": "YYYY-MM-DD", "time": "HH:MM"}

### ФАЗА 2: ДІАГНОСТИКА
Крок 1: "Переглядаю ваші фото і за хвилинку повертаюсь в чат 😊"

Крок 2: Визнач тип старіння. Пиши як у прикладах вище, НЕ списком.

Крок 3: Розбір по зонах (КОЖНА зона окремим повідомленням):
- Лоб/міжбрівка → {"action": "send_template", "template": "video_cholo_mizhbrivka"} → "У відео детальніше ⬆️"
- Очі (якщо є проблеми) → відповідне відео
- Носогубка → {"action": "send_template", "template": "video_nosohubka"}
- Овал/підборіддя/шия → {"action": "send_template", "template": "video_oval_pidboriddia"}

Крок 4: {"action": "send_template", "template": "voice_nabriaky"}

Крок 5: {"action": "send_template", "template": "voice_yak_pracyuete"}

Крок 6: Після відповіді клієнта, рекомендації + ютуб посилання:
{"action": "send_template", "template": "youtube_masazh_nabriaky"}
{"action": "send_template", "template": "youtube_rutyna_nabriaky"}
{"action": "send_template", "template": "voice_pro_masazhi"}

Крок 7: Канал:
{"action": "send_template", "template": "link_kanal_face_mood"}
{"action": "send_template", "template": "text_pro_kanal"}

Крок 8: Відповідай на питання клієнта

### ФАЗА 3: ПРОДАЖ
{"action": "send_template", "template": "text_pro_navchannia"}
Якщо цікаво → {"action": "send_template", "template": "text_peredaiu_pomichnytsi"}
Коли дав номер → {"action": "transfer_to_sales", "phone": "номер", "call_time": "час"}

## ФОРМАТ ВІДПОВІДІ
ТІЛЬКИ JSON:
{
  "messages": [
    {"type": "text", "content": "Текст повідомлення"},
    {"type": "action", "action": "send_template", "template": "template_id"},
    {"type": "text", "content": "Наступне повідомлення"}
  ]
}

## ШАБЛОНИ:
video_cholo_mizhbrivka, video_husiachi_lapky, video_oval_pidboriddia, video_mishky_pid_ochyma, video_nosohubka, video_navysli_poviky, video_kutyky_hub
voice_nabriaky, voice_pro_masazhi, voice_yak_pracyuete
youtube_masazh_nabriaky, youtube_rutyna_nabriaky, youtube_aponevroze
link_kanal_face_mood, link_kanal_materialy, text_pro_kanal, text_pro_navchannia, text_peredaiu_pomichnytsi

## ДУЖЕ ВАЖЛИВО:
1. Ти Світлана, НЕ AI. Ніколи не кажи що ти бот або штучний інтелект.
2. НЕ давай медичних порад. Біль → порекомендуй лікаря.
3. НЕ вигадуй техніки. Направляй на відео і канал.
4. Пиши КОРОТКО. Максимум 2-4 речення на одне повідомлення.
5. Ціни навчання → помічниця розповість.
6. Якщо не знаєш → "уточню і повернусь".
7. НЕ використовуй формальний стиль. Пиши як подруга яка є експертом.
"""


# ==================== МАППІНГ ШАБЛОНІВ ====================

TEMPLATE_MAP = {
    # Відео
    "video_cholo_mizhbrivka": "Відео про чоло і міжбрівку",
    "video_husiachi_lapky": "Video husiachi lapky",
    "video_oval_pidboriddia": "oval 2 pidboriddia",
    "video_mishky_pid_ochyma": "mishky pid ochyma",
    "video_nosohubka": "nosohubka",
    "video_navysli_poviky": "navysli poviky / asymetriia povik",
    "video_kutyky_hub": "kutyky hub opusheni",
    # Голосові
    "voice_nabriaky": "holosove pro nabriaky",
    "voice_pro_masazhi": "Holosove pro masazhi",
    "voice_yak_pracyuete": "Як працюєте з обличчям",
    # Текстові
    "youtube_masazh_nabriaky": "masazh vid nabriakiv / shvydka rutynа",
    "youtube_rutyna_nabriaky": "moia rutyna vid nabriakiv",
    "youtube_aponevroze": "masazh aponevrozu holovy / zapys efiru",
    "link_kanal_face_mood": "kanal FACE MOOD",
    "link_kanal_materialy": "kanal materialy",
    "text_pro_kanal": "Текст про канал Face Mood",
    "text_pro_navchannia": "Також я маю навчання",
    "text_peredaiu_pomichnytsi": "Про навчання/ передам контакт помічниці",
}


# ==================== AI ФУНКЦІЇ ====================

async def get_ai_response(client_data: dict, messages_history: list, templates: list, supabase_client) -> list:
    """
    Отримати відповідь від AI агента
    
    Returns: список дій [{type: "text", content: "..."}, {type: "template", template_title: "..."}, ...]
    """
    if not ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY not set")
        return []
    
    try:
        import aiohttp
        
        # Формуємо історію діалогу для Claude
        conversation = format_conversation(client_data, messages_history)
        
        # Додаємо контекст часу
        now_kyiv = datetime.now(KYIV_TZ)
        time_context = f"\n\nПоточний час за Києвом: {now_kyiv.strftime('%d.%m.%Y %H:%M')}, {['понеділок','вівторок','середа','четвер','п`ятниця','субота','неділя'][now_kyiv.weekday()]}."
        
        # Визначаємо фазу діалогу
        phase = determine_phase(messages_history)
        phase_context = f"\nПоточна фаза діалогу: {phase}"
        
        # Завантажуємо базу знань з Supabase (якщо є)
        knowledge_context = ""
        try:
            kb_result = supabase_client.table("ai_knowledge").select("content").eq("key", "expert_guide").execute()
            if kb_result.data and kb_result.data[0].get("content"):
                knowledge_context = f"\n\n## БАЗА ЗНАНЬ (з аналізу реальних діалогів):\n{kb_result.data[0]['content']}"
        except Exception as kb_err:
            logger.warning(f"Failed to load knowledge base: {kb_err}")
        
        full_system = SYSTEM_PROMPT + knowledge_context + time_context + phase_context
        
        # API запит до Claude
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": AI_MODEL,
                    "max_tokens": 2000,
                    "system": full_system,
                    "messages": conversation
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Claude API error {resp.status}: {error_text}")
                    return []
                
                data = await resp.json()
                response_text = data["content"][0]["text"]
                logger.info(f"AI response: {response_text[:200]}...")
                
                # Парсимо відповідь
                actions = parse_ai_response(response_text, templates)
                return actions
                
    except Exception as e:
        logger.error(f"AI agent error: {e}")
        return []


def format_conversation(client_data: dict, messages_history: list) -> list:
    """Форматуємо історію діалогу для Claude API"""
    conversation = []
    
    # Додаємо контекст клієнта
    client_info = f"[Клієнт: {client_data.get('first_name', 'Невідомий')}"
    if client_data.get('phone'):
        client_info += f", тел: {client_data['phone']}"
    client_info += f", статус: {client_data.get('status', 'new')}]"
    
    # Збираємо повідомлення
    for msg in messages_history:
        role = "user" if msg.get("direction") == "client" else "assistant"
        
        content = ""
        if msg.get("content_type") == "text" and msg.get("text_content"):
            content = msg["text_content"]
        elif msg.get("content_type") == "photo":
            content = "[Клієнт надіслав фото]"
            if msg.get("text_content"):
                content += f" з підписом: {msg['text_content']}"
        elif msg.get("content_type") == "voice":
            if msg.get("text_content") and msg["text_content"].startswith("[Голосове]"):
                # Транскрибоване голосове
                content = msg["text_content"]
            elif msg.get("text_content"):
                content = msg["text_content"]
            else:
                content = "[Голосове повідомлення без транскрибації]"
        elif msg.get("content_type") == "video":
            content = f"[Відправлено відео: {msg.get('text_content', msg.get('file_name', 'відео'))}]"
        elif msg.get("content_type") == "video_note":
            if msg.get("text_content") and msg["text_content"].startswith("[Відео-кружок]"):
                content = msg["text_content"]
            elif msg.get("text_content"):
                content = msg["text_content"]
            else:
                content = "[Відео-кружок без транскрибації]"
        elif msg.get("content_type") == "document":
            content = f"[Документ: {msg.get('file_name', 'файл')}]"
        else:
            content = msg.get("text_content", "[повідомлення]")
        
        if not content:
            continue
            
        # Додаємо контекст клієнта до першого повідомлення
        if role == "user" and not conversation:
            content = client_info + "\n" + content
        
        # Claude API вимагає чергування ролей
        if conversation and conversation[-1]["role"] == role:
            conversation[-1]["content"] += "\n" + content
        else:
            conversation.append({"role": role, "content": content})
    
    # Якщо останнє повідомлення не від user — щось пішло не так
    if not conversation or conversation[-1]["role"] != "user":
        return conversation
    
    return conversation


def determine_phase(messages_history: list) -> str:
    """Визначаємо поточну фазу діалогу"""
    expert_messages = [m for m in messages_history if m.get("direction") == "expert"]
    client_messages = [m for m in messages_history if m.get("direction") == "client"]
    
    has_photos = any(m.get("content_type") == "photo" for m in client_messages)
    total_expert = len(expert_messages)
    
    # Перевіряємо чи була вже діагностика
    diagnostic_keywords = ["тип старіння", "деформаційн", "м'язов", "набряков", "комбінован"]
    had_diagnostic = any(
        any(kw in (m.get("text_content") or "").lower() for kw in diagnostic_keywords)
        for m in expert_messages
    )
    
    # Перевіряємо чи було запропоновано навчання
    had_sales = any(
        "навчання" in (m.get("text_content") or "").lower() and "супровод" in (m.get("text_content") or "").lower()
        for m in expert_messages
    )
    
    if had_sales:
        return "ФАЗА 3 — ПРОДАЖ. Клієнт вже отримав діагностику. Зараз етап закриття на навчання."
    elif had_diagnostic:
        return "ФАЗА 2 — ДІАГНОСТИКА В ПРОЦЕСІ. Продовжуй діагностику, відповідай на питання."
    elif has_photos and total_expert > 0:
        return "ФАЗА 1 — ПРИЙМАННЯ. Фото отримано, потрібно узгодити час діагностики."
    elif has_photos:
        return "ФАЗА 1 — ПРИЙМАННЯ. Клієнт надіслав фото. Подякуй і запропонуй час діагностики."
    else:
        return "ФАЗА 1 — ПОЧАТОК. Клієнт щойно прийшов. Попроси надіслати фото обличчя (анфас, профіль, 3/4) і описати що турбує."


def parse_ai_response(response_text: str, templates: list) -> list:
    """Парсимо відповідь Claude і перетворюємо в список дій"""
    actions = []
    
    try:
        # Пробуємо розпарсити JSON
        # Видаляємо можливі markdown блоки
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        
        data = json.loads(cleaned)
        
        if "messages" in data:
            for msg in data["messages"]:
                if msg.get("type") == "text" and msg.get("content"):
                    actions.append({"type": "text", "content": msg["content"]})
                elif msg.get("type") == "action":
                    action = msg.get("action", "")
                    if action == "send_template":
                        template_id = msg.get("template", "")
                        template_title = TEMPLATE_MAP.get(template_id, template_id)
                        # Знаходимо шаблон в базі
                        matched = find_template(template_title, templates)
                        if matched:
                            actions.append({"type": "template", "template": matched})
                        else:
                            logger.warning(f"Template not found: {template_id} -> {template_title}")
                    elif action == "schedule":
                        actions.append({
                            "type": "schedule",
                            "date": msg.get("date", ""),
                            "time": msg.get("time", "")
                        })
                    elif action == "transfer_to_sales":
                        actions.append({
                            "type": "transfer_to_sales",
                            "phone": msg.get("phone", ""),
                            "call_time": msg.get("call_time", "")
                        })
                    elif action == "propose_dates":
                        actions.append({"type": "propose_dates"})
    except json.JSONDecodeError:
        # Якщо не JSON — просто текст
        logger.warning(f"Failed to parse AI JSON, using as text")
        if response_text.strip():
            actions.append({"type": "text", "content": response_text.strip()})
    
    return actions


def find_template(title_or_content: str, templates: list) -> dict:
    """Знаходимо шаблон за назвою або контентом"""
    title_lower = title_or_content.lower().strip()
    
    for t in templates:
        if t.get("title", "").lower().strip() == title_lower:
            return t
        if t.get("content", "").lower().strip() == title_lower:
            return t
    
    # Часткове співпадіння
    for t in templates:
        if title_lower in t.get("title", "").lower() or title_lower in t.get("content", "").lower():
            return t
        if t.get("title", "").lower() in title_lower:
            return t
    
    return None


async def process_ai_actions(actions: list, client: dict, bot, supabase_client, bot_id: str) -> list:
    """
    Обробляємо дії AI агента — відправляємо повідомлення клієнту
    Повертає список відправлених повідомлень
    """
    sent_messages = []
    telegram_id = client.get("telegram_id")
    client_id = client.get("id")
    
    if not telegram_id or not client_id:
        return sent_messages
    
    for action in actions:
        try:
            if action["type"] == "text":
                # Зберігаємо в базу як повідомлення експерта
                msg_data = {
                    "client_id": client_id,
                    "direction": "expert",
                    "content_type": "text",
                    "text_content": action["content"],
                    "is_read": True
                }
                result = supabase_client.table("messages").insert(msg_data).execute()
                # Повідомлення буде відправлено через send_expert_messages loop
                if result.data:
                    # Позначаємо як непрочитане щоб send_expert_messages відправив
                    supabase_client.table("messages").update({"is_read": False}).eq("id", result.data[0]["id"]).execute()
                    sent_messages.append(result.data[0])
                    
            elif action["type"] == "template":
                template = action["template"]
                # Зберігаємо в базу
                msg_data = {
                    "client_id": client_id,
                    "direction": "expert",
                    "content_type": template.get("type", "text"),
                    "text_content": template.get("content", ""),
                    "file_url": template.get("file_url"),
                    "file_name": "Медіа",
                    "is_read": False
                }
                result = supabase_client.table("messages").insert(msg_data).execute()
                if result.data:
                    sent_messages.append(result.data[0])
                    
            elif action["type"] == "schedule":
                # Створюємо нагадування
                date_str = action.get("date", "")
                time_str = action.get("time", "")
                if date_str and time_str:
                    remind_at = f"{date_str}T{time_str}:00+02:00"
                    supabase_client.table("reminders").insert({
                        "client_id": client_id,
                        "reminder_text": f"Діагностика о {time_str}",
                        "remind_at": remind_at,
                        "is_completed": False,
                        "client_notified": False
                    }).execute()
                    
                    # Оновлюємо статус клієнта
                    supabase_client.table("clients").update({
                        "status": "diagnostic_scheduled"
                    }).eq("id", client_id).execute()
                    
                    logger.info(f"Scheduled diagnostic for {client_id}: {date_str} {time_str}")
                    
            elif action["type"] == "transfer_to_sales":
                phone = action.get("phone", "")
                call_time = action.get("call_time", "")
                
                # Зберігаємо номер телефону
                if phone:
                    supabase_client.table("clients").update({
                        "phone": phone
                    }).eq("id", client_id).execute()
                
                # Оновлюємо статус
                supabase_client.table("clients").update({
                    "status": "transferred_to_sales"
                }).eq("id", client_id).execute()
                
                # Відправляємо в Google Sheets (як кнопка "Передати в продажі" в CRM)
                try:
                    # Отримуємо google_sheet_url бота
                    bot_result = supabase_client.table("bots").select("google_sheet_url").eq("id", bot_id).execute()
                    google_sheet_url = bot_result.data[0].get("google_sheet_url") if bot_result.data else None
                    
                    if google_sheet_url:
                        import aiohttp as _aiohttp
                        
                        # Отримуємо повні дані клієнта
                        client_full = supabase_client.table("clients").select("*").eq("id", client_id).execute()
                        c = client_full.data[0] if client_full.data else client
                        
                        sales_data = {
                            "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                            "phone": phone or c.get("phone", ""),
                            "username": c.get("telegram_username", ""),
                            "email": c.get("email", ""),
                            "status": "Передано у ВП",
                            "comment": f"AI діагностика. Зателефонувати: {call_time}" if call_time else "AI діагностика",
                            "date": datetime.now(KYIV_TZ).strftime("%d.%m.%Y %H:%M")
                        }
                        
                        async with _aiohttp.ClientSession() as gs_session:
                            await gs_session.post(google_sheet_url, json=sales_data, timeout=_aiohttp.ClientTimeout(total=10))
                        
                        logger.info(f"Sent to Google Sheets: {c.get('first_name')}, phone: {phone}")
                    else:
                        logger.warning(f"No google_sheet_url for bot {bot_id}")
                except Exception as gs_err:
                    logger.warning(f"Google Sheets error: {gs_err}")
                
                logger.info(f"Transferred to sales: {client_id}, phone: {phone}, call: {call_time}")
                
            # Невелика пауза між повідомленнями для природності
            import asyncio
            await asyncio.sleep(1.5)
            
        except Exception as e:
            logger.error(f"Error processing AI action: {e}")
    
    # Оновлюємо updated_at клієнта
    supabase_client.table("clients").update({
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", client_id).execute()
    
    return sent_messages


async def is_ai_enabled_for_client(client_id: str, supabase_client) -> bool:
    """Перевіряємо чи включений AI для цього клієнта"""
    result = supabase_client.table("clients").select("ai_enabled").eq("id", client_id).execute()
    if result.data:
        return result.data[0].get("ai_enabled", False)
    return False


async def get_templates_for_bot(bot_id: str, supabase_client) -> list:
    """Отримуємо всі шаблони для бота"""
    result = supabase_client.table("message_templates").select("*").eq("bot_id", bot_id).execute()
    return result.data or []
