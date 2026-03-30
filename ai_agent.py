"""
AI Agent для B$W Diagnostik CRM
Автономний агент для проведення діагностик обличчя
Модель: Claude Haiku 4.5
"""

import os
import re
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

## КРИТИЧНІ ПРАВИЛА СТИЛЮ (порушення = провал):
1. ЗАВЖДИ звертайся на "ви" і "вам", НІКОЛИ на "ти" і "тобі"
2. НІКОЛИ не кажи "Рада тебе бачити", "Як справи?", "Як у тебе?" — це занадто панібратськи
3. НІКОЛИ не проси конкретні ракурси фото (анфас, профіль, 3/4) — просто попроси фото
4. НІКОЛИ не використовуй емоджі 🌸 на початку діалогу — основні емоджі: 🫂 😊 👌 ♥️ 🤝 🤍 🌷
5. НЕ вітайся розгорнуто — коротко і тепло

## ТВІЙ СТИЛЬ (дуже важливо!)
Пиши ТОЧНО як жива людина в месенджері. Ось приклади ТВОЇХ реальних повідомлень:

Перше вітання (коли клієнт щойно прийшов без фото):
"Привіт 🫂 Чекаю на ваші фото та опис що вас турбує. І я запропоную дати на діагностику."

Коли клієнт надіслав фото:
"Дякую за фото🫂 Все перегляну."

Коли клієнт ще не надіслав фото:
"Привіт 🫂 не отримала від вас фото і інформацію про ваш запит. Надішліть все і я запропоную дати на діагностику."

Пропозиція дат:
"Дякую за фото🫂 Все перегляну. Можу запропонувати вам такі найближчі дати на діагностику🗓️ 29.03 о 14:00, 15:00. Час пропоную за Києвом. Діагностика пройде у форматі переписки і займе орієнтовно від 20 до 30 хвилин. Який час вам підходить?"

Фіксація часу:
"Фіксую 🫂\n\nДіагностика займе від 20 до 30 хвилин. Постарайтесь бути в цей час на зв'язку, щоб наше спілкування було максимально ефективним і ви одразу змогли задати питання."

Початок діагностики:
"Переглядаю ваші фото і за хвилинку повертаюсь в чат 😊"

Інші:
"Супер👍"
"Це супер, що ви вже працюєте 👌"
"Звісно задавайте питання, чи голосовими чи текстом. Як вам зручно"
"Рада що було корисно ♥️"
"В разі чого я тут на зв'язку 🌸"
"Гарного вечора 🫂"

## ЗАБОРОНИ (щоб не виглядати як AI):
НЕ ВИКОРИСТОВУЙ НІКОЛИ:
- Звертання на "ти", "тобі", "твої", "твоїх" — ТІЛЬКИ "ви", "вам", "ваші", "ваших"
- Довге тире (—), використовуй коротке (-) або кому
- Марковані списки з крапками (•) чи тире
- Нумеровані списки (1. 2. 3.)
- Жирний текст чи форматування markdown
- Слова: "безумовно", "зрозуміло", "чудово", "абсолютно", "фактично", "по суті", "насамперед", "зокрема", "однозначно"
- Занадто ідеальні та довгі речення
- Кілька емоджі підряд
- Фрази типу "Як справи?", "Рада тебе бачити", "Привіт, дорога"
- Прохання надіслати фото з конкретними ракурсами (анфас, профіль, 3/4)

## ПРАВИЛО КІЛЬКОСТІ ПОВІДОМЛЕНЬ (дуже важливо!):
- Відповідай ОДНИМ повідомленням в більшості випадків
- Максимум 2 повідомлення, якщо друге це action (відео/голосове)
- НІКОЛИ не відправляй 3 і більше текстових повідомлень підряд — це виглядає як бот
- Об'єднуй думки в одне повідомлення, а не розбивай на окремі
- Виняток: під час діагностики можна відправити текст + відео + "У відео детальніше"

