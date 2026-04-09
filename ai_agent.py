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

SYSTEM_PROMPT = """Ти — Світлана Гаврилюк, експерт з діагностики обличчя та природного омолодження, спеціаліст з масажу обличчя, тейпування, роботи з м'язами та лімфодренажем. Спілкуєшся з клієнтами через Telegram. Відповідай українською.

## СТИЛЬ СПІЛКУВАННЯ
Пиши як жива людина в месенджері. Спокійний, експертний, але простий і зрозумілий тон. Як подруга яка є експертом. З відчуттям підтримки, а не критики.

Приклади твоїх реальних повідомлень:
"Привіт 🫂 Чекаю на ваші фото та опис що вас турбує. І я запропоную дати на діагностику."
"Дякую за фото🫂 Все перегляну."
"Супер👍"
"Рада що було корисно ♥️"
"В разі чого я тут на зв'язку 🌸"
"Гарного вечора 🫂"
"Звісно задавайте питання, чи голосовими чи текстом. Як вам зручно"

## ЗАБОРОНИ
НЕ ВИКОРИСТОВУЙ НІКОЛИ:
- Звертання на "ти" — ТІЛЬКИ "ви", "вам", "ваші"
- Довге тире (—), марковані списки з крапками (•), нумеровані списки (1. 2. 3.)
- Жирний текст, markdown, форматування
- Слова: "безумовно", "зрозуміло", "чудово", "абсолютно", "фактично", "по суті", "насамперед", "зокрема", "однозначно"
- Кілька емоджі підряд
- Фрази "Як справи?", "Рада тебе бачити"
- Прохання про конкретні ракурси фото (анфас, профіль, 3/4)
- Складну медичну термінологію

Основні емоджі: 🫂 😊 👌 ♥️ 🤝 🤍 🌷 🌸 (2-6 на весь текст діагностики)

## ФЛОУ ДІАГНОСТИКИ

### ФАЗА 1: ПРИЙМАННЯ

Клієнт щойно привітався (без фото):
"Привіт 🫂 Чекаю на ваші фото та опис що вас турбує. І я запропоную дати на діагностику."

Клієнт надіслав фото:
"Дякую за фото🫂 Все перегляну. Можу запропонувати вам такі найближчі дати на діагностику🗓️ ДД.ММ о ЧЧ:ХХ, ЧЧ:ХХ. Час пропоную за Києвом. Діагностика пройде у форматі переписки і займе орієнтовно від 20 до 30 хвилин. Який час вам підходить?"
Пропонуй 2 конкретні часи. Можна і на СЬОГОДНІ якщо є вільний час (мінімум через 1 годину від поточного часу). Можна і на завтра, післязавтра.

Клієнт обрав час — ОБОВ'ЯЗКОВО додай action schedule:
{"action": "schedule", "date": "YYYY-MM-DD", "time": "HH:MM"}
+ текст: "Фіксую 🫂 Діагностика займе від 20 до 30 хвилин. Постарайтесь бути в цей час на зв'язку, щоб наше спілкування було максимально ефективним і ви одразу змогли задати питання."

### ФАЗА 2: ДІАГНОСТИКА (ГОЛОВНЕ!)

КРИТИЧНО: Коли настає час діагностики, ти маєш відправити ВЕСЬ розбір ПОТОКОМ, не чекаючи відповіді клієнта між повідомленнями! Це як справжня Світлана робить: розповідає все по черзі, кидає відео, потім запитує.

Ось ТОЧНИЙ порядок (кожен пункт = окреме повідомлення в JSON):

КРОК 1 — Тип старіння (текст):
Визнач тип старіння і поясни що це означає. Типи: м'язово-мімічний, деформаційно-набряковий, втомлений, дрібнозморшкуватий, комбінований.
Якщо обличчя молоде — акцентуй що це НЕ вікові зміни, а функціональні.
Поясни причини: напруга м'язів, набряки, порушення відтоку, звички міміки, вплив шиї і постави.
Пиши живо, як у прикладах:
"У вас змішаний тип старіння, але більше проявлений м'язово-мімічний з переходом у деформаційний. Тобто зараз основну роль грає напруга м'язів (особливо лоб, міжбрівка, жувальні, шия), і вже на цьому фоні тканини починають трохи зміщуватись вниз."

КРОК 2 — Лоб і міжбрівка (текст + відео):
Текст: опиши що видно, що впливає, як працювати. Обов'язково згадай апоневроз.
"Лоб. Є чітка напруга і вже формується залом по міжбрівці. Це не про вік, а про звичку тримати м'яз у скороченні. Потрібно максимально розслабляти цю зону, масаж апоневрозу, чола і скронь."
Потім: {"action": "send_template", "template": "video_cholo_mizhbrivka"}
Потім: "Дивіться зі звуком відео ⬆️"

КРОК 3 — Очі (якщо є проблеми, текст + відео):
"Під очима видно легку тінь і набряклість, що дає ефект втоми. Причина - порушений лімфовідтік, застій рідини, напруга шиї і кругового м'яза ока. Працювати тут делікатно: легкий лімфодренаж, розслаблення скронь."
Якщо гусячі лапки: {"action": "send_template", "template": "video_husiachi_lapky"}
Якщо навислі повіки: {"action": "send_template", "template": "video_navysli_poviky"}
Якщо мішки: {"action": "send_template", "template": "video_mishky_pid_ochyma"}

КРОК 4 — Носогубка (текст + відео):
"Носогубна складка формується через навал тканини зверху + мімічна зморшка. Впливає набряк у щоках, зміщення середньої третини вниз, напруга м'яза що підіймає крило носа і верхню губу. Потрібно розслабляти жувальні м'язи, працювати з виличною зоною."
Потім: {"action": "send_template", "template": "video_nosohubka"}

КРОК 5 — Рекомендації по носогубці (текст):
"Масаж: лімфодренаж від носа і щоки до скроні, відведення вниз по шиї, м'який ліфтинг щоки вгору. Тейпування: лімфодренажні аплікації на щоки, ліфтинг від носогубки до вуха."

КРОК 6 — Голосове про набряки:
{"action": "send_template", "template": "voice_nabriaky"}

КРОК 7 — Овал і шия (текст + відео):
"Овал: є легке згладження контуру. Впливає набряк, недостатній відтік і напруга в шиї та жувальних м'язах. Шия - це ваша база, без роботи з нею все інше дає слабший ефект."
Потім: {"action": "send_template", "template": "video_oval_pidboriddia"}

КРОК 8 — Висновок (текст):
Підкресли головну логіку: напруга → застій → зміщення тканин → зміни на обличчі.
Акцентуй що це не вікові зміни і добре коригується.
"Основна причина змін - це застій рідини і порушення лімфовідтоку, які дають відчуття провисання і підсилюють носогубку та зону під очима. Це добре коригується масажем і тейпуванням 🫂"

КРОК 9 — Голосове "Як працюєте":
{"action": "send_template", "template": "voice_yak_pracyuete"}

=== ТУТ ЧЕКАЙ ВІДПОВІДІ КЛІЄНТА ===
Після voice_yak_pracyuete ЗУПИНИСЬ і чекай що клієнт відповість! Не продовжуй далі поки клієнт не напише.

КРОК 10 — Після відповіді клієнта:
Відповідай на питання, дай рекомендації. Потім:
{"action": "send_template", "template": "youtube_masazh_nabriaky"}
{"action": "send_template", "template": "youtube_rutyna_nabriaky"}
{"action": "send_template", "template": "voice_pro_masazhi"}
"Можете додати ці масажі в свою рутину зранку, це допоможе позбутися набряків."

КРОК 11 — Канал:
{"action": "send_template", "template": "link_kanal_face_mood"}
"Даю ще посилання на мій канал. В групі не всі є техніки, там більш базові, які можна робити самостійно. Вже більш складні техніки масажу і тейпувань дівчата роблять на навчанні під моїм супроводом."

КРОК 12 — Чекай запитання:
"Можливо маєте ще питання? 🫂"

### ФАЗА 3: ПРОДАЖ

Коли клієнт подякував / немає питань:
{"action": "send_template", "template": "text_pro_navchannia"}

Якщо цікаво:
{"action": "send_template", "template": "text_peredaiu_pomichnytsi"}

Клієнт не хоче дзвонити:
"Але якщо вам зручніше, то скажу помічниці хай зв'яжеться з вами перепискою 😊"

Клієнт хоче подумати:
"Звичайно 🫂 в разі чого я на зв'язку. Але також хотіла зазначити, що зараз для дівчат з діагностики я даю більш вигідні умови на навчання 🫂"

Якщо не відповідає (через 3-4 години):
"Не отримала відповідь від вас😔"

Коли дав номер:
{"action": "transfer_to_sales", "phone": "номер", "call_time": "час"}

## ПРИНЦИПИ ДІАГНОСТИКИ

### Головна логіка:
напруга → застій → зміщення тканин → зміни на обличчі

### Неочевидні причини (завжди аналізуй!):
Апоневроз голови впливає на чоло і міжбрівку. Жувальні м'язи впливають на овал, носогубку, підборіддя. Скроні впливають на зону очей і чоло. Шия і трапеції впливають на ВСЕ обличчя. Постава (голова вперед) = овал пливе.

### Ланцюги напруги:
міжбрівка ← апоневроз ← шия. Носогубка ← жувальні ← шия. Очі ← скроні ← апоневроз. Овал ← платизма ← шия ← трапеції.

### НІКОЛИ не ізолюй зону!
Завжди додавай суміжні зони. Працювати тільки по носогубці без жувальних - ефект слабкий.

### Не залякувати!
Не говори "старіння" якщо це функціональні зміни. Пояснюй через причину. Показуй що все коригується. "У вас дуже хороший потенціал"

## ВІДПОВІДІ НА ЧАСТІ ПИТАННЯ

Про ботокс:
"Я за те щоб відтягнути ботокс як найдовше і працювати природними методами. Найбільше проти коли колють ботокс в молодому віці без дійсних показів."

Про косметологію:
"Особисто для себе люблю плазмотерапію, мікротоки. Покращує тонус і якість шкіри. Але це як додатковий варіант. Основна робота з м'язами)"

Про тейпи: "Cur tape. Саме для обличчя, ніжно лимонного кольору."

Про подразнення тейпів: "Подразнення може бути від неправильної техніки або якості тейпів. Тейпи мають бути якісні і саме для обличчя."

Про LED маску: "Так, як додатковий варіант вона працює. Покращує тонус шкіри."

Про масаж + тейпи: "Найкраще працює комплекс. Масаж розслаблює м'язи, тейп фіксує у правильному положенні."

Про масажі яких не знаєш (Зоган, кобідо): "Чесно, я не знаю що це за масаж, таким не працюю." Будь чесною!

## ЕСКАЛАЦІЯ

Якщо НЕ ЗНАЄШ відповідь: {"action": "escalate", "question": "Опис"}
НЕ пиши клієнту нічого перед ескалацією! Просто action escalate.

ОБОВ'ЯЗКОВО ескалюй:
- Клієнт питає чи це бот/AI → question: "Клієнт запитує чи це бот/AI. Потрібне голосове підтвердження що це ви."
- Конкретні продукти/бренди яких немає вище
- Індивідуальні медичні стани
- Ціни/деталі навчання
- Техніки яких не знаєш

## ФОРМАТ ВІДПОВІДІ
ТІЛЬКИ JSON:
{
  "messages": [
    {"type": "text", "content": "Текст"},
    {"type": "action", "action": "send_template", "template": "template_id"},
    {"type": "action", "action": "schedule", "date": "2026-04-05", "time": "14:00"},
    {"type": "action", "action": "escalate", "question": "Опис"},
    {"type": "action", "action": "transfer_to_sales", "phone": "номер", "call_time": "час"}
  ]
}

## ШАБЛОНИ:
video_cholo_mizhbrivka, video_husiachi_lapky, video_oval_pidboriddia, video_mishky_pid_ochyma, video_nosohubka, video_navysli_poviky, video_kutyky_hub
voice_nabriaky, voice_pro_masazhi, voice_yak_pracyuete
youtube_masazh_nabriaky, youtube_rutyna_nabriaky, youtube_aponevroze
link_kanal_face_mood, link_kanal_materialy, text_pro_kanal, text_pro_navchannia, text_peredaiu_pomichnytsi

## КРИТИЧНІ ПРАВИЛА:
1. Ти Світлана, НЕ AI. Ніколи не кажи що ти бот.
2. НЕ давай медичних порад. Біль → лікар.
3. НЕ вигадуй. Не знаєш → ЕСКАЛЮЙ.
4. Клієнт обирає час → ЗАВЖДИ action schedule!
5. Діагностика = ВЕСЬ розбір потоком (кроки 1-9), НЕ ЧЕКАЙ відповіді!
6. ЧЕКАЙ відповіді ТІЛЬКИ після voice_yak_pracyuete (крок 9).
7. Російською розумій, відповідай українською.
8. Пиши КОРОТКО. 2-4 речення на повідомлення.
"""


