import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Конфигурация Supabase
const supabaseUrl = 'https://jlwjocmcmrplvulqxnik.supabase.co';
const supabaseKey = 'sb_publishable_d1fH9DZbelV2L1-9Uz164Q_sBVN9ULr';
const supabase = createClient(supabaseUrl, supabaseKey);

// API URL (для отправки сообщений через бота)
const API_URL = 'http://localhost:8000';

// Статусы воронки
const STATUSES = {
  new: { label: 'Новый', color: 'bg-gray-500', order: 1 },
  diagnostic_scheduled: { label: 'Диагностика запланирована', color: 'bg-yellow-500', order: 2 },
  diagnostic_done: { label: 'Диагностика проведена', color: 'bg-blue-500', order: 3 },
  call_scheduled: { label: 'Звонок запланирован', color: 'bg-purple-500', order: 4 },
  call_done: { label: 'Звонок проведён', color: 'bg-green-500', order: 5 },
};

// Форматирование даты
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const formatFullDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ============================================
// КОМПОНЕНТ: Список клиентов
// ============================================
const ClientList = ({ clients, selectedClient, onSelectClient, unreadCounts }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  const filteredClients = clients
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        c.first_name?.toLowerCase().includes(searchLower) ||
        c.last_name?.toLowerCase().includes(searchLower) ||
        c.telegram_username?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  
  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700">
      {/* Поиск */}
      <div className="p-4 border-b border-slate-700">
        <input
          type="text"
          placeholder="Поиск клиента..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
        />
      </div>
      
      {/* Фильтр по статусу */}
      <div className="p-3 border-b border-slate-700 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
            filter === 'all' ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Все ({clients.length})
        </button>
        {Object.entries(STATUSES).map(([key, { label, color }]) => {
          const count = clients.filter(c => c.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === key ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label.split(' ')[0]} ({count})
            </button>
          );
        })}
      </div>
      
      {/* Список */}
      <div className="flex-1 overflow-y-auto">
        {filteredClients.map((client) => {
          const unread = unreadCounts[client.id] || 0;
          const isSelected = selectedClient?.id === client.id;
          
          return (
            <div
              key={client.id}
              onClick={() => onSelectClient(client)}
              className={`p-4 border-b border-slate-700/50 cursor-pointer transition ${
                isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold">
                    {client.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {client.first_name} {client.last_name}
                    </div>
                    <div className="text-sm text-slate-400">
                      @{client.telegram_username || 'no username'}
                    </div>
                  </div>
                </div>
                {unread > 0 && (
                  <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                    {unread}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUSES[client.status]?.color || 'bg-gray-500'}`}></span>
                <span className="text-xs text-slate-400">{STATUSES[client.status]?.label || client.status}</span>
                <span className="text-xs text-slate-500 ml-auto">{formatDate(client.updated_at)}</span>
              </div>
            </div>
          );
        })}
        
        {filteredClients.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Клиенты не найдены
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// КОМПОНЕНТ: Чат с клиентом
// ============================================
const ChatWindow = ({ client, messages, onSendMessage, onStatusChange, onNotesChange, onAddReminder }) => {
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState(client?.notes || '');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    setNotes(client?.notes || '');
  }, [client?.id]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <div>Выберите клиента для начала общения</div>
        </div>
      </div>
    );
  }
  
  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage('');
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleSaveNotes = () => {
    onNotesChange(notes);
  };
  
  const handleAddReminder = () => {
    if (!reminderText || !reminderDate) return;
    onAddReminder(reminderText, reminderDate);
    setReminderText('');
    setReminderDate('');
    setShowReminder(false);
  };
  
  return (
    <div className="flex-1 flex bg-slate-950">
      {/* Основной чат */}
      <div className="flex-1 flex flex-col">
        {/* Заголовок */}
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold">
              {client.first_name?.[0] || '?'}
            </div>
            <div>
              <div className="font-medium text-white">{client.first_name} {client.last_name}</div>
              <div className="text-sm text-slate-400">@{client.telegram_username}</div>
            </div>
          </div>
          
          {/* Выбор статуса */}
          <select
            value={client.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
          >
            {Object.entries(STATUSES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        
        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'expert' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-md rounded-2xl px-4 py-3 ${
                  msg.direction === 'expert'
                    ? 'bg-amber-500 text-black rounded-br-md'
                    : 'bg-slate-800 text-white rounded-bl-md'
                }`}
              >
                {msg.content_type === 'photo' && msg.file_url && (
                  <img src={msg.file_url} alt="Фото" className="rounded-lg mb-2 max-w-full" />
                )}
                {msg.content_type === 'video' && msg.file_url && (
                  <video src={msg.file_url} controls className="rounded-lg mb-2 max-w-full" />
                )}
                {msg.content_type === 'voice' && msg.file_url && (
                  <audio src={msg.file_url} controls className="mb-2" />
                )}
                {msg.content_type === 'document' && msg.file_url && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline mb-2 block">
                    📄 {msg.file_name || 'Документ'}
                  </a>
                )}
                {msg.text_content && <div>{msg.text_content}</div>}
                <div className={`text-xs mt-1 ${msg.direction === 'expert' ? 'text-black/60' : 'text-slate-500'}`}>
                  {formatFullDate(msg.created_at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Поле ввода */}
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          <div className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              rows={2}
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-medium rounded-xl transition"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
      
      {/* Боковая панель с заметками и напоминаниями */}
      <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
        {/* Информация о клиенте */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white mb-3">Информация</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Telegram ID:</span>
              <span className="text-white">{client.telegram_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Добавлен:</span>
              <span className="text-white">{formatFullDate(client.created_at)}</span>
            </div>
          </div>
        </div>
        
        {/* Заметки */}
        <div className="p-4 border-b border-slate-700 flex-1">
          <h3 className="font-medium text-white mb-3">Заметки</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметки по клиенту..."
            className="w-full h-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none text-sm"
          />
          <button
            onClick={handleSaveNotes}
            className="mt-2 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
          >
            Сохранить заметки
          </button>
        </div>
        
        {/* Напоминания */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Напоминания</h3>
            <button
              onClick={() => setShowReminder(!showReminder)}
              className="text-amber-500 hover:text-amber-400 text-sm"
            >
              + Добавить
            </button>
          </div>
          
          {showReminder && (
            <div className="mb-4 p-3 bg-slate-800 rounded-lg space-y-2">
              <input
                type="text"
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                placeholder="Текст напоминания..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none text-sm"
              />
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none text-sm"
              />
              <button
                onClick={handleAddReminder}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black rounded text-sm font-medium"
              >
                Создать
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// КОМПОНЕНТ: Аналитика
// ============================================
const Analytics = ({ analytics }) => {
  if (!analytics) return null;
  
  return (
    <div className="p-6 bg-slate-950 min-h-screen">
      <h2 className="text-2xl font-bold text-white mb-6">Аналитика</h2>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <div className="text-3xl font-bold text-white">{analytics.total_clients}</div>
          <div className="text-slate-400 mt-1">Всего клиентов</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <div className="text-3xl font-bold text-amber-500">{analytics.unread_messages}</div>
          <div className="text-slate-400 mt-1">Непрочитанных</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <div className="text-3xl font-bold text-green-500">{analytics.conversion_rates?.to_diagnostic || 0}%</div>
          <div className="text-slate-400 mt-1">Конверсия в диагностику</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <div className="text-3xl font-bold text-purple-500">{analytics.conversion_rates?.to_call || 0}%</div>
          <div className="text-slate-400 mt-1">Конверсия в звонок</div>
        </div>
      </div>
      
      {/* Воронка */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-medium text-white mb-4">Воронка</h3>
        <div className="space-y-3">
          {Object.entries(STATUSES).map(([key, { label, color }]) => {
            const count = analytics.status_counts?.[key] || 0;
            const percentage = analytics.total_clients > 0 
              ? Math.round(count / analytics.total_clients * 100) 
              : 0;
            
            return (
              <div key={key} className="flex items-center gap-4">
                <div className="w-48 text-slate-300">{label}</div>
                <div className="flex-1 bg-slate-800 rounded-full h-8 overflow-hidden">
                  <div 
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-20 text-right text-white font-medium">{count} ({percentage}%)</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================
// КОМПОНЕНТ: Управление доступом
// ============================================
const AccessManagement = ({ authorizedUsers, onAddUser, onRemoveUser }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  
  const handleAdd = () => {
    if (!username && !email) return;
    onAddUser({ telegram_username: username, email });
    setUsername('');
    setEmail('');
  };
  
  return (
    <div className="p-6 bg-slate-950 min-h-screen">
      <h2 className="text-2xl font-bold text-white mb-6">Управление доступом</h2>
      
      {/* Форма добавления */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Добавить пользователя</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username в Telegram"
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (опционально)"
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition"
          >
            Добавить
          </button>
        </div>
      </div>
      
      {/* Список */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800">
            <tr>
              <th className="text-left p-4 text-slate-300 font-medium">Username</th>
              <th className="text-left p-4 text-slate-300 font-medium">Email</th>
              <th className="text-left p-4 text-slate-300 font-medium">Добавлен</th>
              <th className="text-right p-4 text-slate-300 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {authorizedUsers.map((user) => (
              <tr key={user.id} className="border-t border-slate-700">
                <td className="p-4 text-white">@{user.telegram_username || '—'}</td>
                <td className="p-4 text-slate-400">{user.email || '—'}</td>
                <td className="p-4 text-slate-400">{formatFullDate(user.created_at)}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onRemoveUser(user.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {authorizedUsers.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Нет авторизованных пользователей
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// КОМПОНЕНТ: Напоминания
// ============================================
const Reminders = ({ reminders, onComplete }) => {
  const now = new Date();
  
  const overdueReminders = reminders.filter(r => new Date(r.remind_at) < now && !r.is_completed);
  const todayReminders = reminders.filter(r => {
    const date = new Date(r.remind_at);
    return date >= now && date.toDateString() === now.toDateString() && !r.is_completed;
  });
  const futureReminders = reminders.filter(r => {
    const date = new Date(r.remind_at);
    return date > now && date.toDateString() !== now.toDateString() && !r.is_completed;
  });
  
  const ReminderItem = ({ reminder }) => (
    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
      <div>
        <div className="text-white">{reminder.reminder_text}</div>
        <div className="text-sm text-slate-400 mt-1">
          {reminder.clients?.first_name} {reminder.clients?.last_name} • {formatFullDate(reminder.remind_at)}
        </div>
      </div>
      <button
        onClick={() => onComplete(reminder.id)}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
      >
        Выполнено
      </button>
    </div>
  );
  
  return (
    <div className="p-6 bg-slate-950 min-h-screen">
      <h2 className="text-2xl font-bold text-white mb-6">Напоминания</h2>
      
      {overdueReminders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-red-400 mb-3">🔴 Просрочено</h3>
          <div className="space-y-2">
            {overdueReminders.map(r => <ReminderItem key={r.id} reminder={r} />)}
          </div>
        </div>
      )}
      
      {todayReminders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-amber-400 mb-3">🟡 Сегодня</h3>
          <div className="space-y-2">
            {todayReminders.map(r => <ReminderItem key={r.id} reminder={r} />)}
          </div>
        </div>
      )}
      
      {futureReminders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-slate-300 mb-3">🔵 Предстоящие</h3>
          <div className="space-y-2">
            {futureReminders.map(r => <ReminderItem key={r.id} reminder={r} />)}
          </div>
        </div>
      )}
      
      {reminders.filter(r => !r.is_completed).length === 0 && (
        <div className="text-center text-slate-500 py-12">
          Нет активных напоминаний
        </div>
      )}
    </div>
  );
};

// ============================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================
export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // Загрузка данных
  useEffect(() => {
    loadClients();
    loadAnalytics();
    loadAuthorizedUsers();
    loadReminders();
    
    // Realtime подписки
    const clientsSubscription = supabase
      .channel('clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        loadClients();
      })
      .subscribe();
    
    const messagesSubscription = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (selectedClient && payload.new.client_id === selectedClient.id) {
          setMessages(prev => [...prev, payload.new]);
        }
        loadUnreadCounts();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(clientsSubscription);
      supabase.removeChannel(messagesSubscription);
    };
  }, [selectedClient]);
  
  const loadClients = async () => {
    const { data } = await supabase.table('clients').select('*').order('updated_at', { ascending: false });
    if (data) setClients(data);
    loadUnreadCounts();
  };
  
  const loadUnreadCounts = async () => {
    const { data } = await supabase
      .from('messages')
      .select('client_id')
      .eq('direction', 'client')
      .eq('is_read', false);
    
    if (data) {
      const counts = {};
      data.forEach(msg => {
        counts[msg.client_id] = (counts[msg.client_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };
  
  const loadMessages = async (clientId) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at');
    if (data) setMessages(data);
    
    // Отмечаем как прочитанные
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('client_id', clientId)
      .eq('direction', 'client');
    loadUnreadCounts();
  };
  
  const loadAnalytics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analytics`);
      const data = await response.json();
      setAnalytics(data);
    } catch (e) {
      // Fallback если API недоступен
      const { data: clientsData } = await supabase.from('clients').select('status');
      const statusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
      clientsData?.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });
      const total = clientsData?.length || 0;
      setAnalytics({
        total_clients: total,
        status_counts: statusCounts,
        unread_messages: Object.values(unreadCounts).reduce((a, b) => a + b, 0),
        conversion_rates: {
          to_diagnostic: total > 0 ? Math.round(statusCounts.diagnostic_done / total * 100) : 0,
          to_call: total > 0 ? Math.round(statusCounts.call_done / total * 100) : 0
        }
      });
    }
  };
  
  const loadAuthorizedUsers = async () => {
    const { data } = await supabase.from('authorized_users').select('*').order('created_at', { ascending: false });
    if (data) setAuthorizedUsers(data);
  };
  
  const loadReminders = async () => {
    const { data } = await supabase
      .from('reminders')
      .select('*, clients(first_name, last_name)')
      .eq('is_completed', false)
      .order('remind_at');
    if (data) setReminders(data);
  };
  
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    loadMessages(client.id);
  };
  
  const handleSendMessage = async (text) => {
    if (!selectedClient) return;
    
    try {
      const response = await fetch(`${API_URL}/api/clients/${selectedClient.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClient.id, text, content_type: 'text' })
      });
      
      if (response.ok) {
        loadMessages(selectedClient.id);
      }
    } catch (e) {
      // Fallback - сохраняем только в базу
      await supabase.from('messages').insert({
        client_id: selectedClient.id,
        direction: 'expert',
        content_type: 'text',
        text_content: text,
        is_read: true
      });
      loadMessages(selectedClient.id);
    }
  };
  
  const handleStatusChange = async (status) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ status }).eq('id', selectedClient.id);
    setSelectedClient(prev => ({ ...prev, status }));
    loadClients();
    loadAnalytics();
  };
  
  const handleNotesChange = async (notes) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ notes }).eq('id', selectedClient.id);
    setSelectedClient(prev => ({ ...prev, notes }));
  };
  
  const handleAddReminder = async (text, date) => {
    if (!selectedClient) return;
    await supabase.from('reminders').insert({
      client_id: selectedClient.id,
      reminder_text: text,
      remind_at: date
    });
    loadReminders();
  };
  
  const handleCompleteReminder = async (reminderId) => {
    await supabase.from('reminders').update({ is_completed: true }).eq('id', reminderId);
    loadReminders();
  };
  
  const handleAddAuthorizedUser = async (userData) => {
    await supabase.from('authorized_users').insert(userData);
    loadAuthorizedUsers();
  };
  
  const handleRemoveAuthorizedUser = async (userId) => {
    await supabase.from('authorized_users').delete().eq('id', userId);
    loadAuthorizedUsers();
  };
  
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Навигация */}
      <nav className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💎</span>
          <span className="text-xl font-bold text-white">Diagnostic CRM</span>
        </div>
        
        <div className="flex gap-2">
          {[
            { id: 'chat', label: '💬 Чаты', count: Object.values(unreadCounts).reduce((a, b) => a + b, 0) },
            { id: 'reminders', label: '🔔 Напоминания', count: reminders.length },
            { id: 'analytics', label: '📊 Аналитика' },
            { id: 'access', label: '👥 Доступ' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-amber-500 text-black'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
      
      {/* Контент */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' && (
          <>
            <div className="w-80">
              <ClientList
                clients={clients}
                selectedClient={selectedClient}
                onSelectClient={handleSelectClient}
                unreadCounts={unreadCounts}
              />
            </div>
            <ChatWindow
              client={selectedClient}
              messages={messages}
              onSendMessage={handleSendMessage}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
              onAddReminder={handleAddReminder}
            />
          </>
        )}
        
        {activeTab === 'analytics' && <Analytics analytics={analytics} />}
        
        {activeTab === 'access' && (
          <AccessManagement
            authorizedUsers={authorizedUsers}
            onAddUser={handleAddAuthorizedUser}
            onRemoveUser={handleRemoveAuthorizedUser}
          />
        )}
        
        {activeTab === 'reminders' && (
          <Reminders
            reminders={reminders}
            onComplete={handleCompleteReminder}
          />
        )}
      </div>
    </div>
  );
}