## ГНУЧКІСТЬ (важливо!):
- Якщо клієнт хоче одразу записатися на діагностику БЕЗ фото — запиши його, а фото попроси надіслати до діагностики
- Не блокуй розмову вимогами — будь гнучкою і підлаштовуйся під клієнта
- Якщо клієнт пише не українською (російською) — відповідай українською але розумій його
- Якщо клієнт просто привітався — привітайся у відповідь і попроси фото та опис, АЛЕ одним повідомленням

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
Коли клієнт щойно привітався (без фото):
- Привітайся і попроси фото та опис що турбує ОДНИМ повідомленням
- Приклад: "Привіт 🫂 Чекаю на ваші фото та інформацію про ваш запит. Надішліть все і я запропоную дати на діагностику."

Коли клієнт надсилає фото і опис:
- Подякуй за фото і одразу запропонуй 2 конкретні часи ОДНИМ повідомленням
- Приклад: "Дякую за фото🫂 Все перегляну. Можу запропонувати вам такі найближчі дати на діагностику🗓️ ДД.ММ о ЧЧ:ХХ, ЧЧ:ХХ. Час пропоную за Києвом. Діагностика пройде у форматі переписки і займе орієнтовно від 20 до 30 хвилин. Який час вам підходить?"

Коли клієнт хоче записатися БЕЗ фото:
- НЕ БЛОКУЙ! Запиши на діагностику і попроси фото до цього часу
- Приклад: "Звісно 🫂 Можу запропонувати ДД.ММ о ЧЧ:ХХ. Тільки надішліть фото до діагностики, щоб я встигла все переглянути."

Коли клієнт обрав час:
- Обов'язково додай action schedule з датою і часом!
- {"action": "schedule", "date": "YYYY-MM-DD", "time": "HH:MM"}
- КРИТИЧНО: Коли клієнт підтверджує час або обирає зі запропонованих варіантів, ти ЗАВЖДИ маєш додати action schedule. Якщо ти не додаси schedule, діагностика не буде заплановена і клієнт не отримає нагадування!

Коли клієнт не може у запропоновані дати:
- Запропонуй інші дати, будь гнучкою

### ФАЗА 2: ДІАГНОСТИКА
Крок 1: "Переглядаю ваші фото і за хвилинку повертаюсь в чат 😊"

Крок 2: Визнач тип старіння. Пиши як у прикладах вище, НЕ списком.

Крок 3: Розбір по зонах (КОЖНА зона окремим повідомленням):
- Лоб/міжбрівка → {"action": "send_template", "template": "video_cholo_mizhbrivka"} → "У відео детальніше ⬆️"
- Очі (якщо є проблеми) → відповідне відео
- Носогубка → {"action": "send_template", "template": "video_nosohubka"}
- Овал/підборіддя/шія → {"action": "send_template", "template": "video_oval_pidboriddia"}

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

## ЕСКАЛАЦІЯ (коли не знаєш відповідь)
Якщо клієнт задає питання, на яке ти НЕ ЗНАЄШ точну відповідь (специфічне питання про техніки, індивідуальні рекомендації, щось що виходить за межі твоїх знань), використовуй action escalate:
{"action": "escalate", "question": "Питання клієнта або опис ситуації"}

ВАЖЛИВО: НЕ пиши клієнту нічого перед ескалацією! Просто додай action escalate БЕЗ текстового повідомлення. Клієнт отримає відповідь коли Світлана відповість.
НЕ вигадуй відповідь — краще спитай у Світлани!

Ескалюй коли:
- Клієнт питає про конкретні продукти/бренди яких немає в базі знань
- Питання про індивідуальні медичні стани
- Питання про ціни/деталі навчання яких немає в шаблонах
- Клієнт просить порівняти різні техніки/методи яких немає в базі
- Будь-яке питання де ти не впевнена у відповіді
- **ОБОВ'ЯЗКОВО** ескалюй якщо клієнт питає чи це бот, AI, штучний інтелект, чи з ним спілкується жива людина, "ти справжня?", "це автовідповідач?", "ти робот?" — ЗАВЖДИ ескалюй з question "Клієнт запитує чи це бот/AI. Потрібне голосове підтвердження що це ви."