# ==================== МАППІНГ ШАБЛОНІВ ====================

TEMPLATE_MAP = {
    "video_cholo_mizhbrivka": "Відео про чоло і міжбрівку",
    "video_husiachi_lapky": "Video husiachi lapky",
    "video_oval_pidboriddia": "oval 2 pidboriddia",
    "video_mishky_pid_ochyma": "mishky pid ochyma",
    "video_nosohubka": "nosohubka",
    "video_navysli_poviky": "navysli poviky / asymetriia povik",
    "video_kutyky_hub": "kutyky hub opusheni",
    "voice_nabriaky": "holosove pro nabriaky",
    "voice_pro_masazhi": "Holosove pro masazhi",
    "voice_yak_pracyuete": "Як працюєте з обличчям",
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
    text_lower = text.lower()
    fix_keywords = ["фіксую", "записую", "чекаю на вас", "домовились", "зафіксую", "чудово, о ", "добре, о ", "ок, о ", "записала"]
    if not any(kw in text_lower for kw in fix_keywords):
        return None
    
    now = datetime.now(KYIV_TZ)
    
    match = re.search(r'(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*о?\s*(\d{1,2})[:\.](\d{2})', text)
    if match:
        day, month = int(match.group(1)), int(match.group(2))
        year = int(match.group(3)) if match.group(3) else now.year
        if year < 100: year += 2000
        hour, minute = int(match.group(4)), int(match.group(5))
        try:
            dt = datetime(year, month, day, hour, minute, tzinfo=KYIV_TZ)
            if dt < now: dt = dt.replace(year=year + 1)
            return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}
        except ValueError: pass
    
    match = re.search(r'о\s+(\d{1,2})[:\.](\d{2})', text)
    if match:
        hour, minute = int(match.group(1)), int(match.group(2))
        if "завтра" in text_lower:
            dt = now + timedelta(days=1)
        else:
            dt = now
            if hour < now.hour or (hour == now.hour and minute <= now.minute):
                dt = now + timedelta(days=1)
        return {"date": dt.strftime("%Y-%m-%d"), "time": f"{hour:02d}:{minute:02d}"}
    
    months_ua = {"січня":1,"лютого":2,"березня":3,"квітня":4,"травня":5,"червня":6,"липня":7,"серпня":8,"вересня":9,"жовтня":10,"листопада":11,"грудня":12}
    for month_name, month_num in months_ua.items():
        match = re.search(rf'(\d{{1,2}})\s+{month_name}\s*о?\s*(\d{{1,2}})[:\.](\d{{2}})', text_lower)
        if match:
            day, hour, minute = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                dt = datetime(now.year, month_num, day, hour, minute, tzinfo=KYIV_TZ)
                if dt < now: dt = dt.replace(year=now.year + 1)
                return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}
            except ValueError: pass
    return None


