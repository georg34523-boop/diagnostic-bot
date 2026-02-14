import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlwjocmcmrplvulqxnik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd2pvY21jbXJwbHZ1bHF4bmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODY5NjgsImV4cCI6MjA4NTg2Mjk2OH0.5jbJRQVUJ2Hcle3bhq3LOtAtRpaHAd5_Slh44_h9apM';
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUSES = {
  new: { label: 'Новий', color: 'bg-zinc-500', order: 1 },
  diagnostic_scheduled: { label: 'Діагностика запланована', color: 'bg-sky-500', order: 2 },
  diagnostic_done: { label: 'Діагностика проведена', color: 'bg-emerald-500', order: 3 },
  call_scheduled: { label: 'Дзвінок запланований', color: 'bg-violet-500', order: 4 },
  call_done: { label: 'Дзвінок проведено', color: 'bg-rose-500', order: 5 },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'щойно';
  if (diffMins < 60) return diffMins + ' хв';
  if (diffHours < 24) return diffHours + ' год';
  if (diffDays < 7) return diffDays + ' дн';
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

// ==================== LOGO ====================
const Logo = ({ size = 'default' }) => (
  <div className={`flex items-center gap-2 ${size === 'large' ? 'text-3xl' : 'text-xl'}`}>
    <span className="font-black tracking-tight">
      <span className="text-white">B</span>
      <span className="text-emerald-400">$</span>
      <span className="text-white">W</span>
    </span>
    <span className={`font-light text-zinc-400 ${size === 'large' ? 'text-2xl' : 'text-base'}`}>Diagnostik</span>
  </div>
);

// ==================== LOGIN PAGE ====================
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password_hash', password)
        .single();
      
      if (error || !data) {
        setError('Невірний email або пароль');
        setLoading(false);
        return;
      }
      
      localStorage.setItem('expert_id', data.id);
      localStorage.setItem('expert_name', data.name);
      localStorage.setItem('expert_email', data.email);
      localStorage.setItem('expert_role', data.role);
      onLogin(data);
    } catch (err) {
      setError('Помилка входу');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="large" />
          <p className="text-zinc-500 mt-4">Увійдіть в систему</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="mb-5">
            <label className="block text-zinc-400 text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="mb-8">
            <label className="block text-zinc-400 text-sm mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-xl transition"
          >
            {loading ? 'Входжу...' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==================== CLIENT LIST ====================
const ClientList = ({ clients, selectedClient, onSelectClient, unreadCounts, onClose, lastMessages }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filteredClients = clients.filter(c => filter === 'all' || c.status === filter).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.first_name?.toLowerCase().includes(s) || c.last_name?.toLowerCase().includes(s) || c.telegram_username?.toLowerCase().includes(s);
  }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      <div className="p-4 border-b border-zinc-800">
        <input type="text" placeholder="Пошук..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition text-sm" />
      </div>
      <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === 'all' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Всі ({clients.length})</button>
        {Object.entries(STATUSES).map(([key, { label }]) => {
          const count = clients.filter(c => c.status === key).length;
          if (count === 0) return null;
          return (<button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === key ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{count}</button>);
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredClients.map((client) => {
          const unread = unreadCounts[client.id] || 0;
          const isSelected = selectedClient?.id === client.id;
          const lastMsg = lastMessages?.[client.id];
          const lastMsgText = lastMsg?.content_type === 'text' ? lastMsg.text_content?.substring(0, 30) + (lastMsg.text_content?.length > 30 ? '...' : '') : lastMsg?.content_type === 'photo' ? '📷 Фото' : lastMsg?.content_type === 'voice' ? '🎤 Аудіо' : lastMsg?.content_type === 'video_note' ? '⭕ Відео' : '';
          return (
            <div key={client.id} onClick={() => { onSelectClient(client); if (onClose) onClose(); }} className={`p-4 border-b border-zinc-800/50 cursor-pointer transition ${isSelected ? 'bg-zinc-900' : 'hover:bg-zinc-900/50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-medium text-lg">{client.first_name?.[0] || '?'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white truncate">{client.first_name} {client.last_name}</span>
                    <span className="text-xs text-zinc-500">{formatDate(client.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-zinc-500 truncate">{lastMsgText || 'Немає повідомлень'}</span>
                    {unread > 0 && <span className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">{unread}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredClients.length === 0 && <div className="p-8 text-center text-zinc-600">Клієнтів не знайдено</div>}
      </div>
    </div>
  );
};

// ==================== CHAT WINDOW ====================
const ChatWindow = ({ client, messages, onSendMessage, onSendFile, onStatusChange, onNotesChange, onAddReminder, onBack, isMobile, templates, onSendTemplate }) => {
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState(client?.notes || '');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => { setNotes(client?.notes || ''); }, [client?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!client) {
    return (<div className="flex-1 flex items-center justify-center bg-black text-zinc-600"><div className="text-center"><div className="text-6xl mb-4 opacity-20">💬</div><div>Оберіть клієнта</div></div></div>);
  }

  const handleSend = () => { if (!newMessage.trim()) return; onSendMessage(newMessage); setNewMessage(''); };
  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onSendFile(file); } catch (err) { alert('Помилка'); }
    setUploading(false);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        setIsRecording(false);
        setUploading(true);
        try { await onSendFile(audioFile, 'voice'); } catch (err) { alert('Помилка'); }
        setUploading(false);
      };
      mediaRecorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) { alert('Немає доступу до мікрофона'); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop(); };
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
      setIsRecording(false);
    }
  };

  const formatRecordingTime = (s) => Math.floor(s/60) + ':' + (s%60).toString().padStart(2,'0');
  const handleAddReminderSubmit = () => { if (!reminderText || !reminderDate) return; onAddReminder(reminderText, reminderDate); setReminderText(''); setReminderDate(''); setShowReminder(false); };

  return (
    <div className="flex-1 flex bg-black relative min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isMobile && (<button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>)}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-medium">{client.first_name?.[0] || '?'}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-white truncate">{client.first_name} {client.last_name}</div>
              <div className="text-sm text-zinc-500 truncate">@{client.telegram_username}</div>
            </div>
          </div>
          <select value={client.status} onChange={(e) => onStatusChange(e.target.value)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500">
            {Object.entries(STATUSES).map(([key, { label }]) => (<option key={key} value={key}>{label}</option>))}
          </select>
          <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'expert' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] md:max-w-md rounded-2xl px-4 py-3 ${msg.direction === 'expert' ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
                {msg.content_type === 'photo' && msg.file_url && <img src={msg.file_url} alt="" className="rounded-lg mb-2 max-w-full cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />}
                {msg.content_type === 'video' && msg.file_url && <video src={msg.file_url} controls className="rounded-lg mb-2 max-w-full" />}
                {msg.content_type === 'video_note' && msg.file_url && <video src={msg.file_url} controls className="rounded-full mb-2 w-48 h-48 object-cover" />}
                {msg.content_type === 'voice' && msg.file_url && <audio src={msg.file_url} controls className="mb-2" />}
                {msg.content_type === 'document' && msg.file_url && (<a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-400 hover:underline mb-2">📄 {msg.file_name || 'Документ'}</a>)}
                {msg.text_content && <div className="break-words">{msg.text_content}</div>}
                <div className={`text-xs mt-1 ${msg.direction === 'expert' ? 'text-zinc-500' : 'text-zinc-500'}`}>{formatFullDate(msg.created_at)}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800">
          {isRecording ? (
            <div className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3">
              <button onClick={cancelRecording} className="p-2 bg-red-500/20 text-red-400 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <div className="flex-1 flex items-center gap-3"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span><span className="text-white">Запис {formatRecordingTime(recordingTime)}</span></div>
              <button onClick={stopRecording} className="p-2 bg-white text-black rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {showTemplates && templates?.length > 0 && (
                <div className="bg-zinc-900 rounded-xl p-2 max-h-40 overflow-y-auto">
                  {templates.map(t => (<button key={t.id} onClick={() => { onSendTemplate(t.content); setShowTemplates(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-800 rounded-lg text-white text-sm"><div className="font-medium">{t.title}</div></button>))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <button onClick={startRecording} disabled={uploading} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                <button onClick={() => setShowTemplates(!showTemplates)} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Повідомлення..." className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition" />
                <button onClick={handleSend} disabled={!newMessage.trim()} className="px-5 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-medium rounded-xl transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Sidebar */}
      {(!isMobile || showSidebar) && (
        <div className={`${isMobile ? 'absolute inset-y-0 right-0 z-20 w-80 shadow-2xl' : 'w-72 hidden md:flex'} bg-zinc-950 border-l border-zinc-800 flex flex-col`}>
          {isMobile && (<div className="p-4 border-b border-zinc-800 flex justify-between items-center"><span className="font-medium text-white">Інформація</span><button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>)}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Контакт</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Telegram</span><span className="text-white">@{client.telegram_username || '—'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Телефон</span><span className="text-white">{client.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{client.email || '—'}</span></div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Нотатки</h3>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Додати..." rows={3} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm resize-none" />
              <button onClick={() => onNotesChange(notes)} className="mt-2 w-full px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm transition">Зберегти</button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Нагадування</h3><button onClick={() => setShowReminder(!showReminder)} className="text-emerald-400 text-xs">+ Додати</button></div>
              {showReminder && (
                <div className="bg-zinc-900 rounded-lg p-3 space-y-2">
                  <input type="text" value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="Текст" className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm" />
                  <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm" />
                  <button onClick={handleAddReminderSubmit} className="w-full px-3 py-2 bg-white text-black font-medium rounded-lg text-sm">Додати</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isMobile && showSidebar && <div className="absolute inset-0 bg-black/60 z-10" onClick={() => setShowSidebar(false)} />}
    </div>
  );
};

// ==================== ANALYTICS ====================
const Analytics = ({ analytics, unreadDialogs, onPeriodChange, period }) => {
  const periods = [{ value: 'all', label: 'Весь час' }, { value: 'week', label: 'Тиждень' }, { value: 'month', label: 'Місяць' }];
  if (!analytics) return null;
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Аналітика</h2>
        <div className="flex gap-2">{periods.map(p => (<button key={p.value} onClick={() => onPeriodChange(p.value)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === p.value ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>{p.label}</button>))}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800"><div className="text-3xl font-bold text-white">{analytics.total_clients}</div><div className="text-zinc-500 mt-1 text-sm">Клієнтів</div></div>
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800"><div className="text-3xl font-bold text-emerald-400">{unreadDialogs}</div><div className="text-zinc-500 mt-1 text-sm">Очікують</div></div>
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800"><div className="text-3xl font-bold text-sky-400">{analytics.conversion_rates?.to_diagnostic || 0}%</div><div className="text-zinc-500 mt-1 text-sm">Конверсія</div></div>
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800"><div className="text-3xl font-bold text-violet-400">{analytics.conversion_rates?.to_call || 0}%</div><div className="text-zinc-500 mt-1 text-sm">В дзвінок</div></div>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h3 className="text-lg font-medium text-white mb-4">Воронка</h3>
        <div className="space-y-4">
          {Object.entries(STATUSES).map(([key, { label, color }]) => {
            const count = analytics.status_counts?.[key] || 0;
            const pct = analytics.total_clients > 0 ? Math.round(count / analytics.total_clients * 100) : 0;
            return (<div key={key} className="flex items-center gap-4"><div className="w-40 text-zinc-400 text-sm">{label}</div><div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden"><div className={`h-full ${color}`} style={{ width: pct + '%' }} /></div><div className="w-20 text-right text-white text-sm">{count}</div></div>);
          })}
        </div>
      </div>
    </div>
  );
};

// ==================== TEMPLATES ====================
const Templates = ({ templates, onAddTemplate, onDeleteTemplate }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const handleAdd = () => { if (!title || !content) return; onAddTemplate({ title, content }); setTitle(''); setContent(''); };
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Шаблони</h2>
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
        <div className="space-y-4">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Назва" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст повідомлення" rows={3} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none" />
          <button onClick={handleAdd} className="px-6 py-3 bg-white text-black font-medium rounded-xl">Додати</button>
        </div>
      </div>
      <div className="space-y-3">
        {templates.map(t => (<div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex justify-between items-start gap-4"><div><div className="font-medium text-white">{t.title}</div><div className="text-zinc-500 text-sm mt-1">{t.content}</div></div><button onClick={() => onDeleteTemplate(t.id)} className="text-red-400 text-sm">×</button></div>))}
        {templates.length === 0 && <div className="text-center text-zinc-600 py-12">Немає шаблонів</div>}
      </div>
    </div>
  );
};

// ==================== REMINDERS ====================
const Reminders = ({ reminders, onComplete, onGoToChat }) => {
  const now = new Date();
  const activeNow = reminders.filter(r => new Date(r.remind_at) <= now);
  const scheduled = reminders.filter(r => new Date(r.remind_at) > now);
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Нагадування</h2>
      {activeNow.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-3">Зараз</h3>
          <div className="space-y-3">{activeNow.map(r => (
            <div key={r.id} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div><div className="text-white">{r.reminder_text}</div><div className="text-zinc-500 text-sm">{r.clients?.first_name} • {formatFullDate(r.remind_at)}</div></div>
              <div className="flex gap-2"><button onClick={() => onGoToChat(r.client_id)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">Відкрити</button><button onClick={() => onComplete(r.id)} className="p-2 bg-emerald-500 text-white rounded-lg">✓</button></div>
            </div>
          ))}</div>
        </div>
      )}
      {scheduled.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Заплановано</h3>
          <div className="space-y-3">{scheduled.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div><div className="text-white">{r.reminder_text}</div><div className="text-zinc-500 text-sm">{r.clients?.first_name} • {formatFullDate(r.remind_at)}</div></div>
              <button onClick={() => onComplete(r.id)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700">✓</button>
            </div>
          ))}</div>
        </div>
      )}
      {reminders.length === 0 && <div className="text-center text-zinc-600 py-12">Немає нагадувань</div>}
    </div>
  );
};

// ==================== BROADCAST ====================
const Broadcast = ({ clients, onSendBroadcast }) => {
  const [message, setMessage] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const filteredClients = clients.filter(c => selectedStatuses.length === 0 || selectedStatuses.includes(c.status));
  const toggleStatus = (status) => setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  const handleSend = async () => {
    if (!message.trim() || filteredClients.length === 0) return;
    setSending(true);
    try {
      const res = await onSendBroadcast(message, filteredClients.map(c => c.id));
      setResult({ success: true, count: res.count });
      setMessage('');
    } catch (err) { setResult({ success: false }); }
    setSending(false);
  };
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Розсилка</h2>
      {result && (<div className={`rounded-xl p-4 mb-6 ${result.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{result.success ? `✓ Надіслано ${result.count} клієнтам` : 'Помилка'}<button onClick={() => setResult(null)} className="ml-4">×</button></div>)}
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
        <h3 className="text-white font-medium mb-4">Отримувачі</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSelectedStatuses([])} className={`px-4 py-2 rounded-lg text-sm ${selectedStatuses.length === 0 ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>Всі ({clients.length})</button>
          {Object.entries(STATUSES).map(([key, { label }]) => (<button key={key} onClick={() => toggleStatus(key)} className={`px-4 py-2 rounded-lg text-sm ${selectedStatuses.includes(key) ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>{label}</button>))}
        </div>
        <div className="text-zinc-500 text-sm">Отримувачів: <span className="text-white font-medium">{filteredClients.length}</span></div>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текст повідомлення..." rows={4} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none mb-4" />
        <button onClick={handleSend} disabled={sending || !message.trim() || filteredClients.length === 0} className="px-6 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-medium rounded-xl">{sending ? 'Надсилаю...' : 'Надіслати'}</button>
      </div>
    </div>
  );
};

// ==================== ACCESS MANAGEMENT ====================
const AccessManagement = ({ authorizedUsers, onAddUser, onRemoveUser }) => {
  const [username, setUsername] = useState('');
  const handleAdd = () => { if (!username) return; onAddUser({ telegram_username: username }); setUsername(''); };
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Доступ до бота</h2>
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
        <div className="flex gap-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" className="flex-1 px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          <button onClick={handleAdd} className="px-6 py-3 bg-white text-black font-medium rounded-xl">Додати</button>
        </div>
      </div>
      <div className="space-y-3">
        {authorizedUsers.map(u => (<div key={u.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex justify-between items-center"><span className="text-white">@{u.telegram_username}</span><button onClick={() => onRemoveUser(u.id)} className="text-red-400">Видалити</button></div>))}
        {authorizedUsers.length === 0 && <div className="text-center text-zinc-600 py-12">Немає користувачів</div>}
      </div>
    </div>
  );
};

// ==================== ADMIN PANEL ====================
const AdminPanel = ({ onSelectExpert, onLogout }) => {
  const [experts, setExperts] = useState([]);
  const [bots, setBots] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [view, setView] = useState('experts'); // experts, bots, stats

  useEffect(() => {
    loadExperts();
    loadBots();
    loadAllClients();
  }, []);

  const loadExperts = async () => {
    const { data } = await supabase.from('experts').select('*').order('created_at');
    if (data) setExperts(data.filter(e => e.role !== 'admin'));
  };

  const loadBots = async () => {
    const { data } = await supabase.from('bots').select('*, experts(name)').order('created_at');
    if (data) setBots(data);
  };

  const loadAllClients = async () => {
    const { data } = await supabase.from('clients').select('*, experts(name)').order('created_at', { ascending: false });
    if (data) setAllClients(data);
  };

  const getExpertStats = (expertId) => {
    const clients = allClients.filter(c => c.expert_id === expertId);
    const total = clients.length;
    const done = clients.filter(c => c.status === 'diagnostic_done' || c.status === 'call_scheduled' || c.status === 'call_done').length;
    return { total, done, conversion: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Header */}
      <nav className="flex-shrink-0 bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {['experts', 'bots', 'stats'].map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === v ? 'bg-white text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                {v === 'experts' ? '👥 Експерти' : v === 'bots' ? '🤖 Боти' : '📊 Статистика'}
              </button>
            ))}
          </div>
          <button onClick={onLogout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {view === 'experts' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Експерти</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {experts.map(expert => {
                const stats = getExpertStats(expert.id);
                const expertBots = bots.filter(b => b.expert_id === expert.id);
                return (
                  <div key={expert.id} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer" onClick={() => onSelectExpert(expert)}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg">{expert.name[0]}</div>
                      <div>
                        <div className="font-medium text-white text-lg">{expert.name}</div>
                        <div className="text-zinc-500 text-sm">{expert.email}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div><div className="text-2xl font-bold text-white">{stats.total}</div><div className="text-zinc-500 text-xs">Клієнтів</div></div>
                      <div><div className="text-2xl font-bold text-emerald-400">{stats.conversion}%</div><div className="text-zinc-500 text-xs">Конверсія</div></div>
                      <div><div className="text-2xl font-bold text-sky-400">{expertBots.length}</div><div className="text-zinc-500 text-xs">Ботів</div></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {expertBots.map(bot => (
                        <span key={bot.id} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">@{bot.bot_username}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {experts.length === 0 && <div className="text-center text-zinc-600 py-12">Немає експертів</div>}
          </div>
        )}

        {view === 'bots' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Боти</h2>
            <div className="space-y-4">
              {bots.map(bot => (
                <div key={bot.id} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl">🤖</div>
                      <div>
                        <div className="font-medium text-white text-lg">@{bot.bot_username}</div>
                        <div className="text-zinc-500 text-sm">{bot.bot_name || 'Без назви'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-400 text-sm">Експерт</div>
                      <div className="text-white">{bot.experts?.name || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {bots.length === 0 && <div className="text-center text-zinc-600 py-12">Немає ботів</div>}
          </div>
        )}

        {view === 'stats' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Загальна статистика</h2>
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                <div className="text-4xl font-bold text-white">{experts.length}</div>
                <div className="text-zinc-500 mt-1">Експертів</div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                <div className="text-4xl font-bold text-emerald-400">{bots.length}</div>
                <div className="text-zinc-500 mt-1">Ботів</div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                <div className="text-4xl font-bold text-sky-400">{allClients.length}</div>
                <div className="text-zinc-500 mt-1">Клієнтів</div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                <div className="text-4xl font-bold text-violet-400">
                  {allClients.length > 0 ? Math.round(allClients.filter(c => ['diagnostic_done', 'call_scheduled', 'call_done'].includes(c.status)).length / allClients.length * 100) : 0}%
                </div>
                <div className="text-zinc-500 mt-1">Конверсія</div>
              </div>
            </div>
            
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h3 className="text-lg font-medium text-white mb-4">По статусах</h3>
              <div className="space-y-3">
                {Object.entries(STATUSES).map(([key, { label, color }]) => {
                  const count = allClients.filter(c => c.status === key).length;
                  const pct = allClients.length > 0 ? Math.round(count / allClients.length * 100) : 0;
                  return (<div key={key} className="flex items-center gap-4"><div className="w-48 text-zinc-400 text-sm">{label}</div><div className="flex-1 bg-zinc-800 rounded-full h-3"><div className={`h-full rounded-full ${color}`} style={{ width: pct + '%' }} /></div><div className="w-16 text-right text-white text-sm">{count}</div></div>);
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== EXPERT CRM DASHBOARD ====================
const ExpertDashboard = ({ expert, onLogout, isAdminView = false, onBackToAdmin }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showClientList, setShowClientList] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [unreadDialogs, setUnreadDialogs] = useState(0);
  const [activeRemindersCount, setActiveRemindersCount] = useState(0);
  
  const selectedClientRef = useRef(null);
  const expertId = expert.id;
  
  useEffect(() => { selectedClientRef.current = selectedClient; }, [selectedClient]);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadClients();
    loadAuthorizedUsers();
    loadReminders();
    loadTemplates();
  }, [expertId]);

  useEffect(() => {
    const clientsSub = supabase.channel('clients-' + expertId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `expert_id=eq.${expertId}` }, () => loadClients())
      .subscribe();
    const msgSub = supabase.channel('messages-' + expertId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new;
        if (selectedClientRef.current?.id === newMsg.client_id) {
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
        setLastMessages(prev => ({ ...prev, [newMsg.client_id]: newMsg }));
        loadUnreadCounts();
        setClients(prev => prev.map(c => c.id === newMsg.client_id ? { ...c, updated_at: new Date().toISOString() } : c).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
      })
      .subscribe();
    return () => { supabase.removeChannel(clientsSub); supabase.removeChannel(msgSub); };
  }, [expertId]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').eq('expert_id', expertId).order('updated_at', { ascending: false });
    if (data) { setClients(data); computeAnalytics(data, analyticsPeriod); loadLastMessages(data); }
    loadUnreadCounts();
  };

  const loadLastMessages = async (clientsList) => {
    const msgs = {};
    for (const client of clientsList) {
      const { data } = await supabase.from('messages').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1);
      if (data?.[0]) msgs[client.id] = data[0];
    }
    setLastMessages(msgs);
  };

  const loadUnreadCounts = async () => {
    const { data: clientsData } = await supabase.from('clients').select('id').eq('expert_id', expertId);
    if (!clientsData) return;
    const { data } = await supabase.from('messages').select('client_id').eq('direction', 'client').eq('is_read', false).in('client_id', clientsData.map(c => c.id));
    if (data) {
      const counts = {};
      data.forEach(m => { counts[m.client_id] = (counts[m.client_id] || 0) + 1; });
      setUnreadCounts(counts);
      setUnreadDialogs(Object.keys(counts).length);
    }
  };

  const loadMessages = async (clientId) => {
    const { data } = await supabase.from('messages').select('*').eq('client_id', clientId).order('created_at');
    if (data) setMessages(data);
    await supabase.from('messages').update({ is_read: true }).eq('client_id', clientId).eq('direction', 'client');
    loadUnreadCounts();
  };

  const loadAuthorizedUsers = async () => { 
    const { data } = await supabase.from('authorized_users').select('*').eq('expert_id', expertId).order('created_at', { ascending: false }); 
    if (data) setAuthorizedUsers(data); 
  };

  const loadReminders = async () => {
    const { data: clientsData } = await supabase.from('clients').select('id').eq('expert_id', expertId);
    if (!clientsData) return;
    const { data } = await supabase.from('reminders').select('*, clients(first_name, last_name)').eq('is_completed', false).in('client_id', clientsData.map(c => c.id)).order('remind_at');
    if (data) { setReminders(data); setActiveRemindersCount(data.filter(r => new Date(r.remind_at) <= new Date()).length); }
  };

  const loadTemplates = async () => {
    const { data } = await supabase.from('message_templates').select('*').eq('expert_id', expertId).order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const handleSelectClient = (client) => { setSelectedClient(client); loadMessages(client.id); if (isMobile) setShowClientList(false); };
  const handleSendMessage = async (text) => {
    if (!selectedClient) return;
    await supabase.from('messages').insert({ client_id: selectedClient.id, direction: 'expert', content_type: 'text', text_content: text, is_read: false });
    loadMessages(selectedClient.id);
  };

  const handleSendFile = async (file, forceContentType = null) => {
    if (!selectedClient) return;
    const filePath = selectedClient.id + '/' + Date.now() + '.' + file.name.split('.').pop();
    await supabase.storage.from('diagnostic-files').upload(filePath, file);
    const { data: { publicUrl } } = supabase.storage.from('diagnostic-files').getPublicUrl(filePath);
    let contentType = forceContentType || (file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'voice' : 'document');
    await supabase.from('messages').insert({ client_id: selectedClient.id, direction: 'expert', content_type: contentType, file_url: publicUrl, file_name: file.name, is_read: false });
    loadMessages(selectedClient.id);
  };

  const handleStatusChange = async (status) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ status, status_changed_at: new Date().toISOString() }).eq('id', selectedClient.id);
    setSelectedClient(prev => ({ ...prev, status }));
    loadClients();
  };

  const handleNotesChange = async (notes) => { 
    if (!selectedClient) return; 
    await supabase.from('clients').update({ notes }).eq('id', selectedClient.id); 
    setSelectedClient(prev => ({ ...prev, notes })); 
  };

  const handleAddReminder = async (text, date) => { 
    if (!selectedClient) return; 
    await supabase.from('reminders').insert({ client_id: selectedClient.id, reminder_text: text, remind_at: date }); 
    loadReminders(); 
  };

  const handleCompleteReminder = async (id) => { await supabase.from('reminders').update({ is_completed: true }).eq('id', id); loadReminders(); };
  const handleAddAuthorizedUser = async (userData) => { await supabase.from('authorized_users').insert({ ...userData, expert_id: expertId, telegram_username: userData.telegram_username?.toLowerCase().replace('@', '') }); loadAuthorizedUsers(); };
  const handleRemoveAuthorizedUser = async (id) => { await supabase.from('authorized_users').delete().eq('id', id); loadAuthorizedUsers(); };
  const handleAddTemplate = async (templateData) => { await supabase.from('message_templates').insert({ ...templateData, expert_id: expertId }); loadTemplates(); };
  const handleDeleteTemplate = async (id) => { await supabase.from('message_templates').delete().eq('id', id); loadTemplates(); };
  const handleGoToChat = (clientId) => { const client = clients.find(c => c.id === clientId); if (client) { setSelectedClient(client); loadMessages(client.id); setActiveTab('chat'); if (isMobile) setShowClientList(false); } };
  const handlePeriodChange = (period) => { setAnalyticsPeriod(period); computeAnalytics(clients, period); };
  const handleSendBroadcast = async (text, clientIds) => { for (const clientId of clientIds) await supabase.from('messages').insert({ client_id: clientId, direction: 'expert', content_type: 'text', text_content: text, is_read: false }); return { count: clientIds.length }; };

  const computeAnalytics = (clientsData, period) => {
    let filtered = clientsData;
    if (period !== 'all') {
      const now = new Date();
      const startDate = period === 'week' ? new Date(now - 7*24*60*60*1000) : period === 'month' ? new Date(now - 30*24*60*60*1000) : null;
      if (startDate) filtered = clientsData.filter(c => new Date(c.status_changed_at || c.created_at) >= startDate);
    }
    const statusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
    filtered.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });
    const total = filtered.length;
    setAnalytics({ total_clients: total, status_counts: statusCounts, conversion_rates: { to_diagnostic: total > 0 ? Math.round((statusCounts.diagnostic_done + statusCounts.call_scheduled + statusCounts.call_done) / total * 100) : 0, to_call: total > 0 ? Math.round(statusCounts.call_done / total * 100) : 0 } });
  };

  const tabs = [
    { id: 'chat', icon: '💬', label: 'Чати', count: unreadDialogs },
    { id: 'broadcast', icon: '📢', label: 'Розсилка' },
    { id: 'reminders', icon: '🔔', label: 'Нагадування', count: activeRemindersCount },
    { id: 'templates', icon: '📝', label: 'Шаблони' },
    { id: 'analytics', icon: '📊', label: 'Аналітика' },
    { id: 'access', icon: '👥', label: 'Доступ' },
  ];

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <nav className="flex-shrink-0 bg-zinc-950 border-b border-zinc-800 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isAdminView && (
            <button onClick={onBackToAdmin} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <Logo />
          {isAdminView && <span className="text-zinc-500 text-sm hidden md:inline">/ {expert.name}</span>}
        </div>
        <div className="flex gap-1 md:gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'chat' && isMobile) setShowClientList(true); }} className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm ${activeTab === tab.id ? 'bg-white text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}>
              <span>{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              {tab.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-black/20' : tab.id === 'reminders' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>
        {!isAdminView && (
          <button onClick={onLogout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        )}
      </nav>
      
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <>
            <div className={`${isMobile ? (showClientList ? 'w-full' : 'hidden') : 'w-80'} flex-shrink-0`}>
              <ClientList clients={clients} selectedClient={selectedClient} onSelectClient={handleSelectClient} unreadCounts={unreadCounts} lastMessages={lastMessages} onClose={() => setShowClientList(false)} />
            </div>
            <div className={`flex-1 min-w-0 ${isMobile && showClientList ? 'hidden' : 'flex'}`}>
              <ChatWindow client={selectedClient} messages={messages} onSendMessage={handleSendMessage} onSendFile={handleSendFile} onStatusChange={handleStatusChange} onNotesChange={handleNotesChange} onAddReminder={handleAddReminder} onBack={() => setShowClientList(true)} isMobile={isMobile} templates={templates} onSendTemplate={handleSendMessage} />
            </div>
          </>
        )}
        {activeTab === 'broadcast' && <Broadcast clients={clients} onSendBroadcast={handleSendBroadcast} />}
        {activeTab === 'analytics' && <Analytics analytics={analytics} unreadDialogs={unreadDialogs} onPeriodChange={handlePeriodChange} period={analyticsPeriod} />}
        {activeTab === 'access' && <AccessManagement authorizedUsers={authorizedUsers} onAddUser={handleAddAuthorizedUser} onRemoveUser={handleRemoveAuthorizedUser} />}
        {activeTab === 'reminders' && <Reminders reminders={reminders} onComplete={handleCompleteReminder} onGoToChat={handleGoToChat} />}
        {activeTab === 'templates' && <Templates templates={templates} onAddTemplate={handleAddTemplate} onDeleteTemplate={handleDeleteTemplate} />}
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingExpert, setViewingExpert] = useState(null);

  useEffect(() => {
    const expertId = localStorage.getItem('expert_id');
    const expertName = localStorage.getItem('expert_name');
    const expertEmail = localStorage.getItem('expert_email');
    const expertRole = localStorage.getItem('expert_role');
    if (expertId) setUser({ id: expertId, name: expertName, email: expertEmail, role: expertRole });
    setLoading(false);
  }, []);

  const handleLogin = (userData) => setUser(userData);
  
  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setViewingExpert(null);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-emerald-400">Завантаження...</div></div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  // Адмін бачить AdminPanel або CRM експерта
  if (user.role === 'admin') {
    if (viewingExpert) {
      return <ExpertDashboard expert={viewingExpert} onLogout={handleLogout} isAdminView={true} onBackToAdmin={() => setViewingExpert(null)} />;
    }
    return <AdminPanel onSelectExpert={setViewingExpert} onLogout={handleLogout} />;
  }

  // Експерт бачить свою CRM
  return <ExpertDashboard expert={user} onLogout={handleLogout} />;
}