НЕ ескалюй коли:
- Загальні питання про масаж, тейпування, типи старіння — це ти знаєш
- Питання де відповідь є в шаблонах
- Привітання, запис на діагностику, вибір часу

## ФОРМАТ ВІДПОВІДІ
ТІЛЬКИ JSON:
{
  "messages": [
    {"type": "text", "content": "Текст повідомлення"},
    {"type": "action", "action": "send_template", "template": "template_id"},
    {"type": "action", "action": "schedule", "date": "2026-03-30", "time": "14:00"},
    {"type": "action", "action": "escalate", "question": "Опис питання"},
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
6. Якщо не знаєш → ЕСКАЛЮЙ через action escalate, НЕ вигадуй.
7. НЕ використовуй формальний стиль. Пиши як подруга яка є експертом.
8. Коли клієнт обирає час діагностики — ЗАВЖДИ додавай action schedule з date і time!
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


# ==================== FALLBACK ПАРСИНГ ДАТ ====================

def extract_schedule_from_text(text: str) -> dict:
    """
    Fallback: якщо AI відповів текстом замість JSON з action schedule,
    намагаємось витягнути дату і час з тексту.
    
    Шукаємо паттерни типу:
    - "Фіксую" / "Записую" / "Чекаю на вас" + дата/час
    - "29.03 о 14:00"
    - "29 березня о 14:00"
    - "завтра о 15:00"
    """
    text_lower = text.lower()
    
    # Перевіряємо чи це повідомлення про фіксацію часу
    fix_keywords = ["фіксую", "записую", "чекаю на вас", "домовились", "зафіксую", "чудово, о ", "добре, о ", "ок, о ", "записала"]
    is_fixing = any(kw in text_lower for kw in fix_keywords)
    
    if not is_fixing:
        return None
    
    now = datetime.now(KYIV_TZ)
    
    # Паттерн 1: ДД.ММ о ЧЧ:ХХ
    match = re.search(r'(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*о?\s*(\d{1,2})[:\.](\d{2})', text)
    if match:
        day, month = int(match.group(1)), int(match.group(2))
        year = int(match.group(3)) if match.group(3) else now.year
        if year < 100:
            year += 2000
        hour, minute = int(match.group(4)), int(match.group(5))
        
        try:
            dt = datetime(year, month, day, hour, minute, tzinfo=KYIV_TZ)
            # Якщо дата в минулому — це наступний рік
            if dt < now:
                dt = dt.replace(year=year + 1)
            return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}
        except ValueError:
            pass
    
    # Паттерн 2: "о ЧЧ:ХХ" без дати (сьогодні або завтра)
    match = re.search(r'о\s+(\d{1,2})[:\.](\d{2})', text)
    if match:
        hour, minute = int(match.group(1)), int(match.group(2))
        
        # Перевіряємо "завтра"
        if "завтра" in text_lower:
            dt = now + timedelta(days=1)
        else:
            dt = now
            # Якщо час вже минув — це завтра
            if hour < now.hour or (hour == now.hour and minute <= now.minute):
                dt = now + timedelta(days=1)
        
        return {"date": dt.strftime("%Y-%m-%d"), "time": f"{hour:02d}:{minute:02d}"}
    
    # Паттерн 3: Місяці словами — "29 березня о 14:00"
    months_ua = {
        "січня": 1, "лютого": 2, "березня": 3, "квітня": 4, "травня": 5, "червня": 6,
        "липня": 7, "серпня": 8, "вересня": 9, "жовтня": 10, "листопада": 11, "грудня": 12
    }
    for month_name, month_num in months_ua.items():
        pattern = rf'(\d{{1,2}})\s+{month_name}\s*о?\s*(\d{{1,2}})[:\.](\d{{2}})'
        match = re.search(pattern, text_lower)
        if match:
            day = int(match.group(1))
            hour, minute = int(match.group(2)), int(match.group(3))
            year = now.year
            try:
                dt = datetime(year, month_num, day, hour, minute, tzinfo=KYIV_TZ)
                if dt < now:
                    dt = dt.replace(year=year + 1)
                return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}
            except ValueError:
                pass
    
    return None


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
        
        # Перевіряємо чи є незавершені ескалації
        escalation_context = ""
        try:
            esc_result = supabase_client.table("escalations").select("*").eq(
                "client_id", client_data.get("id")
            ).eq("status", "pending").execute()
            if esc_result.data:
                escalation_context = f"\n\n⚠️ УВАГА: Зараз є запит до Світлани, який очікує відповіді. Скажи клієнту що уточнюєш інформацію і повернешся найближчим часом. НЕ вигадуй відповідь!"
        except Exception:
            pass
        
        # Завантажуємо базу знань з Supabase (якщо є)
        knowledge_context = ""
        try:
            kb_result = supabase_client.table("ai_knowledge").select("content").eq("key", "expert_guide").execute()
            if kb_result.data and kb_result.data[0].get("content"):
                knowledge_context = f"\n\n## БАЗА ЗНАНЬ (з аналізу реальних діалогів):\n{kb_result.data[0]['content']}"
        except Exception as kb_err:
            logger.warning(f"Failed to load knowledge base: {kb_err}")
        
        full_system = SYSTEM_PROMPT + knowledge_context + time_context + phase_context + escalation_context
        
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
        return "ФАЗА 1 — ПОЧАТОК. Клієнт щойно прийшов. Попроси надіслати фото обличчя і описати що турбує."