# ==================== AI ФУНКЦІЇ ====================

async def get_ai_response(client_data: dict, messages_history: list, templates: list, supabase_client) -> list:
    if not ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY not set")
        return []
    
    try:
        import aiohttp
        conversation = format_conversation(client_data, messages_history)
        
        now_kyiv = datetime.now(KYIV_TZ)
        time_context = f"\n\nПоточний час за Києвом: {now_kyiv.strftime('%d.%m.%Y %H:%M')}, {['понеділок','вівторок','середа','четвер','пятниця','субота','неділя'][now_kyiv.weekday()]}."
        
        phase = determine_phase(messages_history)
        phase_context = f"\nПоточна фаза діалогу: {phase}"
        
        escalation_context = ""
        try:
            esc_result = supabase_client.table("escalations").select("*").eq("client_id", client_data.get("id")).eq("status", "pending").execute()
            if esc_result.data:
                escalation_context = "\n\n⚠️ УВАГА: Є запит до Світлани який очікує відповіді. НЕ відповідай на це питання. НЕ вигадуй відповідь!"
        except Exception: pass
        
        knowledge_context = ""
        try:
            kb_result = supabase_client.table("ai_knowledge").select("category,title,content").execute()
            if kb_result.data:
                knowledge_parts = []
                for kb in kb_result.data:
                    cat = kb.get("category", "")
                    title = kb.get("title", "")
                    content = kb.get("content", "")
                    if content:
                        header = f"[{cat}] {title}" if title else f"[{cat}]"
                        knowledge_parts.append(f"{header}:\n{content}")
                if knowledge_parts:
                    knowledge_context = "\n\n## БАЗА ЗНАНЬ ЕКСПЕРТА:\n" + "\n\n---\n".join(knowledge_parts)
        except Exception as kb_err:
            logger.warning(f"Failed to load knowledge base: {kb_err}")
        
        full_system = SYSTEM_PROMPT + knowledge_context + time_context + phase_context + escalation_context
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": AI_MODEL, "max_tokens": 4000, "system": full_system, "messages": conversation},
                timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                if resp.status != 200:
                    logger.error(f"Claude API error {resp.status}: {await resp.text()}")
                    return []
                data = await resp.json()
                response_text = data["content"][0]["text"]
                logger.info(f"AI response: {response_text[:300]}...")
                return parse_ai_response(response_text, templates)
    except Exception as e:
        logger.error(f"AI agent error: {e}")
        return []


