-- =============================================
-- ДИАГНОСТИЧЕСКИЙ БОТ - СТРУКТУРА БАЗЫ ДАННЫХ
-- =============================================

-- Таблица клиентов
CREATE TABLE clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    
    -- Статус воронки
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new',                    -- Новый
        'diagnostic_scheduled',   -- Запланировали диагностику
        'diagnostic_done',        -- Провели диагностику
        'call_scheduled',         -- Запланировали звонок
        'call_done'              -- Провели звонок
    )),
    
    -- Метаданные
    notes TEXT,                   -- Заметки эксперта
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица сообщений
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Направление: client = от клиента, expert = от эксперта
    direction TEXT NOT NULL CHECK (direction IN ('client', 'expert')),
    
    -- Контент
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'photo', 'video', 'audio', 'document', 'voice')),
    text_content TEXT,
    file_url TEXT,              -- URL файла в Supabase Storage
    file_name TEXT,
    telegram_file_id TEXT,      -- ID файла в Telegram (для повторной отправки)
    
    -- Метаданные
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица напоминаний
CREATE TABLE reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    
    reminder_text TEXT NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица для авторизованных пользователей (кто оплатил)
CREATE TABLE authorized_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    email TEXT,
    phone TEXT,
    
    -- Можно добавить любые данные из Google таблицы
    payment_date TIMESTAMPTZ,
    payment_amount DECIMAL(10,2),
    source TEXT,                -- Откуда пришёл
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица админов (кто имеет доступ к панели)
CREATE TABLE admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'expert' CHECK (role IN ('expert', 'admin', 'sales')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ИНДЕКСЫ ДЛЯ БЫСТРОГО ПОИСКА
-- =============================================

CREATE INDEX idx_clients_telegram_id ON clients(telegram_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);

CREATE INDEX idx_messages_client_id ON messages(client_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read) WHERE is_read = false;

CREATE INDEX idx_reminders_remind_at ON reminders(remind_at) WHERE is_completed = false;
CREATE INDEX idx_reminders_client_id ON reminders(client_id);

CREATE INDEX idx_authorized_users_telegram_id ON authorized_users(telegram_id);
CREATE INDEX idx_authorized_users_telegram_username ON authorized_users(telegram_username);

-- =============================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- =============================================

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================
-- REALTIME ПОДПИСКИ
-- =============================================

-- Включаем realtime для таблиц (для живого обновления в панели)
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Включаем RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Политики доступа (пока открытый доступ для сервисного ключа)
-- В продакшене нужно настроить более строгие правила

CREATE POLICY "Enable all for service role" ON clients FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON messages FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON reminders FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON authorized_users FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON admins FOR ALL USING (true);

-- =============================================
-- STORAGE BUCKET ДЛЯ ФАЙЛОВ
-- =============================================

-- Создаём bucket для файлов диагностики (выполнить отдельно в Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('diagnostic-files', 'diagnostic-files', true);