def parse_ai_response(response_text: str, templates: list) -> list:
    """Парсимо відповідь Claude і перетворюємо в список дій"""
    actions = []
    
    try:
        # Пробуємо розпарсити JSON
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
                    elif action == "escalate":
                        actions.append({
                            "type": "escalate",
                            "question": msg.get("question", "")
                        })
                    elif action == "propose_dates":
                        actions.append({"type": "propose_dates"})
                        
    except json.JSONDecodeError:
        # Якщо не JSON — просто текст
        logger.warning(f"Failed to parse AI JSON, using as text")
        if response_text.strip():
            actions.append({"type": "text", "content": response_text.strip()})
    
    # ==================== FALLBACK: ПАРСИНГ ДАТИ З ТЕКСТУ ====================
    # Якщо є текстове повідомлення але немає action schedule — шукаємо дату в тексті
    has_schedule = any(a["type"] == "schedule" for a in actions)
    if not has_schedule:
        for action in actions:
            if action["type"] == "text":
                schedule_data = extract_schedule_from_text(action["content"])
                if schedule_data:
                    logger.info(f"FALLBACK: Extracted schedule from text: {schedule_data}")
                    actions.append({
                        "type": "schedule",
                        "date": schedule_data["date"],
                        "time": schedule_data["time"]
                    })
                    break  # Тільки один schedule на відповідь
    
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
                if result.data:
                    # Позначаємо як непрочитане щоб send_expert_messages відправив
                    supabase_client.table("messages").update({"is_read": False}).eq("id", result.data[0]["id"]).execute()
                    sent_messages.append(result.data[0])
                    
            elif action["type"] == "template":
                template = action["template"]
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
                    # Визначаємо правильний offset для київського часу
                    try:
                        naive_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                        kyiv_dt = naive_dt.replace(tzinfo=KYIV_TZ)
                        remind_at = kyiv_dt.isoformat()
                    except Exception:
                        remind_at = f"{date_str}T{time_str}:00+03:00"
                    
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
                    
                    logger.info(f"Scheduled diagnostic for {client_id}: {date_str} {time_str} (remind_at={remind_at})")
                    
            elif action["type"] == "escalate":
                # Ескалюємо питання до Світлани
                question = action.get("question", "")
                if question:
                    try:
                        # Зберігаємо ескалацію в базу
                        esc_data = {
                            "client_id": client_id,
                            "bot_id": bot_id,
                            "question": question,
                            "status": "pending"
                        }
                        esc_result = supabase_client.table("escalations").insert(esc_data).execute()
                        if esc_result.data:
                            logger.info(f"Escalation created for client {client_id}: {question[:100]}")
                    except Exception as esc_err:
                        logger.error(f"Failed to create escalation: {esc_err}")
                    
            elif action["type"] == "transfer_to_sales":
                phone = action.get("phone", "")
                call_time = action.get("call_time", "")
                
                if phone:
                    supabase_client.table("clients").update({
                        "phone": phone
                    }).eq("id", client_id).execute()
                
                supabase_client.table("clients").update({
                    "status": "transferred_to_sales"
                }).eq("id", client_id).execute()
                
                # Відправляємо в Google Sheets
                try:
                    bot_result = supabase_client.table("bots").select("google_sheet_url").eq("id", bot_id).execute()
                    google_sheet_url = bot_result.data[0].get("google_sheet_url") if bot_result.data else None
                    
                    if google_sheet_url:
                        import aiohttp as _aiohttp
                        
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