def format_conversation(client_data: dict, messages_history: list) -> list:
    conversation = []
    client_info = f"[Клієнт: {client_data.get('first_name', 'Невідомий')}"
    if client_data.get('phone'): client_info += f", тел: {client_data['phone']}"
    client_info += f", статус: {client_data.get('status', 'new')}]"
    
    for msg in messages_history:
        role = "user" if msg.get("direction") == "client" else "assistant"
        content = ""
        if msg.get("content_type") == "text" and msg.get("text_content"):
            content = msg["text_content"]
        elif msg.get("content_type") == "photo":
            content = "[Клієнт надіслав фото]"
            if msg.get("text_content"): content += f" з підписом: {msg['text_content']}"
        elif msg.get("content_type") == "voice":
            if msg.get("text_content") and msg["text_content"].startswith("[Голосове]"): content = msg["text_content"]
            elif msg.get("text_content"): content = msg["text_content"]
            else: content = "[Голосове повідомлення без транскрибації]"
        elif msg.get("content_type") == "video":
            content = f"[Відправлено відео: {msg.get('text_content', msg.get('file_name', 'відео'))}]"
        elif msg.get("content_type") == "video_note":
            if msg.get("text_content") and msg["text_content"].startswith("[Відео-кружок]"): content = msg["text_content"]
            elif msg.get("text_content"): content = msg["text_content"]
            else: content = "[Відео-кружок без транскрибації]"
        elif msg.get("content_type") == "document":
            content = f"[Документ: {msg.get('file_name', 'файл')}]"
        else:
            content = msg.get("text_content", "[повідомлення]")
        
        if not content: continue
        if role == "user" and not conversation: content = client_info + "\n" + content
        if conversation and conversation[-1]["role"] == role:
            conversation[-1]["content"] += "\n" + content
        else:
            conversation.append({"role": role, "content": content})
    
    if not conversation or conversation[-1]["role"] != "user": return conversation
    return conversation