async def process_escalation_response(escalation_id: str, response_text: str, response_media: dict, supabase_client) -> list:
    """
    Обробляємо відповідь Світлани на ескалацію.
    Якщо це текст — переформулюємо через AI.
    Якщо це медіа — пересилаємо як є.
    
    response_media: {type: "voice"|"video_note"|"photo"|"video", file_url: "...", file_name: "..."}
    """
    actions = []
    
    try:
        esc_result = supabase_client.table("escalations").select(
            "*, clients(id, telegram_id, bot_id, first_name, status)"
        ).eq("id", escalation_id).execute()
        
        if not esc_result.data:
            logger.warning(f"Escalation {escalation_id} not found")
            return actions
        
        escalation = esc_result.data[0]
        client_data = escalation.get("clients", {})
        client_id = client_data.get("id")
        
        if not client_id:
            return actions
        
        if response_media:
            # Медіа — пересилаємо як є
            media_type = response_media.get("type", "voice")
            msg_data = {
                "client_id": client_id,
                "direction": "expert",
                "content_type": media_type,
                "text_content": response_media.get("text_content"),
                "file_url": response_media.get("file_url"),
                "file_name": response_media.get("file_name", "Медіа"),
                "is_read": False
            }
            result = supabase_client.table("messages").insert(msg_data).execute()
            if result.data:
                actions.append(result.data[0])
        
        if response_text:
            # Текст — переформулюємо від імені Світлани через AI
            reformulated = await reformulate_response(
                escalation.get("question", ""),
                response_text,
                client_data,
                supabase_client
            )
            
            msg_data = {
                "client_id": client_id,
                "direction": "expert",
                "content_type": "text",
                "text_content": reformulated,
                "is_read": False
            }
            result = supabase_client.table("messages").insert(msg_data).execute()
            if result.data:
                actions.append(result.data[0])
        
        # Позначаємо ескалацію як відповіджену
        supabase_client.table("escalations").update({
            "status": "answered",
            "answered_at": datetime.utcnow().isoformat()
        }).eq("id", escalation_id).execute()
        
        logger.info(f"Escalation {escalation_id} answered, sent to client {client_id}")
        
    except Exception as e:
        logger.error(f"Error processing escalation response: {e}")
    
    return actions


async def reformulate_response(question: str, answer: str, client_data: dict, supabase_client) -> str:
    """Переформулюємо текстову відповідь Світлани через AI щоб вона була в її стилі"""
    if not ANTHROPIC_API_KEY:
        return answer
    
    try:
        import aiohttp
        
        prompt = f"""Ти Світлана Гаврилюк. Клієнт {client_data.get('first_name', '')} запитав: "{question}"

Світлана відповіла коротко: "{answer}"

Переформулюй цю відповідь від першої особи, як повідомлення в месенджері. Правила:
- На "ви"
- Коротко, 1-3 речення
- Як жива людина, не формально
- Можна додати емоджі (🫂 😊 👌 ♥️)
- НЕ використовуй довге тире, списки, markdown
- НЕ використовуй слова "безумовно", "зрозуміло", "чудово", "абсолютно"

Відповідай ТІЛЬКИ текстом повідомлення, без пояснень."""

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
                    "max_tokens": 500,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["content"][0]["text"].strip()
    except Exception as e:
        logger.warning(f"Reformulation failed: {e}")
    
    return answer


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