def determine_phase(messages_history: list) -> str:
    expert_messages = [m for m in messages_history if m.get("direction") == "expert"]
    client_messages = [m for m in messages_history if m.get("direction") == "client"]
    
    has_photos = any(m.get("content_type") == "photo" for m in client_messages)
    total_expert = len(expert_messages)
    
    diagnostic_keywords = ["тип старіння", "деформаційн", "м'язов", "набряков", "комбінован", "змішаний тип"]
    had_diagnostic = any(any(kw in (m.get("text_content") or "").lower() for kw in diagnostic_keywords) for m in expert_messages)
    
    had_yak_pracyuete = any("як працюєте" in (m.get("text_content") or "").lower() for m in expert_messages)
    
    client_after_yak = False
    if had_yak_pracyuete:
        yak_idx = max(i for i, m in enumerate(messages_history) if m.get("direction") == "expert" and "як працюєте" in (m.get("text_content") or "").lower())
        client_after_yak = any(m.get("direction") == "client" for m in messages_history[yak_idx+1:])
    
    had_sales = any("навчання" in (m.get("text_content") or "").lower() and "супровод" in (m.get("text_content") or "").lower() for m in expert_messages)
    
    if had_sales:
        return "ФАЗА 3 — ПРОДАЖ. Клієнт вже отримав діагностику. Етап закриття на навчання."
    elif had_diagnostic and had_yak_pracyuete and client_after_yak:
        return "ФАЗА 2 — ПІСЛЯ ДІАГНОСТИКИ. Клієнт відповів на 'як працюєте'. Дай рекомендації, YouTube, канал. Запитай чи є питання."
    elif had_diagnostic and had_yak_pracyuete and not client_after_yak:
        return "ФАЗА 2 — ЧЕКАЄМО ВІДПОВІДІ. Діагностика і голосове відправлені. ЧЕКАЙ відповіді клієнта!"
    elif had_diagnostic:
        return "ФАЗА 2 — ДІАГНОСТИКА В ПРОЦЕСІ. Продовжуй діагностику по зонах, відправляй відео."
    elif has_photos and total_expert > 0:
        return "ФАЗА 1 — ПРИЙМАННЯ. Фото отримано, узгодити час діагностики."
    elif has_photos:
        return "ФАЗА 1 — ПРИЙМАННЯ. Клієнт надіслав фото. Подякуй і запропонуй час."
    else:
        return "ФАЗА 1 — ПОЧАТОК. Попроси фото і описати що турбує."


def parse_ai_response(response_text: str, templates: list) -> list:
    actions = []
    try:
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
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
                        if matched: actions.append({"type": "template", "template": matched})
                        else: logger.warning(f"Template not found: {template_id} -> {template_title}")
                    elif action == "schedule":
                        actions.append({"type": "schedule", "date": msg.get("date", ""), "time": msg.get("time", "")})
                    elif action == "transfer_to_sales":
                        actions.append({"type": "transfer_to_sales", "phone": msg.get("phone", ""), "call_time": msg.get("call_time", "")})
                    elif action == "escalate":
                        actions.append({"type": "escalate", "question": msg.get("question", "")})
    except json.JSONDecodeError:
        logger.warning("Failed to parse AI JSON, using as text")
        if response_text.strip(): actions.append({"type": "text", "content": response_text.strip()})
    
    has_schedule = any(a["type"] == "schedule" for a in actions)
    if not has_schedule:
        for action in actions:
            if action["type"] == "text":
                schedule_data = extract_schedule_from_text(action["content"])
                if schedule_data:
                    logger.info(f"FALLBACK: Extracted schedule from text: {schedule_data}")
                    actions.append({"type": "schedule", "date": schedule_data["date"], "time": schedule_data["time"]})
                    break
    return actions


def find_template(title_or_content: str, templates: list) -> dict:
    title_lower = title_or_content.lower().strip()
    for t in templates:
        if t.get("title", "").lower().strip() == title_lower: return t
        if t.get("content", "").lower().strip() == title_lower: return t
    for t in templates:
        if title_lower in t.get("title", "").lower() or title_lower in t.get("content", "").lower(): return t
        if t.get("title", "").lower() in title_lower: return t
    return None


async def process_ai_actions(actions: list, client: dict, bot, supabase_client, bot_id: str) -> list:
    import asyncio
    import random
    
    sent_messages = []
    telegram_id = client.get("telegram_id")
    client_id = client.get("id")
    if not telegram_id or not client_id: return sent_messages
    
    prev_type = None  # Тип попередньої дії для розрахунку паузи
    
    for i, action in enumerate(actions):
        try:
            # Розраховуємо паузу ПЕРЕД повідомленням (крім першого)
            if i > 0 and action["type"] in ("text", "template"):
                curr_type = action["type"]
                
                if prev_type == "text" and curr_type == "text":
                    # Текст після тексту — як будто друкує (3-6 сек)
                    text_len = len(action.get("content", "")) if curr_type == "text" else 0
                    base_delay = min(3 + text_len / 50, 8)  # Довший текст = довша пауза
                    delay = base_delay + random.uniform(-0.5, 1.0)
                elif prev_type == "text" and curr_type == "template":
                    # Медіа після тексту — шукає в галереї (2-3 сек)
                    delay = random.uniform(2.0, 3.5)
                elif prev_type == "template" and curr_type == "text":
                    # Текст після медіа — коментар до відео (1-2 сек)
                    delay = random.uniform(1.0, 2.0)
                elif prev_type == "template" and curr_type == "template":
                    # Медіа після медіа (2-3 сек)
                    delay = random.uniform(2.0, 3.0)
                else:
                    delay = random.uniform(2.0, 4.0)
                
                logger.info(f"Pause {delay:.1f}s before action {i} ({prev_type} -> {curr_type})")
                await asyncio.sleep(delay)
            
            if action["type"] == "text":
                msg_data = {"client_id": client_id, "direction": "expert", "content_type": "text", "text_content": action["content"], "is_read": True}
                result = supabase_client.table("messages").insert(msg_data).execute()
                if result.data:
                    supabase_client.table("messages").update({"is_read": False}).eq("id", result.data[0]["id"]).execute()
                    sent_messages.append(result.data[0])
                prev_type = "text"
            elif action["type"] == "template":
                template = action["template"]
                msg_data = {"client_id": client_id, "direction": "expert", "content_type": template.get("type", "text"), "text_content": template.get("content", ""), "file_url": template.get("file_url"), "file_name": "Медіа", "is_read": False}
                result = supabase_client.table("messages").insert(msg_data).execute()
                if result.data: sent_messages.append(result.data[0])
                prev_type = "template"
            elif action["type"] == "schedule":
                date_str, time_str = action.get("date", ""), action.get("time", "")
                if date_str and time_str:
                    try:
                        kyiv_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M").replace(tzinfo=KYIV_TZ)
                        remind_at = kyiv_dt.isoformat()
                    except: remind_at = f"{date_str}T{time_str}:00+03:00"
                    
                    # Перевіряємо чи до діагностики більше 3 годин
                    # Якщо менше — створюємо reminder але одразу позначаємо як notified (не слати напоминання)
                    now_kyiv = datetime.now(KYIV_TZ)
                    try:
                        diag_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M").replace(tzinfo=KYIV_TZ)
                        hours_until = (diag_dt - now_kyiv).total_seconds() / 3600
                        skip_notification = hours_until < 3
                    except:
                        skip_notification = False
                    
                    supabase_client.table("reminders").insert({
                        "client_id": client_id,
                        "reminder_text": f"Діагностика о {time_str}",
                        "remind_at": remind_at,
                        "is_completed": False,
                        "client_notified": skip_notification  # True якщо < 3h — не слати напоминання
                    }).execute()
                    supabase_client.table("clients").update({"status": "diagnostic_scheduled"}).eq("id", client_id).execute()
                    if skip_notification:
                        logger.info(f"Scheduled diagnostic for {client_id}: {date_str} {time_str} (no reminder, < 3h)")
                    else:
                        logger.info(f"Scheduled diagnostic for {client_id}: {date_str} {time_str}")
            elif action["type"] == "escalate":
                question = action.get("question", "")
                if question:
                    try:
                        supabase_client.table("escalations").insert({"client_id": client_id, "bot_id": bot_id, "question": question, "status": "pending"}).execute()
                        logger.info(f"Escalation created for client {client_id}: {question[:100]}")
                    except Exception as esc_err: logger.error(f"Failed to create escalation: {esc_err}")
            elif action["type"] == "transfer_to_sales":
                phone, call_time = action.get("phone", ""), action.get("call_time", "")
                if phone: supabase_client.table("clients").update({"phone": phone}).eq("id", client_id).execute()
                supabase_client.table("clients").update({"status": "transferred_to_sales"}).eq("id", client_id).execute()
                try:
                    bot_result = supabase_client.table("bots").select("google_sheet_url").eq("id", bot_id).execute()
                    gurl = bot_result.data[0].get("google_sheet_url") if bot_result.data else None
                    if gurl:
                        import aiohttp as _aio
                        cfull = supabase_client.table("clients").select("*").eq("id", client_id).execute()
                        c = cfull.data[0] if cfull.data else client
                        async with _aio.ClientSession() as gs:
                            await gs.post(gurl, json={"name": f"{c.get('first_name','')} {c.get('last_name','')}".strip(), "phone": phone or c.get("phone",""), "username": c.get("telegram_username",""), "status": "Передано у ВП", "comment": f"AI діагностика. Зателефонувати: {call_time}" if call_time else "AI діагностика", "date": datetime.now(KYIV_TZ).strftime("%d.%m.%Y %H:%M")}, timeout=_aio.ClientTimeout(total=10))
                except Exception as gs_err: logger.warning(f"Google Sheets error: {gs_err}")
                logger.info(f"Transferred to sales: {client_id}, phone: {phone}")
        except Exception as e: logger.error(f"Error processing AI action: {e}")
    
    supabase_client.table("clients").update({"updated_at": datetime.utcnow().isoformat()}).eq("id", client_id).execute()
    return sent_messages


async def process_escalation_response(escalation_id: str, response_text: str, response_media: dict, supabase_client) -> list:
    actions = []
    try:
        esc_result = supabase_client.table("escalations").select("*, clients(id, telegram_id, bot_id, first_name, status)").eq("id", escalation_id).execute()
        if not esc_result.data: return actions
        escalation = esc_result.data[0]
        client_data = escalation.get("clients", {})
        client_id = client_data.get("id")
        if not client_id: return actions
        
        if response_media:
            msg_data = {"client_id": client_id, "direction": "expert", "content_type": response_media.get("type", "voice"), "text_content": response_media.get("text_content"), "file_url": response_media.get("file_url"), "file_name": response_media.get("file_name", "Медіа"), "is_read": False}
            result = supabase_client.table("messages").insert(msg_data).execute()
            if result.data: actions.append(result.data[0])
        
        if response_text:
            reformulated = await reformulate_response(escalation.get("question", ""), response_text, client_data, supabase_client)
            msg_data = {"client_id": client_id, "direction": "expert", "content_type": "text", "text_content": reformulated, "is_read": False}
            result = supabase_client.table("messages").insert(msg_data).execute()
            if result.data: actions.append(result.data[0])
        
        supabase_client.table("escalations").update({"status": "answered", "answered_at": datetime.utcnow().isoformat()}).eq("id", escalation_id).execute()
        logger.info(f"Escalation {escalation_id} answered, sent to client {client_id}")
    except Exception as e: logger.error(f"Error processing escalation response: {e}")
    return actions


async def reformulate_response(question: str, answer: str, client_data: dict, supabase_client) -> str:
    if not ANTHROPIC_API_KEY: return answer
    try:
        import aiohttp
        prompt = f"""Ти Світлана Гаврилюк. Клієнт {client_data.get('first_name', '')} запитав: "{question}"
Світлана відповіла: "{answer}"
Переформулюй від першої особи, як в месенджері. На "ви", коротко 1-3 речення, живо, можна емоджі (🫂 😊 👌 ♥️). НЕ списки, НЕ markdown.
Відповідай ТІЛЬКИ текстом повідомлення."""
        async with aiohttp.ClientSession() as session:
            async with session.post("https://api.anthropic.com/v1/messages", headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}, json={"model": AI_MODEL, "max_tokens": 500, "messages": [{"role": "user", "content": prompt}]}, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["content"][0]["text"].strip()
    except Exception as e: logger.warning(f"Reformulation failed: {e}")
    return answer


async def is_ai_enabled_for_client(client_id: str, supabase_client) -> bool:
    result = supabase_client.table("clients").select("ai_enabled").eq("id", client_id).execute()
    return result.data[0].get("ai_enabled", False) if result.data else False


async def get_templates_for_bot(bot_id: str, supabase_client) -> list:
    result = supabase_client.table("message_templates").select("*").eq("bot_id", bot_id).execute()
    return result.data or []
