import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlwjocmcmrplvulqxnik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd2pvY21jbXJwbHZ1bHF4bmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODY5NjgsImV4cCI6MjA4NTg2Mjk2OH0.5jbJRQVUJ2Hcle3bhq3LOtAtRpaHAd5_Slh44_h9apM';
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUSES = {
  new: { label: 'Новий', color: 'bg-zinc-500' },
  diagnostic_scheduled: { label: 'Діагн. заплан.', color: 'bg-sky-500' },
  diagnostic_done: { label: 'Діагн. пров.', color: 'bg-emerald-500' },
  call_scheduled: { label: 'Дзвін. заплан.', color: 'bg-violet-500' },
  call_done: { label: 'Дзвін. пров.', color: 'bg-rose-500' },
};

const formatDate = (d) => { if (!d) return ''; const date = new Date(d); const now = new Date(); const diff = Math.floor((now - date) / 60000); if (diff < 1) return 'щойно'; if (diff < 60) return diff + ' хв'; if (diff < 1440) return Math.floor(diff / 60) + ' год'; if (diff < 10080) return Math.floor(diff / 1440) + ' дн'; return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }); };
const formatFullDate = (d) => d ? new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

// ==================== LOGO ====================
const Logo = ({ size = 'default' }) => (
  <div className={`flex items-center gap-2 ${size === 'large' ? 'text-3xl' : 'text-xl'}`}>
    <span className="font-black tracking-tight"><span className="text-white">B</span><span className="text-emerald-400">$</span><span className="text-white">W</span></span>
    <span className={`font-light text-zinc-400 ${size === 'large' ? 'text-2xl' : 'text-base'}`}>Diagnostik</span>
  </div>
);

// ==================== BOT SELECTOR ====================
const BotSelector = ({ bots, activeBot, onSelectBot, onAddBot }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!activeBot) return null;
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition">
        <span className="text-lg">🤖</span>
        <span className="text-white font-medium max-w-32 truncate">@{activeBot.bot_username}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
            {bots.map(bot => (
              <button key={bot.id} onClick={() => { onSelectBot(bot); setIsOpen(false); }} className={`w-full px-4 py-3 flex items-center gap-3 transition ${activeBot.id === bot.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                <span className="text-lg">🤖</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium truncate">@{bot.bot_username}</div>
                  <div className="text-xs text-zinc-500 truncate">{bot.bot_name}</div>
                </div>
                {activeBot.id === bot.id && <span className="text-emerald-400">✓</span>}
              </button>
            ))}
            <div className="border-t border-zinc-800" />
            <button onClick={() => { onAddBot(); setIsOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-emerald-400 hover:bg-zinc-800 transition">
              <span className="text-lg">➕</span>
              <span>Додати бота</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

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
    const { data, error } = await supabase.from('experts').select('*').eq('email', email.toLowerCase().trim()).eq('password_hash', password).single();
    if (error || !data) { setError('Невірний email або пароль'); setLoading(false); return; }
    localStorage.setItem('expert_id', data.id);
    localStorage.setItem('expert_name', data.name);
    localStorage.setItem('expert_email', data.email);
    localStorage.setItem('expert_role', data.role);
    onLogin(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><Logo size="large" /><p className="text-zinc-500 mt-4">Увійдіть в систему</p></div>
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          <div className="mb-5">
            <label className="block text-zinc-400 text-sm mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition" placeholder="your@email.com" required />
          </div>
          <div className="mb-8">
            <label className="block text-zinc-400 text-sm mb-2">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition" placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-xl transition">{loading ? 'Входжу...' : 'Увійти'}</button>
        </form>
      </div>
    </div>
  );
};

// ==================== CLIENT LIST ====================
const ClientList = ({ clients, selectedClient, onSelectClient, unreadCounts, lastMessages, onClose }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c => filter === 'all' || c.status === filter).filter(c => !search || c.first_name?.toLowerCase().includes(search.toLowerCase()) || c.last_name?.toLowerCase().includes(search.toLowerCase()) || c.telegram_username?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      <div className="p-4 border-b border-zinc-800">
        <input type="text" placeholder="Пошук..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition text-sm" />
      </div>
      <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === 'all' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>Всі ({clients.length})</button>
        {Object.entries(STATUSES).map(([key, { label }]) => {
          const count = clients.filter(c => c.status === key).length;
          return <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === key ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>{label.split(' ')[0]} ({count})</button>;
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((client) => {
          const unread = unreadCounts[client.id] || 0;
          const isSelected = selectedClient?.id === client.id;
          const lastMsg = lastMessages?.[client.id];
          const preview = lastMsg?.content_type === 'text' ? lastMsg.text_content?.substring(0, 30) + (lastMsg.text_content?.length > 30 ? '...' : '') : lastMsg?.content_type === 'photo' ? '📷 Фото' : lastMsg?.content_type === 'voice' ? '🎤 Аудіо' : lastMsg?.content_type === 'video_note' ? '⭕ Відео' : '';
          return (
            <div key={client.id} onClick={() => { onSelectClient(client); if (onClose) onClose(); }} className={`p-4 border-b border-zinc-800/50 cursor-pointer transition ${isSelected ? 'bg-zinc-900' : 'hover:bg-zinc-900/50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-medium text-lg">{client.first_name?.[0] || '?'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between"><span className="font-medium text-white truncate">{client.first_name} {client.last_name}</span><span className="text-xs text-zinc-500">{formatDate(client.updated_at)}</span></div>
                  <div className="flex items-center justify-between mt-1"><span className="text-sm text-zinc-500 truncate">{preview || 'Немає повідомлень'}</span>{unread > 0 && <span className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">{unread}</span>}</div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-8 text-center text-zinc-600">Клієнтів не знайдено</div>}
      </div>
    </div>
  );
};

// ==================== CHAT WINDOW ====================
const ChatWindow = ({ client, messages, onSendMessage, onSendFile, onStatusChange, onNotesChange, onAddReminder, onBack, isMobile, templates, onSendTemplate, onSendToSales, googleSheetUrl }) => {
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState(client?.notes || '');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('all');
  const [salesComment, setSalesComment] = useState('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [sendingSales, setSendingSales] = useState(false);
  const [salesSuccess, setSalesSuccess] = useState(false);
  
  // Recording states
  const [recordingMode, setRecordingMode] = useState('audio'); // 'audio' або 'video'
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => { setNotes(client?.notes || ''); }, [client?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  if (!client) return <div className="flex-1 flex items-center justify-center bg-black text-zinc-600"><div className="text-center"><div className="text-6xl mb-4 opacity-20">💬</div><div>Оберіть клієнта</div></div></div>;

  const handleSend = () => { if (!newMessage.trim()) return; onSendMessage(newMessage); setNewMessage(''); };
  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleFileSelect = async (e) => { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    setShowAttachMenu(false);
    setUploading(true); 
    try { await onSendFile(file); } catch (err) { alert('Помилка'); } 
    setUploading(false); 
    e.target.value = ''; 
  };
  
  const handleSelectTemplate = async (template) => {
    setShowTemplates(false);
    if (template.type === 'text') {
      onSendTemplate(template.content);
    } else if (template.file_url) {
      setUploading(true);
      try {
        await onSendFile(null, template.type, template.file_url, template.content);
      } catch (err) {
        alert('Помилка');
      }
      setUploading(false);
    }
  };
  
  // ========== RECORDING FUNCTIONS ==========
  const openRecordingModal = async () => {
    setShowRecordingModal(true);
    setRecordedBlob(null);
    setRecordingTime(0);
    
    try {
      const constraints = recordingMode === 'video' 
        ? { video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: true }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Показуємо превью для відео
      if (recordingMode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
    } catch (err) {
      alert('Немає доступу до ' + (recordingMode === 'video' ? 'камери' : 'мікрофона'));
      setShowRecordingModal(false);
    }
  };
  
  const startRecording = () => {
    if (!streamRef.current || isRecording) return;
    
    // Вибираємо підтримуваний формат
    let mimeType = recordingMode === 'video' ? 'video/webm' : 'audio/webm';
    if (recordingMode === 'video') {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
      else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mimeType = 'video/webm;codecs=vp8';
      else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
    } else {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
    }
    
    try {
      const options = { mimeType };
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
      };
      
      mediaRecorder.start(100); // Збираємо дані кожні 100ms
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert('Помилка запису: ' + err.message);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setShowRecordingModal(false);
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordingTime(0);
  };
  
  const sendRecording = async () => {
    if (!recordedBlob) return;
    
    // Зупиняємо стрім
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setShowRecordingModal(false);
    setUploading(true);
    
    try {
      const ext = recordingMode === 'video' ? 'webm' : 'webm';
      const fileName = `${recordingMode}_${Date.now()}.${ext}`;
      const file = new File([recordedBlob], fileName, { type: recordedBlob.type });
      await onSendFile(file, recordingMode === 'video' ? 'video_note' : 'voice');
    } catch (err) {
      alert('Помилка відправки: ' + err.message);
    }
    
    setUploading(false);
    setRecordedBlob(null);
    setRecordingTime(0);
  };
  
  const retryRecording = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
    // Стрім ще активний, можна записати знову
    if (!streamRef.current) {
      openRecordingModal();
    }
  };
  
  const formatRecordingTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };
  
  const handleSendToSales = async () => {
    if (!googleSheetUrl) {
      alert('URL Google таблиці не налаштовано. Додайте його в налаштуваннях бота.');
      return;
    }
    
    setSendingSales(true);
    try {
      const data = {
        name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
        phone: client.phone || '',
        username: client.telegram_username || '',
        email: client.email || '',
        status: STATUSES[client.status]?.label || client.status,
        comment: salesComment,
        date: new Date().toLocaleString('uk-UA')
      };
      
      const response = await fetch(googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      setSalesSuccess(true);
      setSalesComment('');
      setTimeout(() => {
        setShowSalesModal(false);
        setSalesSuccess(false);
      }, 2000);
    } catch (err) {
      alert('Помилка: ' + err.message);
    }
    setSendingSales(false);
  };

  const handleAddReminderSubmit = () => { if (!reminderText || !reminderDate) return; onAddReminder(reminderText, reminderDate); setReminderText(''); setReminderDate(''); setShowReminder(false); };

  return (
    <div className="flex-1 flex bg-black relative min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isMobile && <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-medium">{client.first_name?.[0] || '?'}</div>
            <div className="min-w-0 flex-1"><div className="font-medium text-white truncate">{client.first_name} {client.last_name}</div><div className="text-sm text-zinc-500 truncate">@{client.telegram_username}</div></div>
          </div>
          <select value={client.status} onChange={(e) => onStatusChange(e.target.value)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500">{Object.entries(STATUSES).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}</select>
          <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 md:hidden"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'expert' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] md:max-w-md rounded-2xl px-4 py-3 ${msg.direction === 'expert' ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
                {msg.content_type === 'photo' && msg.file_url && <img src={msg.file_url} alt="" className="rounded-lg mb-2 max-w-full cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />}
                {msg.content_type === 'video' && msg.file_url && <video src={msg.file_url} controls className="rounded-lg mb-2 max-w-full" />}
                {msg.content_type === 'video_note' && msg.file_url && <video src={msg.file_url} controls className="rounded-full mb-2 w-48 h-48 object-cover" />}
                {msg.content_type === 'voice' && msg.file_url && <audio src={msg.file_url} controls className="mb-2" />}
                {msg.content_type === 'document' && msg.file_url && <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-400 hover:underline mb-2">📄 {msg.file_name || 'Документ'}</a>}
                {msg.text_content && <div className="break-words">{msg.text_content}</div>}
                <div className={`text-xs mt-1 ${msg.direction === 'expert' ? 'text-zinc-500' : 'text-zinc-500'}`}>{formatFullDate(msg.created_at)}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-3 bg-zinc-950 border-t border-zinc-800">
          <div className="flex flex-col gap-2">
            {/* Attachment menu */}
            {showAttachMenu && (
              <div className="bg-zinc-900 rounded-2xl p-2 flex flex-wrap gap-1">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="hidden" />
                <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex-1 min-w-[80px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm flex flex-col items-center gap-1 transition">
                  <span className="text-lg">📷</span><span>Фото</span>
                </button>
                <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex-1 min-w-[80px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm flex flex-col items-center gap-1 transition">
                  <span className="text-lg">📄</span><span>Файл</span>
                </button>
                <button onClick={() => { setShowTemplates(true); setShowAttachMenu(false); }} className="flex-1 min-w-[80px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm flex flex-col items-center gap-1 transition">
                  <span className="text-lg">📋</span><span>Шаблони</span>
                </button>
              </div>
            )}
            
            {/* Templates menu */}
            {showTemplates && templates?.length > 0 && (
              <div className="bg-zinc-900 rounded-2xl p-3 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
                  <div className="flex gap-1 overflow-x-auto">
                    <button onClick={() => setTemplateFilter('all')} className={`px-2 py-1 rounded text-xs whitespace-nowrap ${templateFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>Всі</button>
                    <button onClick={() => setTemplateFilter('text')} className={`px-2 py-1 rounded text-xs ${templateFilter === 'text' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>📝</button>
                    <button onClick={() => setTemplateFilter('voice')} className={`px-2 py-1 rounded text-xs ${templateFilter === 'voice' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>🎤</button>
                    <button onClick={() => setTemplateFilter('video_note')} className={`px-2 py-1 rounded text-xs ${templateFilter === 'video_note' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>⭕</button>
                    <button onClick={() => setTemplateFilter('photo')} className={`px-2 py-1 rounded text-xs ${templateFilter === 'photo' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>📷</button>
                  </div>
                  <button onClick={() => setShowTemplates(false)} className="text-zinc-500 hover:text-white p-1">✕</button>
                </div>
                {templates.filter(t => templateFilter === 'all' || t.type === templateFilter).map(t => (
                  <button key={t.id} onClick={() => handleSelectTemplate(t)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 rounded-lg text-white text-sm flex items-center gap-3">
                    <span className="text-lg">{t.type === 'voice' ? '🎤' : t.type === 'video_note' ? '⭕' : t.type === 'photo' ? '📷' : t.type === 'video' ? '🎬' : '📝'}</span>
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {templates.filter(t => templateFilter === 'all' || t.type === templateFilter).length === 0 && (
                  <div className="text-zinc-500 text-sm text-center py-4">Немає шаблонів</div>
                )}
              </div>
            )}
            
            {/* Main input row */}
            <div className="flex items-center gap-2">
              {/* Attach button */}
              <button 
                onClick={() => { setShowAttachMenu(!showAttachMenu); setShowTemplates(false); }} 
                disabled={uploading} 
                className={`p-3 rounded-full transition ${showAttachMenu ? 'bg-emerald-500 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              {/* Text input */}
              <input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                onKeyPress={handleKeyPress} 
                placeholder="Повідомлення..." 
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition" 
              />
              
              {/* Send or Record button */}
              {newMessage.trim() ? (
                <button onClick={handleSend} className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  {/* Mode toggle */}
                  <button 
                    onClick={() => setRecordingMode(recordingMode === 'audio' ? 'video' : 'audio')}
                    className="p-2 text-zinc-600 hover:text-zinc-400 transition text-lg"
                    title="Перемкнути режим"
                  >
                    {recordingMode === 'audio' ? '⭕' : '🎤'}
                  </button>
                  
                  {/* Record button - opens modal */}
                  <button 
                    onClick={openRecordingModal}
                    disabled={uploading} 
                    className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-full transition"
                  >
                    {recordingMode === 'audio' ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center">
                        <div className="w-2 h-2 bg-current rounded-full"></div>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Recording Modal */}
        {showRecordingModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-3xl p-6 w-full max-w-sm">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  {recordingMode === 'video' ? 'Запис кружка' : 'Запис голосового'}
                </h3>
              </div>
              
              {/* Video preview / Audio visualizer */}
              <div className="flex justify-center mb-6">
                {recordingMode === 'video' ? (
                  <div className="relative w-52 h-52 rounded-full overflow-hidden bg-zinc-800">
                    {!recordedBlob ? (
                      <video 
                        ref={videoPreviewRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <video 
                        src={URL.createObjectURL(recordedBlob)} 
                        controls
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    )}
                    {isRecording && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        {formatRecordingTime(recordingTime)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-52 h-52 rounded-full bg-zinc-800 flex items-center justify-center">
                    {recordedBlob ? (
                      <audio src={URL.createObjectURL(recordedBlob)} controls className="w-40" />
                    ) : (
                      <div className="text-center">
                        <div className={`text-6xl mb-2 ${isRecording ? 'animate-pulse' : ''}`}>🎤</div>
                        {isRecording && (
                          <div className="text-white text-2xl font-mono">{formatRecordingTime(recordingTime)}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Controls */}
              <div className="flex justify-center gap-4">
                {!isRecording && !recordedBlob && (
                  <>
                    <button onClick={cancelRecording} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button onClick={startRecording} className="p-6 bg-red-500 hover:bg-red-600 text-white rounded-full transition">
                      <div className="w-6 h-6 bg-white rounded-full"></div>
                    </button>
                  </>
                )}
                
                {isRecording && (
                  <>
                    <button onClick={cancelRecording} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button onClick={stopRecording} className="p-6 bg-red-500 hover:bg-red-600 text-white rounded-full transition animate-pulse">
                      <div className="w-6 h-6 bg-white rounded-sm"></div>
                    </button>
                  </>
                )}
                
                {recordedBlob && (
                  <>
                    <button onClick={retryRecording} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button onClick={cancelRecording} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-full transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button onClick={sendRecording} className="p-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              
              <p className="text-center text-zinc-500 text-sm mt-4">
                {!isRecording && !recordedBlob && 'Натисніть червону кнопку для початку запису'}
                {isRecording && 'Натисніть квадрат для зупинки'}
                {recordedBlob && 'Прослухайте та надішліть або перезапишіть'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {(!isMobile || showSidebar) && (
        <div className={`${isMobile ? 'absolute inset-y-0 right-0 z-20 w-80 shadow-2xl' : 'w-72 hidden md:flex'} bg-zinc-950 border-l border-zinc-800 flex flex-col`}>
          {isMobile && <div className="p-4 border-b border-zinc-800 flex justify-between items-center"><span className="font-medium text-white">Інформація</span><button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div><h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Контакт</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Telegram</span><span className="text-white">@{client.telegram_username || '—'}</span></div><div className="flex justify-between"><span className="text-zinc-500">Телефон</span><span className="text-white">{client.phone || '—'}</span></div><div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{client.email || '—'}</span></div></div></div>
            
            {/* Передати в продажі */}
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Продажі</h3>
              <button onClick={() => setShowSalesModal(true)} className="w-full px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-medium rounded-xl transition flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Передати в продажі
              </button>
            </div>
            
            <div><h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Нотатки</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Додати..." rows={3} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm resize-none" /><button onClick={() => onNotesChange(notes)} className="mt-2 w-full px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm transition">Зберегти</button></div>
            <div><div className="flex items-center justify-between mb-3"><h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Нагадування</h3><button onClick={() => setShowReminder(!showReminder)} className="text-emerald-400 text-xs">+ Додати</button></div>{showReminder && <div className="bg-zinc-900 rounded-lg p-3 space-y-2"><input type="text" value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="Текст" className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm" /><input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm" /><button onClick={handleAddReminderSubmit} className="w-full px-3 py-2 bg-white text-black font-medium rounded-lg text-sm">Додати</button></div>}</div>
          </div>
        </div>
      )}
      {isMobile && showSidebar && <div className="absolute inset-0 bg-black/60 z-10" onClick={() => setShowSidebar(false)} />}
      
      {/* Модалка передачі в продажі */}
      {showSalesModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Передати в продажі</h3>
              <button onClick={() => setShowSalesModal(false)} className="text-zinc-400 hover:text-white text-2xl">×</button>
            </div>
            
            {salesSuccess ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <div className="text-white font-medium">Успішно передано!</div>
              </div>
            ) : (
              <>
                <div className="bg-black/50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Ім'я:</span><span className="text-white">{client.first_name} {client.last_name}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Telegram:</span><span className="text-white">@{client.telegram_username || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Телефон:</span><span className="text-white">{client.phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Email:</span><span className="text-white">{client.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Статус:</span><span className="text-white">{STATUSES[client.status]?.label}</span></div>
                </div>
                
                <div className="mb-4">
                  <label className="text-sm text-zinc-400 mb-2 block">Коментар для відділу продажів</label>
                  <textarea value={salesComment} onChange={(e) => setSalesComment(e.target.value)} placeholder="Додайте коментар..." rows={3} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none" />
                </div>
                
                <button onClick={handleSendToSales} disabled={sendingSales} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-semibold rounded-xl transition">
                  {sendingSales ? 'Надсилаю...' : 'Надіслати'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== ANALYTICS ====================
const Analytics = ({ clients, bots, unreadDialogs, onPeriodChange, period, isExpertView = true }) => {
  const [selectedBot, setSelectedBot] = useState('all');
  const periods = [
    { value: 'today', label: 'Сьогодні' },
    { value: 'week', label: 'Тиждень' },
    { value: 'month', label: 'Місяць' },
    { value: 'all', label: 'Весь час' }
  ];
  
  // Фільтрація по періоду
  const getFilteredByPeriod = (data) => {
    if (period === 'all') return data;
    const now = new Date();
    let start;
    if (period === 'today') start = new Date(now.setHours(0,0,0,0));
    else if (period === 'week') start = new Date(now - 7*24*60*60*1000);
    else start = new Date(now - 30*24*60*60*1000);
    return data.filter(c => new Date(c.created_at) >= start);
  };
  
  // Фільтрація по боту
  const getFilteredByBot = (data) => {
    if (selectedBot === 'all') return data;
    return data.filter(c => c.bot_id === selectedBot);
  };
  
  // Унікальні клієнти по telegram_id (для загальної статистики)
  const getUniqueClients = (data) => {
    const uniqueMap = new Map();
    data.forEach(c => {
      if (!uniqueMap.has(c.telegram_id) || new Date(c.created_at) < new Date(uniqueMap.get(c.telegram_id).created_at)) {
        uniqueMap.set(c.telegram_id, c);
      }
    });
    return Array.from(uniqueMap.values());
  };
  
  const filteredByPeriod = getFilteredByPeriod(clients);
  const filteredByBot = getFilteredByBot(filteredByPeriod);
  
  // Для загальних показників - унікальні клієнти
  const uniqueClients = selectedBot === 'all' ? getUniqueClients(filteredByPeriod) : filteredByBot;
  
  // Статуси
  const statusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
  uniqueClients.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });
  
  const total = uniqueClients.length;
  const converted = statusCounts.diagnostic_done + statusCounts.call_scheduled + statusCounts.call_done;
  const conversionRate = total > 0 ? Math.round(converted / total * 100) : 0;
  
  // Динаміка по днях (останні 14 днів)
  const getDynamicsData = () => {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayClients = (selectedBot === 'all' ? clients : clients.filter(c => c.bot_id === selectedBot))
        .filter(c => {
          const created = new Date(c.created_at);
          return created >= date && created < nextDate;
        });
      
      // Унікальні за день
      const uniqueDay = selectedBot === 'all' ? getUniqueClients(dayClients) : dayClients;
      
      days.push({
        date: date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
        count: uniqueDay.length
      });
    }
    return days;
  };
  
  const dynamicsData = getDynamicsData();
  const maxCount = Math.max(...dynamicsData.map(d => d.count), 1);
  
  // Статистика по ботах
  const getBotStats = () => {
    return bots.map(bot => {
      const botClients = filteredByPeriod.filter(c => c.bot_id === bot.id);
      const botStatusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
      botClients.forEach(c => { if (botStatusCounts[c.status] !== undefined) botStatusCounts[c.status]++; });
      const botConverted = botStatusCounts.diagnostic_done + botStatusCounts.call_scheduled + botStatusCounts.call_done;
      return {
        ...bot,
        clientsCount: botClients.length,
        conversion: botClients.length > 0 ? Math.round(botConverted / botClients.length * 100) : 0,
        statusCounts: botStatusCounts
      };
    });
  };
  
  const botStats = getBotStats();
  
  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Аналітика</h2>
        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <button key={p.value} onClick={() => onPeriodChange(p.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${period === p.value ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Bot Filter */}
      {bots.length > 1 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedBot('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedBot === 'all' ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              Всі боти
            </button>
            {bots.map(bot => (
              <button key={bot.id} onClick={() => setSelectedBot(bot.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedBot === bot.id ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                @{bot.bot_username}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-white">{total}</div>
          <div className="text-zinc-500 mt-1 text-sm">{selectedBot === 'all' ? 'Унік. клієнтів' : 'Клієнтів'}</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-emerald-400">{conversionRate}%</div>
          <div className="text-zinc-500 mt-1 text-sm">Конверсія</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-sky-400">{statusCounts.diagnostic_done}</div>
          <div className="text-zinc-500 mt-1 text-sm">Діагностик</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-violet-400">{statusCounts.call_done}</div>
          <div className="text-zinc-500 mt-1 text-sm">Дзвінків</div>
        </div>
      </div>
      
      {/* Dynamics Chart */}
      <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Нові клієнти (14 днів)</h3>
        <div className="flex items-end gap-1 h-32">
          {dynamicsData.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-zinc-800 rounded-t relative" style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}>
                <div className="absolute inset-0 bg-emerald-500 rounded-t opacity-80"></div>
              </div>
              <span className="text-xs text-zinc-600 truncate w-full text-center hidden md:block">{day.date}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 md:hidden">
          <span className="text-xs text-zinc-500">{dynamicsData[0]?.date}</span>
          <span className="text-xs text-zinc-500">{dynamicsData[dynamicsData.length - 1]?.date}</span>
        </div>
      </div>
      
      {/* Funnel */}
      <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Воронка</h3>
        <div className="space-y-3">
          {Object.entries(STATUSES).map(([key, { label, color }]) => {
            const count = statusCounts[key] || 0;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 md:w-36 text-zinc-400 text-sm truncate">{label}</div>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div className={`h-full ${color} transition-all duration-500`} style={{ width: pct + '%' }} />
                </div>
                <div className="w-12 text-right text-white text-sm font-medium">{count}</div>
                <div className="w-12 text-right text-zinc-500 text-sm">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Bot Stats (тільки якщо вибрано "Всі боти") */}
      {selectedBot === 'all' && bots.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
          <h3 className="text-lg font-medium text-white mb-4">Статистика по ботах</h3>
          <div className="space-y-3">
            {botStats.map(bot => (
              <div key={bot.id} className="bg-black/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🤖</span>
                    <span className="text-white font-medium">@{bot.bot_username}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-white font-bold">{bot.clientsCount}</div>
                      <div className="text-xs text-zinc-500">клієнтів</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold">{bot.conversion}%</div>
                      <div className="text-xs text-zinc-500">конверсія</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(STATUSES).map(([key, { label, color }]) => (
                    <div key={key} className="flex-1 text-center">
                      <div className={`text-sm font-medium ${color.replace('bg-', 'text-')}`}>{bot.statusCounts[key]}</div>
                      <div className="text-xs text-zinc-600 truncate">{label.split(' ')[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== TEMPLATES ====================
const Templates = ({ templates, onAddTemplate, onDeleteTemplate }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('text');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  
  const types = [
    { value: 'text', label: 'Текст', icon: '📝' },
    { value: 'voice', label: 'Голосове', icon: '🎤' },
    { value: 'video_note', label: 'Кружок', icon: '⭕' },
    { value: 'photo', label: 'Фото', icon: '📷' },
    { value: 'video', label: 'Відео', icon: '🎬' }
  ];
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };
  
  // ===== AUDIO RECORDING =====
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Вибираємо підтримуваний формат
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert('Немає доступу до мікрофона: ' + err.message);
    }
  };
  
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      setAudioBlob(null);
    }
  };
  
  // ===== VIDEO RECORDING (круглий кружок) =====
  const openVideoRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, 
        audio: true 
      });
      streamRef.current = stream;
      setShowVideoRecorder(true);
      
      // Даємо час на рендер
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      alert('Немає доступу до камери: ' + err.message);
    }
  };
  
  const startVideoRecording = () => {
    if (!streamRef.current) return;
    
    // Вибираємо підтримуваний формат
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }
    }
    
    const options = mimeType ? { mimeType } : {};
    const mediaRecorder = new MediaRecorder(streamRef.current, options);
    mediaRecorderRef.current = mediaRecorder;
    videoChunksRef.current = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      setVideoBlob(blob);
      clearInterval(recordingTimerRef.current);
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
  };
  
  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Зупиняємо стрім
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };
  
  const cancelVideoRecorder = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setShowVideoRecorder(false);
    setIsRecording(false);
    setRecordingTime(0);
    setVideoBlob(null);
  };
  
  const deleteRecording = () => {
    setAudioBlob(null);
    setVideoBlob(null);
    setRecordingTime(0);
  };
  
  const formatTime = (s) => Math.floor(s/60) + ':' + (s%60).toString().padStart(2,'0');
  
  const handleAdd = async () => {
    if (!title) return;
    if (type === 'text' && !content) return;
    if (type === 'voice' && !audioBlob && !file) return;
    if (type === 'video_note' && !videoBlob && !file) return;
    if ((type === 'photo' || type === 'video') && !file) return;
    
    setUploading(true);
    try {
      let fileUrl = null;
      
      // Якщо є записане аудіо
      if (type === 'voice' && audioBlob) {
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const fileName = `templates/${Date.now()}_voice.webm`;
        const { error } = await supabase.storage.from('diagnostic-files').upload(fileName, audioFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('diagnostic-files').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      } 
      // Якщо є записане відео-кружок
      else if (type === 'video_note' && videoBlob) {
        const videoFile = new File([videoBlob], `video_note_${Date.now()}.webm`, { type: 'video/webm' });
        const fileName = `templates/${Date.now()}_video_note.webm`;
        const { error } = await supabase.storage.from('diagnostic-files').upload(fileName, videoFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('diagnostic-files').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
      else if (file) {
        const fileName = `templates/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('diagnostic-files').upload(fileName, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('diagnostic-files').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
      
      await onAddTemplate({ 
        title, 
        content: type === 'text' ? content : title,
        type,
        file_url: fileUrl
      });
      
      setTitle('');
      setContent('');
      setType('text');
      setFile(null);
      setAudioBlob(null);
      setVideoBlob(null);
      setRecordingTime(0);
      setShowVideoRecorder(false);
    } catch (err) {
      alert('Помилка: ' + err.message);
    }
    setUploading(false);
  };
  
  const filteredTemplates = filter === 'all' ? templates : templates.filter(t => t.type === filter);
  
  const getTypeIcon = (t) => types.find(x => x.value === t)?.icon || '📝';
  
  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 md:p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Шаблони</h2>
      
      {/* Форма додавання */}
      <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
        <div className="space-y-4">
          {/* Тип шаблону */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Тип</label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <button key={t.value} onClick={() => { setType(t.value); setFile(null); setAudioBlob(null); setVideoBlob(null); setRecordingTime(0); setShowVideoRecorder(false); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${type === t.value ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  <span>{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Назва */}
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Назва шаблону" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          
          {/* Контент залежно від типу */}
          {type === 'text' ? (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст повідомлення" rows={3} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none" />
          ) : type === 'voice' ? (
            <div className="space-y-3">
              {/* Запис голосового */}
              {isRecording ? (
                <div className="flex items-center gap-3 bg-black border border-red-500/50 rounded-xl p-4">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-white flex-1">Запис {formatTime(recordingTime)}</span>
                  <button onClick={cancelAudioRecording} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <button onClick={stopAudioRecording} className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                </div>
              ) : audioBlob ? (
                <div className="flex items-center gap-3 bg-black border border-emerald-500/50 rounded-xl p-4">
                  <span className="text-2xl">🎤</span>
                  <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-10" />
                  <button onClick={deleteRecording} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={startAudioRecording} className="w-full px-4 py-6 bg-black border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 transition flex flex-col items-center gap-2">
                  <span className="text-3xl">🎤</span>
                  <span className="text-sm">Натисніть щоб записати голосове</span>
                </button>
              )}
              
              {/* Або вибрати файл */}
              {!isRecording && !audioBlob && (
                <>
                  <div className="text-center text-zinc-600 text-sm">або</div>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span>{file ? file.name : 'Завантажити аудіо файл'}</span>
                  </button>
                </>
              )}
            </div>
          ) : type === 'video_note' ? (
            <div className="space-y-3">
              {/* Модалка запису відео */}
              {showVideoRecorder && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                  <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white">Запис кружка</h3>
                      <button onClick={cancelVideoRecorder} className="text-zinc-400 hover:text-white text-2xl">×</button>
                    </div>
                    
                    {!videoBlob ? (
                      <>
                        <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden bg-black mb-4">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                          {isRecording && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                              {formatTime(recordingTime)}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-center gap-4">
                          {!isRecording ? (
                            <button onClick={startVideoRecording} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
                              <div className="w-6 h-6 bg-white rounded-full"></div>
                            </button>
                          ) : (
                            <button onClick={stopVideoRecording} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
                              <div className="w-6 h-6 bg-white rounded-sm"></div>
                            </button>
                          )}
                        </div>
                        <p className="text-center text-zinc-500 text-sm mt-4">
                          {isRecording ? 'Натисніть щоб зупинити' : 'Натисніть щоб почати запис'}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden bg-black mb-4">
                          <video src={URL.createObjectURL(videoBlob)} controls className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                        <div className="flex justify-center gap-4">
                          <button onClick={() => { setVideoBlob(null); openVideoRecorder(); }} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition">
                            Перезаписати
                          </button>
                          <button onClick={() => setShowVideoRecorder(false)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition">
                            Готово
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Превью або кнопка запису */}
              {videoBlob ? (
                <div className="flex items-center gap-3 bg-black border border-emerald-500/50 rounded-xl p-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800">
                    <video src={URL.createObjectURL(videoBlob)} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">Відео записано</div>
                    <div className="text-zinc-500 text-sm">Готово до збереження</div>
                  </div>
                  <button onClick={() => setVideoBlob(null)} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={openVideoRecorder} className="w-full px-4 py-6 bg-black border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 transition flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                    <span className="text-3xl">⭕</span>
                  </div>
                  <span className="text-sm">Натисніть щоб записати кружок</span>
                </button>
              )}
              
              {/* Або вибрати файл */}
              {!videoBlob && (
                <>
                  <div className="text-center text-zinc-600 text-sm">або</div>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span>{file ? file.name : 'Завантажити відео файл'}</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept={type === 'photo' ? 'image/*' : 'video/*'} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-6 bg-black border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 transition flex flex-col items-center gap-2">
                {file ? (
                  <>
                    <span className="text-2xl">✓</span>
                    <span className="text-sm truncate max-w-full">{file.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">{getTypeIcon(type)}</span>
                    <span className="text-sm">{type === 'video_note' ? 'Виберіть відео для кружка' : 'Натисніть щоб вибрати файл'}</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          <button onClick={handleAdd} disabled={uploading || !title || (type === 'text' ? !content : type === 'voice' ? (!audioBlob && !file) : type === 'video_note' ? (!videoBlob && !file) : !file)} className="px-6 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-medium rounded-xl transition">
            {uploading ? 'Завантаження...' : 'Додати шаблон'}
          </button>
        </div>
      </div>
      
      {/* Фільтр */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}>
          Всі ({templates.length})
        </button>
        {types.map(t => {
          const count = templates.filter(x => x.type === t.value).length;
          if (count === 0) return null;
          return (
            <button key={t.value} onClick={() => setFilter(t.value)} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${filter === t.value ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}>
              <span>{t.icon}</span><span>{count}</span>
            </button>
          );
        })}
      </div>
      
      {/* Список шаблонів */}
      <div className="space-y-3">
        {filteredTemplates.map(t => (
          <div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-start gap-4">
            <div className="text-2xl">{getTypeIcon(t.type || 'text')}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">{t.title}</div>
              {t.type === 'text' && <div className="text-zinc-500 text-sm mt-1 line-clamp-2">{t.content}</div>}
              {t.type === 'voice' && t.file_url && <audio src={t.file_url} controls className="mt-2 h-8" />}
              {t.type === 'video_note' && t.file_url && <video src={t.file_url} controls className="mt-2 w-24 h-24 rounded-full object-cover" />}
              {t.type === 'photo' && t.file_url && <img src={t.file_url} alt="" className="mt-2 max-w-32 rounded-lg" />}
              {t.type === 'video' && t.file_url && <video src={t.file_url} controls className="mt-2 max-w-48 rounded-lg" />}
            </div>
            <button onClick={() => onDeleteTemplate(t.id)} className="text-red-400 hover:text-red-300 text-xl">×</button>
          </div>
        ))}
        {filteredTemplates.length === 0 && (
          <div className="text-center text-zinc-600 py-12">
            {filter === 'all' ? 'Немає шаблонів' : 'Немає шаблонів цього типу'}
          </div>
        )}
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
      {activeNow.length > 0 && <div className="mb-6"><h3 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-3">Зараз</h3><div className="space-y-3">{activeNow.map(r => <div key={r.id} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4"><div><div className="text-white">{r.reminder_text}</div><div className="text-zinc-500 text-sm">{r.clients?.first_name} • {formatFullDate(r.remind_at)}</div></div><div className="flex gap-2"><button onClick={() => onGoToChat(r.client_id)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">Відкрити</button><button onClick={() => onComplete(r.id)} className="p-2 bg-emerald-500 text-white rounded-lg">✓</button></div></div>)}</div></div>}
      {scheduled.length > 0 && <div><h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Заплановано</h3><div className="space-y-3">{scheduled.map(r => <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4"><div><div className="text-white">{r.reminder_text}</div><div className="text-zinc-500 text-sm">{r.clients?.first_name} • {formatFullDate(r.remind_at)}</div></div><button onClick={() => onComplete(r.id)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700">✓</button></div>)}</div></div>}
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
  const filtered = clients.filter(c => selectedStatuses.length === 0 || selectedStatuses.includes(c.status));
  const toggleStatus = (s) => setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const handleSend = async () => { if (!message.trim() || filtered.length === 0) return; setSending(true); try { const res = await onSendBroadcast(message, filtered.map(c => c.id)); setResult({ success: true, count: res.count }); setMessage(''); } catch (err) { setResult({ success: false }); } setSending(false); };
  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Розсилка</h2>
      {result && <div className={`rounded-xl p-4 mb-6 ${result.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{result.success ? `✓ Надіслано ${result.count} клієнтам` : 'Помилка'}<button onClick={() => setResult(null)} className="ml-4">×</button></div>}
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
        <h3 className="text-white font-medium mb-4">Отримувачі</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSelectedStatuses([])} className={`px-4 py-2 rounded-lg text-sm ${selectedStatuses.length === 0 ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>Всі ({clients.length})</button>
          {Object.entries(STATUSES).map(([key, { label }]) => <button key={key} onClick={() => toggleStatus(key)} className={`px-4 py-2 rounded-lg text-sm ${selectedStatuses.includes(key) ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>{label}</button>)}
        </div>
        <div className="text-zinc-500 text-sm">Отримувачів: <span className="text-white font-medium">{filtered.length}</span></div>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текст повідомлення..." rows={4} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none mb-4" />
        <button onClick={handleSend} disabled={sending || !message.trim() || filtered.length === 0} className="px-6 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-medium rounded-xl">{sending ? 'Надсилаю...' : 'Надіслати'}</button>
      </div>
    </div>
  );
};

// ==================== SETTINGS ====================
const Settings = ({ bots, activeBot, expertId, onBotAdded, onBotDeleted, onBotUpdated, authorizedUsers, onAddUser, onRemoveUser }) => {
  const [activeSection, setActiveSection] = useState('bots');
  const [botToken, setBotToken] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState('');
  const [botSuccess, setBotSuccess] = useState('');
  const [editingBot, setEditingBot] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [username, setUsername] = useState('');

  const RAILWAY_API_URL = 'https://diagnostic-bot-production.up.railway.app';
  
  useEffect(() => {
    if (editingBot) {
      setWelcomeMessage(editingBot.welcome_message || '');
      setGoogleSheetUrl(editingBot.google_sheet_url || '');
    }
  }, [editingBot]);

  const handleRegisterBot = async () => {
    if (!botToken.trim()) { setBotError('Введіть токен бота'); return; }
    setBotLoading(true); setBotError(''); setBotSuccess('');
    try {
      // 1. Перевіряємо токен через Telegram API
      const telegramResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const telegramData = await telegramResp.json();
      if (!telegramData.ok) { setBotError('Невірний токен бота. Перевірте та спробуйте ще раз.'); setBotLoading(false); return; }
      
      const botUsername = telegramData.result.username;
      const botName = telegramData.result.first_name;
      
      // 2. Реєструємо бота через Railway API (він сам перевірить і реактивує якщо потрібно)
      const registerResp = await fetch(`${RAILWAY_API_URL}/api/register-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken, expert_id: expertId })
      });
      
      const registerData = await registerResp.json();
      
      if (!registerResp.ok) {
        setBotError(registerData.detail || 'Помилка реєстрації бота');
        setBotLoading(false);
        return;
      }
      
      // 3. Отримуємо дані бота з бази
      const { data: botData } = await supabase.from('bots').select('*').eq('id', registerData.bot_id).single();
      
      setBotToken('');
      setBotSuccess(`✅ Бот @${botUsername} успішно додано і активовано!`);
      onBotAdded(botData || { id: registerData.bot_id, bot_username: botUsername, bot_name: botName, expert_id: expertId, is_active: true, webhook_set: true });
      
    } catch (err) { 
      setBotError('Помилка з\'єднання з сервером: ' + err.message); 
    }
    setBotLoading(false);
  };

  const handleDeleteBot = async (botId) => {
    if (!confirm('Видалити бота?')) return;
    
    try {
      // 1. Викликаємо Railway API щоб видалити з пам'яті і webhook
      await fetch(`${RAILWAY_API_URL}/api/bot/${botId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete bot from Railway:', err);
    }
    
    // 2. Оновлюємо в базі
    await supabase.from('bots').update({ is_active: false }).eq('id', botId);
    onBotDeleted(botId);
  };

  const handleSaveWelcome = async () => {
    if (!editingBot) return;
    await supabase.from('bots').update({ 
      welcome_message: welcomeMessage,
      google_sheet_url: googleSheetUrl 
    }).eq('id', editingBot.id);
    onBotUpdated({ ...editingBot, welcome_message: welcomeMessage, google_sheet_url: googleSheetUrl });
    setEditingBot(null); setBotSuccess('Збережено!');
  };

  const handleAddUser = () => { if (!username) return; onAddUser({ telegram_username: username }); setUsername(''); };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Налаштування</h2>
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setActiveSection('bots')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${activeSection === 'bots' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>🤖 Мої боти</button>
        <button onClick={() => setActiveSection('users')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${activeSection === 'users' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>👥 Авторизовані</button>
      </div>

      {activeSection === 'bots' && (
        <div className="space-y-6">
          {/* Список ботів */}
          <div className="space-y-4">
            {bots.map(bot => (
              <div key={bot.id} className={`bg-zinc-900 rounded-2xl p-5 border ${activeBot?.id === bot.id ? 'border-emerald-500' : 'border-zinc-800'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-2xl">🤖</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-white">@{bot.bot_username}</div>
                    <div className="text-zinc-400 text-sm">{bot.bot_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${bot.webhook_set ? 'bg-emerald-500' : 'bg-yellow-500'}`}></span>
                      <span className="text-xs text-zinc-500">{bot.webhook_set ? 'Активний' : 'Очікує'}</span>
                      {activeBot?.id === bot.id && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full ml-2">Поточний</span>}
                      {bot.google_sheet_url && <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">📊 Google</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <a href={`https://t.me/${bot.bot_username}`} target="_blank" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition">Відкрити бота</a>
                  <button onClick={() => { setEditingBot(bot); setWelcomeMessage(bot.welcome_message || ''); setGoogleSheetUrl(bot.google_sheet_url || ''); }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition">Налаштувати</button>
                  <button onClick={() => handleDeleteBot(bot.id)} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition">Видалити</button>
                </div>
              </div>
            ))}
          </div>

          {/* Модалка редагування */}
          {editingBot && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">@{editingBot.bot_username}</h3>
                  <button onClick={() => setEditingBot(null)} className="text-zinc-400 hover:text-white">✕</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Привітальне повідомлення</label>
                    <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none" placeholder="Вітаю! Надішліть фото..." />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Google Apps Script URL (для передачі в продажі)</label>
                    <input type="url" value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" placeholder="https://script.google.com/macros/s/..." />
                    <p className="text-xs text-zinc-600 mt-2">URL веб-додатку Google Apps Script для інтеграції з таблицею</p>
                  </div>
                  <button onClick={handleSaveWelcome} className="w-full py-3 bg-white text-black font-medium rounded-xl">Зберегти</button>
                </div>
              </div>
            </div>
          )}

          {/* Форма додавання */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-lg font-medium text-white mb-4">➕ Додати нового бота</h3>
            
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-white mb-2">📝 Інструкція:</h4>
              <ol className="text-zinc-400 text-sm space-y-1">
                <li>1. Відкрийте <a href="https://t.me/BotFather" target="_blank" className="text-emerald-400 hover:underline">@BotFather</a></li>
                <li>2. Надішліть <code className="bg-zinc-700 px-1 rounded">/newbot</code></li>
                <li>3. Введіть назву та username бота</li>
                <li>4. Скопіюйте токен нижче</li>
              </ol>
            </div>

            {botError && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{botError}</div>}
            {botSuccess && <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">{botSuccess}</div>}

            <div className="space-y-4">
              <input type="text" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Токен бота (123456789:ABC...)" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-sm" />
              <button onClick={handleRegisterBot} disabled={botLoading || !botToken.trim()} className="w-full py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-xl transition">{botLoading ? 'Перевіряю...' : 'Додати бота'}</button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'users' && activeBot && (
        <div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
            <p className="text-zinc-400 text-sm mb-4">Користувачі які можуть писати в бот @{activeBot.bot_username} без оплати</p>
            <div className="flex gap-4">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" className="flex-1 px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
              <button onClick={handleAddUser} className="px-6 py-3 bg-white text-black font-medium rounded-xl">Додати</button>
            </div>
          </div>
          <div className="space-y-3">
            {authorizedUsers.map(u => (
              <div key={u.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex justify-between items-center">
                <span className="text-white">@{u.telegram_username}</span>
                <button onClick={() => onRemoveUser(u.id)} className="text-red-400">Видалити</button>
              </div>
            ))}
            {authorizedUsers.length === 0 && <div className="text-center text-zinc-600 py-12">Немає користувачів</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== EXPERT DASHBOARD ====================
const ExpertDashboard = ({ expertId, expertName, onLogout, isAdminView = false }) => {
  const [bots, setBots] = useState([]);
  const [activeBot, setActiveBot] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [showClientList, setShowClientList] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);

  // Завантаження ботів
  useEffect(() => {
    loadBots();
  }, [expertId]);

  const loadBots = async () => {
    const { data } = await supabase.from('bots').select('*').eq('expert_id', expertId).eq('is_active', true).order('created_at');
    if (data && data.length > 0) {
      setBots(data);
      const savedBotId = localStorage.getItem(`active_bot_${expertId}`);
      const savedBot = data.find(b => b.id === savedBotId);
      setActiveBot(savedBot || data[0]);
    } else {
      setBots([]);
      setActiveBot(null);
    }
  };

  const handleSelectBot = (bot) => {
    setActiveBot(bot);
    localStorage.setItem(`active_bot_${expertId}`, bot.id);
    setSelectedClient(null);
    setMessages([]);
  };

  const handleBotAdded = (bot) => {
    setBots(prev => [...prev, bot]);
    if (!activeBot) {
      setActiveBot(bot);
      localStorage.setItem(`active_bot_${expertId}`, bot.id);
    }
  };

  const handleBotDeleted = (botId) => {
    setBots(prev => prev.filter(b => b.id !== botId));
    if (activeBot?.id === botId) {
      const remaining = bots.filter(b => b.id !== botId);
      setActiveBot(remaining[0] || null);
    }
  };

  const handleBotUpdated = (updatedBot) => {
    setBots(prev => prev.map(b => b.id === updatedBot.id ? updatedBot : b));
    if (activeBot?.id === updatedBot.id) setActiveBot(updatedBot);
  };

  // Завантаження даних по активному боту
  useEffect(() => {
    if (!activeBot) return;
    loadClients();
    loadTemplates();
    loadAuthorizedUsers();
    loadReminders();
    
    const clientsSub = supabase.channel('clients_' + activeBot.id).on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `bot_id=eq.${activeBot.id}` }, () => loadClients()).subscribe();
    const msgSub = supabase.channel('messages_' + activeBot.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      if (payload.new.client_id === selectedClient?.id) { setMessages(prev => [...prev, payload.new]); if (payload.new.direction === 'client') markAsRead(payload.new.client_id); }
      loadClients();
    }).subscribe();
    
    return () => { supabase.removeChannel(clientsSub); supabase.removeChannel(msgSub); };
  }, [activeBot?.id]);

  const loadClients = async () => {
    if (!activeBot) return;
    const { data } = await supabase.from('clients').select('*').eq('bot_id', activeBot.id).order('updated_at', { ascending: false });
    if (data) {
      setClients(data);
      const unread = {};
      const last = {};
      for (const c of data) {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('client_id', c.id).eq('direction', 'client').eq('is_read', false);
        unread[c.id] = count || 0;
        const { data: lastMsg } = await supabase.from('messages').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(1);
        if (lastMsg?.[0]) last[c.id] = lastMsg[0];
      }
      setUnreadCounts(unread);
      setLastMessages(last);
    }
  };

  const loadTemplates = async () => {
    if (!activeBot) return;
    const { data } = await supabase.from('message_templates').select('*').eq('bot_id', activeBot.id).order('created_at');
    if (data) setTemplates(data);
  };

  const loadAuthorizedUsers = async () => {
    if (!activeBot) return;
    const { data } = await supabase.from('authorized_users').select('*').eq('bot_id', activeBot.id).order('created_at');
    if (data) setAuthorizedUsers(data);
  };

  const loadReminders = async () => {
    const { data } = await supabase.from('reminders').select('*, clients(first_name)').eq('expert_id', expertId).eq('is_completed', false).order('remind_at');
    if (data) setReminders(data);
  };

  const loadMessages = async (clientId) => {
    const { data } = await supabase.from('messages').select('*').eq('client_id', clientId).order('created_at');
    if (data) setMessages(data);
  };

  const markAsRead = async (clientId) => {
    await supabase.from('messages').update({ is_read: true }).eq('client_id', clientId).eq('direction', 'client');
    setUnreadCounts(prev => ({ ...prev, [clientId]: 0 }));
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    loadMessages(client.id);
    markAsRead(client.id);
    if (isMobile) setShowClientList(false);
  };

  const handleSendMessage = async (text) => {
    if (!selectedClient) return;
    await supabase.from('messages').insert({ client_id: selectedClient.id, direction: 'expert', content_type: 'text', text_content: text, is_read: false });
    loadMessages(selectedClient.id);
  };

  const handleSendFile = async (file, type = null, templateUrl = null, caption = null) => {
    if (!selectedClient) return;
    
    let publicUrl = templateUrl;
    let fileName = caption || 'Медіа';
    
    // Якщо це файл, а не шаблон - завантажуємо
    if (file) {
      const ext = file.name.split('.').pop();
      fileName = `${selectedClient.telegram_id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('diagnostic-files').upload(`uploads/${fileName}`, file);
      if (error) throw error;
      const { data: { publicUrl: url } } = supabase.storage.from('diagnostic-files').getPublicUrl(`uploads/${fileName}`);
      publicUrl = url;
    }
    
    let contentType = type || (file?.type?.startsWith('image/') ? 'photo' : file?.type?.startsWith('video/') ? 'video' : file?.type?.startsWith('audio/') ? 'voice' : 'document');
    await supabase.from('messages').insert({ client_id: selectedClient.id, direction: 'expert', content_type: contentType, file_url: publicUrl, file_name: fileName, is_read: false });
    loadMessages(selectedClient.id);
  };

  const handleStatusChange = async (status) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ status }).eq('id', selectedClient.id);
    setSelectedClient({ ...selectedClient, status });
    loadClients();
  };

  const handleNotesChange = async (notes) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ notes }).eq('id', selectedClient.id);
    setSelectedClient({ ...selectedClient, notes });
  };

  const handleAddReminder = async (text, date) => {
    if (!selectedClient) return;
    await supabase.from('reminders').insert({ client_id: selectedClient.id, expert_id: expertId, reminder_text: text, remind_at: date });
    loadReminders();
  };

  const handleCompleteReminder = async (id) => {
    await supabase.from('reminders').update({ is_completed: true }).eq('id', id);
    loadReminders();
  };

  const handleGoToChat = async (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) { handleSelectClient(client); setActiveTab('chat'); }
  };

  const handleAddTemplate = async (t) => {
    if (!activeBot) return;
    await supabase.from('message_templates').insert({ ...t, expert_id: expertId, bot_id: activeBot.id });
    loadTemplates();
  };

  const handleDeleteTemplate = async (id) => {
    await supabase.from('message_templates').delete().eq('id', id);
    loadTemplates();
  };

  const handleAddAuthorizedUser = async (u) => {
    if (!activeBot) return;
    await supabase.from('authorized_users').insert({ ...u, expert_id: expertId, bot_id: activeBot.id });
    loadAuthorizedUsers();
  };

  const handleRemoveAuthorizedUser = async (id) => {
    await supabase.from('authorized_users').delete().eq('id', id);
    loadAuthorizedUsers();
  };

  const handleSendBroadcast = async (message, clientIds) => {
    let count = 0;
    for (const clientId of clientIds) {
      await supabase.from('messages').insert({ client_id: clientId, direction: 'expert', content_type: 'text', text_content: message, is_read: false });
      count++;
    }
    return { count };
  };

  const unreadDialogs = Object.values(unreadCounts).filter(c => c > 0).length;
  const activeReminders = reminders.filter(r => new Date(r.remind_at) <= new Date()).length;

  const tabs = [
    { id: 'chat', label: 'Чати', icon: '💬', count: unreadDialogs },
    { id: 'broadcast', label: 'Розсилка', icon: '📢', count: 0 },
    { id: 'reminders', label: 'Нагадування', icon: '🔔', count: activeReminders },
    { id: 'templates', label: 'Шаблони', icon: '📝', count: 0 },
    { id: 'analytics', label: 'Аналітика', icon: '📊', count: 0 },
    { id: 'settings', label: 'Налаштування', icon: '⚙️', count: 0 },
  ];

  // Якщо немає ботів — показуємо екран додавання бота
  if (bots.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col">
        <nav className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <Logo />
          <button onClick={onLogout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </nav>
        <div className="flex-1 flex items-center justify-center p-6">
          <Settings 
            bots={bots} activeBot={null} expertId={expertId} 
            onBotAdded={handleBotAdded} onBotDeleted={handleBotDeleted} onBotUpdated={handleBotUpdated}
            authorizedUsers={[]} onAddUser={() => {}} onRemoveUser={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <nav className="bg-zinc-950 border-b border-zinc-800 px-3 md:px-4 py-3 flex items-center justify-between gap-2 md:gap-4">
        {/* Logo - тільки на десктопі */}
        <div className="hidden md:block">
          <Logo />
        </div>
        
        {/* Bot Selector - завжди видимий */}
        <div className="flex-1 md:flex-none min-w-0">
          <BotSelector bots={bots} activeBot={activeBot} onSelectBot={handleSelectBot} onAddBot={() => setActiveTab('settings')} />
        </div>
        
        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'chat') setShowClientList(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeTab === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
              <span>{tab.icon}</span>
              <span className="text-sm">{tab.label}</span>
              {tab.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab.id === 'reminders' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-1 md:hidden">
          {unreadDialogs > 0 && (
            <button onClick={() => { setActiveTab('chat'); setShowClientList(true); }} className="relative p-2 hover:bg-zinc-800 rounded-lg">
              <span className="text-lg">💬</span>
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadDialogs}</span>
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMobileMenu(false); if (tab.id === 'chat') setShowClientList(true); }} className={`w-full px-4 py-3 text-left flex items-center justify-between transition ${activeTab === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                      <span className="flex items-center gap-3"><span>{tab.icon}</span><span>{tab.label}</span></span>
                      {tab.count > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${tab.id === 'reminders' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}>{tab.count}</span>}
                    </button>
                  ))}
                  <div className="border-t border-zinc-800" />
                  {!isAdminView && <button onClick={() => { onLogout(); setShowMobileMenu(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-400 hover:bg-zinc-800"><span>🚪</span><span>Вийти</span></button>}
                  {isAdminView && <button onClick={() => { onLogout(); setShowMobileMenu(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 text-zinc-400 hover:bg-zinc-800"><span>←</span><span>До адмін-панелі</span></button>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Desktop logout/back button */}
        {!isAdminView && <button onClick={onLogout} className="hidden md:block p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>}
        {isAdminView && <button onClick={onLogout} className="hidden md:flex px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm items-center gap-2 transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>До адмін-панелі</button>}
      </nav>
      
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <>
            <div className={`${isMobile ? (showClientList ? 'w-full' : 'hidden') : 'w-80'} flex-shrink-0`}>
              <ClientList clients={clients} selectedClient={selectedClient} onSelectClient={handleSelectClient} unreadCounts={unreadCounts} lastMessages={lastMessages} onClose={() => setShowClientList(false)} />
            </div>
            <div className={`flex-1 min-w-0 ${isMobile && showClientList ? 'hidden' : 'flex'}`}>
              <ChatWindow client={selectedClient} messages={messages} onSendMessage={handleSendMessage} onSendFile={handleSendFile} onStatusChange={handleStatusChange} onNotesChange={handleNotesChange} onAddReminder={handleAddReminder} onBack={() => setShowClientList(true)} isMobile={isMobile} templates={templates} onSendTemplate={handleSendMessage} googleSheetUrl={activeBot?.google_sheet_url} />
            </div>
          </>
        )}
        {activeTab === 'broadcast' && <Broadcast clients={clients} onSendBroadcast={handleSendBroadcast} />}
        {activeTab === 'analytics' && <Analytics clients={clients} bots={bots} unreadDialogs={unreadDialogs} onPeriodChange={setAnalyticsPeriod} period={analyticsPeriod} />}
        {activeTab === 'settings' && <Settings bots={bots} activeBot={activeBot} expertId={expertId} onBotAdded={handleBotAdded} onBotDeleted={handleBotDeleted} onBotUpdated={handleBotUpdated} authorizedUsers={authorizedUsers} onAddUser={handleAddAuthorizedUser} onRemoveUser={handleRemoveAuthorizedUser} />}
        {activeTab === 'reminders' && <Reminders reminders={reminders} onComplete={handleCompleteReminder} onGoToChat={handleGoToChat} />}
        {activeTab === 'templates' && <Templates templates={templates} onAddTemplate={handleAddTemplate} onDeleteTemplate={handleDeleteTemplate} />}
      </div>
    </div>
  );
};

// ==================== ADMIN PANEL ====================
const AdminPanel = ({ onSelectExpert, onLogout }) => {
  const [experts, setExperts] = useState([]);
  const [bots, setBots] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [view, setView] = useState('experts');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddExpert, setShowAddExpert] = useState(false);
  const [newExpert, setNewExpert] = useState({ name: '', email: '', password: '' });
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editingExpert, setEditingExpert] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => { loadExperts(); loadBots(); loadAllClients(); }, []);

  const loadExperts = async () => {
    const { data } = await supabase.from('experts').select('*').order('created_at');
    if (data) setExperts(data.filter(e => e.role !== 'admin'));
  };

  const loadBots = async () => {
    const { data } = await supabase.from('bots').select('*, experts(name)').eq('is_active', true).order('created_at');
    if (data) setBots(data);
  };

  const loadAllClients = async () => {
    const { data } = await supabase.from('clients').select('*, experts(name), bots(bot_username)').order('created_at', { ascending: false });
    if (data) setAllClients(data);
  };

  const handleAddExpert = async () => {
    if (!newExpert.name || !newExpert.email || !newExpert.password) {
      setAddError('Заповніть всі поля');
      return;
    }
    
    setAddLoading(true);
    setAddError('');
    setAddSuccess('');
    
    try {
      // Перевіряємо чи email вже існує
      const { data: existing } = await supabase.from('experts').select('id').eq('email', newExpert.email.toLowerCase());
      if (existing?.length > 0) {
        setAddError('Експерт з таким email вже існує');
        setAddLoading(false);
        return;
      }
      
      // Створюємо експерта
      const { data, error } = await supabase.from('experts').insert({
        name: newExpert.name,
        email: newExpert.email.toLowerCase(),
        password_hash: newExpert.password,
        role: 'expert'
      }).select();
      
      if (error) {
        setAddError('Помилка: ' + error.message);
        setAddLoading(false);
        return;
      }
      
      setAddSuccess(`Експерт ${newExpert.name} успішно створений!`);
      setNewExpert({ name: '', email: '', password: '' });
      loadExperts();
      
      setTimeout(() => {
        setShowAddExpert(false);
        setAddSuccess('');
      }, 2000);
      
    } catch (err) {
      setAddError('Помилка: ' + err.message);
    }
    
    setAddLoading(false);
  };

  const handleDeleteExpert = async (expertId, expertName) => {
    if (!confirm(`Видалити експерта ${expertName}? Це також видалить всіх його ботів, клієнтів та дані.`)) return;
    
    try {
      // 1. Отримуємо всіх ботів експерта
      const { data: expertBots } = await supabase.from('bots').select('id').eq('expert_id', expertId);
      const botIds = expertBots?.map(b => b.id) || [];
      
      // 2. Отримуємо всіх клієнтів експерта
      const { data: expertClients } = await supabase.from('clients').select('id').eq('expert_id', expertId);
      const clientIds = expertClients?.map(c => c.id) || [];
      
      // 3. Видаляємо повідомлення клієнтів
      if (clientIds.length > 0) {
        await supabase.from('messages').delete().in('client_id', clientIds);
      }
      
      // 4. Видаляємо нагадування по client_id
      if (clientIds.length > 0) {
        await supabase.from('reminders').delete().in('client_id', clientIds);
      }
      
      // 5. Видаляємо клієнтів (по bot_id щоб спрацював foreign key)
      if (botIds.length > 0) {
        await supabase.from('clients').delete().in('bot_id', botIds);
      }
      
      // 6. Видаляємо шаблони по bot_id
      if (botIds.length > 0) {
        await supabase.from('message_templates').delete().in('bot_id', botIds);
      }
      
      // 7. Видаляємо авторизованих користувачів по bot_id
      if (botIds.length > 0) {
        await supabase.from('authorized_users').delete().in('bot_id', botIds);
      }
      
      // 8. Видаляємо ботів
      await supabase.from('bots').delete().eq('expert_id', expertId);
      
      // 9. Видаляємо експерта
      const { error } = await supabase.from('experts').delete().eq('id', expertId);
      
      if (error) {
        console.error('Delete expert error:', error);
        alert('Помилка: ' + error.message);
        return;
      }
      
      loadExperts();
      loadBots();
      loadAllClients();
    } catch (err) {
      console.error('Error deleting expert:', err);
      alert('Помилка при видаленні: ' + err.message);
    }
  };

  const getExpertStats = (expertId) => {
    const clients = allClients.filter(c => c.expert_id === expertId);
    const total = clients.length;
    const done = clients.filter(c => ['diagnostic_done', 'call_scheduled', 'call_done'].includes(c.status)).length;
    return { total, done, conversion: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  const getExpertBots = (expertId) => bots.filter(b => b.expert_id === expertId);

  const handleOpenEditExpert = (expert) => {
    setEditingExpert(expert);
    setEditForm({ name: expert.name, email: expert.email, password: expert.password_hash || '' });
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveExpert = async () => {
    if (!editForm.name || !editForm.email || !editForm.password) {
      setEditError('Заповніть всі поля');
      return;
    }
    
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    
    try {
      // Перевіряємо чи email не зайнятий іншим експертом
      if (editForm.email.toLowerCase() !== editingExpert.email.toLowerCase()) {
        const { data: existing } = await supabase.from('experts').select('id').eq('email', editForm.email.toLowerCase()).neq('id', editingExpert.id);
        if (existing?.length > 0) {
          setEditError('Експерт з таким email вже існує');
          setEditLoading(false);
          return;
        }
      }
      
      const { error } = await supabase.from('experts').update({
        name: editForm.name,
        email: editForm.email.toLowerCase(),
        password_hash: editForm.password
      }).eq('id', editingExpert.id);
      
      if (error) {
        setEditError('Помилка: ' + error.message);
        setEditLoading(false);
        return;
      }
      
      setEditSuccess('Збережено!');
      loadExperts();
      
      setTimeout(() => {
        setEditingExpert(null);
        setEditSuccess('');
      }, 1500);
      
    } catch (err) {
      setEditError('Помилка: ' + err.message);
    }
    
    setEditLoading(false);
  };

  const totalStats = {
    experts: experts.length,
    bots: bots.length,
    clients: allClients.length,
    conversion: allClients.length > 0 ? Math.round(allClients.filter(c => ['diagnostic_done', 'call_scheduled', 'call_done'].includes(c.status)).length / allClients.length * 100) : 0
  };

  const adminTabs = [
    { id: 'experts', label: 'Експерти', icon: '👥' },
    { id: 'bots', label: 'Боти', icon: '🤖' },
    { id: 'stats', label: 'Статистика', icon: '📊' },
  ];

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <nav className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-1 rounded-full">Admin</span>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-1">
          {adminTabs.map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${view === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
              <span>{tab.icon}</span><span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2">
          <div className="relative md:hidden">
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="px-3 py-2 bg-zinc-900 rounded-lg text-white text-sm flex items-center gap-2">
              <span>{adminTabs.find(t => t.id === view)?.icon}</span>
              <span>{adminTabs.find(t => t.id === view)?.label}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  {adminTabs.map(tab => (
                    <button key={tab.id} onClick={() => { setView(tab.id); setShowMobileMenu(false); }} className={`w-full px-4 py-3 text-left flex items-center gap-3 transition ${view === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
                      <span>{tab.icon}</span><span>{tab.label}</span>
                    </button>
                  ))}
                  <div className="border-t border-zinc-800" />
                  <button onClick={onLogout} className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-400 hover:bg-zinc-800"><span>🚪</span><span>Вийти</span></button>
                </div>
              </>
            )}
          </div>
          <button onClick={onLogout} className="hidden md:block p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-6">
        {view === 'experts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Експерти</h2>
              <button onClick={() => setShowAddExpert(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition flex items-center gap-2">
                <span>➕</span> Додати експерта
              </button>
            </div>
            
            {/* Модалка додавання експерта */}
            {showAddExpert && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Новий експерт</h3>
                    <button onClick={() => { setShowAddExpert(false); setAddError(''); setAddSuccess(''); }} className="text-zinc-400 hover:text-white text-2xl">×</button>
                  </div>
                  
                  {addError && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{addError}</div>}
                  {addSuccess && <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">{addSuccess}</div>}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Ім'я</label>
                      <input type="text" value={newExpert.name} onChange={(e) => setNewExpert({...newExpert, name: e.target.value})} placeholder="Олена Коваленко" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Email (для входу)</label>
                      <input type="email" value={newExpert.email} onChange={(e) => setNewExpert({...newExpert, email: e.target.value})} placeholder="olena@example.com" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Пароль</label>
                      <input type="text" value={newExpert.password} onChange={(e) => setNewExpert({...newExpert, password: e.target.value})} placeholder="Мінімум 6 символів" className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <button onClick={handleAddExpert} disabled={addLoading} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-xl transition">
                      {addLoading ? 'Створюю...' : 'Створити експерта'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Модалка редагування експерта */}
            {editingExpert && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Редагувати експерта</h3>
                    <button onClick={() => setEditingExpert(null)} className="text-zinc-400 hover:text-white text-2xl">×</button>
                  </div>
                  
                  {editError && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{editError}</div>}
                  {editSuccess && <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">{editSuccess}</div>}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Ім'я</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Email (для входу)</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Пароль</label>
                      <input type="text" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono" />
                    </div>
                    <button onClick={handleSaveExpert} disabled={editLoading} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-xl transition">
                      {editLoading ? 'Зберігаю...' : 'Зберегти'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {experts.map(expert => {
                const stats = getExpertStats(expert.id);
                const expertBots = getExpertBots(expert.id);
                return (
                  <div key={expert.id} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 hover:border-zinc-700 transition">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg">{expert.name?.[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white">{expert.name}</div>
                        <div className="text-sm text-zinc-500 truncate">{expert.email}</div>
                      </div>
                    </div>
                    
                    {/* Дані для входу */}
                    <div className="bg-black/50 rounded-lg p-3 mb-4 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-zinc-500">Login:</span>
                        <span className="text-zinc-300 font-mono">{expert.email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Pass:</span>
                        <span className="text-zinc-300 font-mono">{expert.password_hash || '—'}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-black rounded-lg p-2 text-center"><div className="text-lg font-bold text-white">{stats.total}</div><div className="text-xs text-zinc-500">Клієнтів</div></div>
                      <div className="bg-black rounded-lg p-2 text-center"><div className="text-lg font-bold text-emerald-400">{stats.conversion}%</div><div className="text-xs text-zinc-500">Конверсія</div></div>
                      <div className="bg-black rounded-lg p-2 text-center"><div className="text-lg font-bold text-sky-400">{expertBots.length}</div><div className="text-xs text-zinc-500">Ботів</div></div>
                    </div>
                    {expertBots.length > 0 && <div className="flex flex-wrap gap-1 mb-4">{expertBots.map(b => <span key={b.id} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">@{b.bot_username}</span>)}</div>}
                    <div className="flex gap-2">
                      <button onClick={() => onSelectExpert(expert)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition">Відкрити</button>
                      <button onClick={() => handleOpenEditExpert(expert)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-sm transition">✏️</button>
                      <button onClick={() => handleDeleteExpert(expert.id, expert.name)} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {experts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-20">👥</div>
                <div className="text-zinc-500">Експертів поки немає</div>
                <button onClick={() => setShowAddExpert(true)} className="mt-4 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition">Додати першого експерта</button>
              </div>
            )}
          </div>
        )}

        {view === 'bots' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Всі боти</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bots.map(bot => {
                const botClients = allClients.filter(c => c.bot_id === bot.id);
                const botConverted = botClients.filter(c => ['diagnostic_done', 'call_scheduled', 'call_done'].includes(c.status)).length;
                const botConversion = botClients.length > 0 ? Math.round(botConverted / botClients.length * 100) : 0;
                return (
                  <div key={bot.id} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-2xl">🤖</div>
                      <div><div className="font-medium text-white">@{bot.bot_username}</div><div className="text-sm text-zinc-500">{bot.experts?.name}</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black rounded-lg p-2 text-center"><div className="text-lg font-bold text-white">{botClients.length}</div><div className="text-xs text-zinc-500">Клієнтів</div></div>
                      <div className="bg-black rounded-lg p-2 text-center"><div className="text-lg font-bold text-emerald-400">{botConversion}%</div><div className="text-xs text-zinc-500">Конверсія</div></div>
                      <div className="bg-black rounded-lg p-2 text-center"><div className={`text-lg font-bold ${bot.webhook_set ? 'text-emerald-400' : 'text-yellow-400'}`}>{bot.webhook_set ? '✓' : '⏳'}</div><div className="text-xs text-zinc-500">Webhook</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'stats' && <AdminAnalytics experts={experts} bots={bots} allClients={allClients} />}
      </div>
    </div>
  );
};

// ==================== ADMIN ANALYTICS ====================
const AdminAnalytics = ({ experts, bots, allClients }) => {
  const [period, setPeriod] = useState('all');
  const [selectedExpert, setSelectedExpert] = useState('all');
  const [selectedBot, setSelectedBot] = useState('all');
  
  const periods = [
    { value: 'today', label: 'Сьогодні' },
    { value: 'week', label: 'Тиждень' },
    { value: 'month', label: 'Місяць' },
    { value: 'all', label: 'Весь час' }
  ];
  
  // Фільтрація по періоду
  const getFilteredByPeriod = (data) => {
    if (period === 'all') return data;
    const now = new Date();
    let start;
    if (period === 'today') start = new Date(now.setHours(0,0,0,0));
    else if (period === 'week') start = new Date(Date.now() - 7*24*60*60*1000);
    else start = new Date(Date.now() - 30*24*60*60*1000);
    return data.filter(c => new Date(c.created_at) >= start);
  };
  
  // Унікальні клієнти глобально (по telegram_id)
  const getGlobalUniqueClients = (data) => {
    const uniqueMap = new Map();
    data.forEach(c => {
      if (!uniqueMap.has(c.telegram_id)) {
        uniqueMap.set(c.telegram_id, c);
      }
    });
    return Array.from(uniqueMap.values());
  };
  
  // Унікальні клієнти для експерта
  const getExpertUniqueClients = (data, expertId) => {
    const expertClients = data.filter(c => c.expert_id === expertId);
    const uniqueMap = new Map();
    expertClients.forEach(c => {
      if (!uniqueMap.has(c.telegram_id)) {
        uniqueMap.set(c.telegram_id, c);
      }
    });
    return Array.from(uniqueMap.values());
  };
  
  const filteredByPeriod = getFilteredByPeriod(allClients);
  
  // Визначаємо що показувати
  let displayClients = [];
  let displayBots = bots;
  
  if (selectedExpert === 'all' && selectedBot === 'all') {
    displayClients = getGlobalUniqueClients(filteredByPeriod);
  } else if (selectedExpert !== 'all' && selectedBot === 'all') {
    displayClients = getExpertUniqueClients(filteredByPeriod, selectedExpert);
    displayBots = bots.filter(b => b.expert_id === selectedExpert);
  } else if (selectedBot !== 'all') {
    displayClients = filteredByPeriod.filter(c => c.bot_id === selectedBot);
    displayBots = bots.filter(b => b.id === selectedBot);
  }
  
  // Статуси
  const statusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
  displayClients.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });
  
  const total = displayClients.length;
  const converted = statusCounts.diagnostic_done + statusCounts.call_scheduled + statusCounts.call_done;
  const conversionRate = total > 0 ? Math.round(converted / total * 100) : 0;
  
  // Динаміка по днях
  const getDynamicsData = () => {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      let dayClients = allClients.filter(c => {
        const created = new Date(c.created_at);
        return created >= date && created < nextDate;
      });
      
      if (selectedExpert !== 'all') {
        dayClients = dayClients.filter(c => c.expert_id === selectedExpert);
      }
      if (selectedBot !== 'all') {
        dayClients = dayClients.filter(c => c.bot_id === selectedBot);
      }
      
      // Унікальні
      const uniqueDay = selectedBot === 'all' ? getGlobalUniqueClients(dayClients) : dayClients;
      
      days.push({
        date: date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
        count: uniqueDay.length
      });
    }
    return days;
  };
  
  const dynamicsData = getDynamicsData();
  const maxCount = Math.max(...dynamicsData.map(d => d.count), 1);
  
  // Статистика по експертах
  const getExpertStats = () => {
    return experts.map(expert => {
      const expertClients = getExpertUniqueClients(filteredByPeriod, expert.id);
      const expertStatusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
      expertClients.forEach(c => { if (expertStatusCounts[c.status] !== undefined) expertStatusCounts[c.status]++; });
      const expertConverted = expertStatusCounts.diagnostic_done + expertStatusCounts.call_scheduled + expertStatusCounts.call_done;
      const expertBots = bots.filter(b => b.expert_id === expert.id);
      return {
        ...expert,
        uniqueClients: expertClients.length,
        conversion: expertClients.length > 0 ? Math.round(expertConverted / expertClients.length * 100) : 0,
        botsCount: expertBots.length,
        statusCounts: expertStatusCounts
      };
    });
  };
  
  // Статистика по ботах
  const getBotStats = () => {
    return displayBots.map(bot => {
      const botClients = filteredByPeriod.filter(c => c.bot_id === bot.id);
      const botStatusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
      botClients.forEach(c => { if (botStatusCounts[c.status] !== undefined) botStatusCounts[c.status]++; });
      const botConverted = botStatusCounts.diagnostic_done + botStatusCounts.call_scheduled + botStatusCounts.call_done;
      return {
        ...bot,
        clientsCount: botClients.length,
        conversion: botClients.length > 0 ? Math.round(botConverted / botClients.length * 100) : 0,
        statusCounts: botStatusCounts
      };
    });
  };
  
  const expertStats = getExpertStats();
  const botStats = getBotStats();
  
  // Скинути бота при зміні експерта
  const handleExpertChange = (expertId) => {
    setSelectedExpert(expertId);
    setSelectedBot('all');
  };
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Аналітика</h2>
        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${period === p.value ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Expert Filter */}
      <div className="mb-4">
        <div className="text-sm text-zinc-500 mb-2">Експерт:</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExpertChange('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedExpert === 'all' ? 'bg-violet-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
            Всі експерти
          </button>
          {experts.map(expert => (
            <button key={expert.id} onClick={() => handleExpertChange(expert.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedExpert === expert.id ? 'bg-violet-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              {expert.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Bot Filter */}
      {displayBots.length > 0 && (
        <div className="mb-6">
          <div className="text-sm text-zinc-500 mb-2">Бот:</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedBot('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedBot === 'all' ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              Всі боти
            </button>
            {displayBots.map(bot => (
              <button key={bot.id} onClick={() => setSelectedBot(bot.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedBot === bot.id ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                @{bot.bot_username}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-white">{total}</div>
          <div className="text-zinc-500 mt-1 text-sm">Унік. клієнтів</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-emerald-400">{conversionRate}%</div>
          <div className="text-zinc-500 mt-1 text-sm">Конверсія</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-sky-400">{statusCounts.diagnostic_done}</div>
          <div className="text-zinc-500 mt-1 text-sm">Діагностик</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
          <div className="text-2xl md:text-3xl font-bold text-violet-400">{statusCounts.call_done}</div>
          <div className="text-zinc-500 mt-1 text-sm">Дзвінків</div>
        </div>
      </div>
      
      {/* Dynamics Chart */}
      <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Нові клієнти (14 днів)</h3>
        <div className="flex items-end gap-1 h-32">
          {dynamicsData.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-zinc-400 mb-1">{day.count > 0 ? day.count : ''}</div>
              <div className="w-full bg-zinc-800 rounded-t relative" style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}>
                <div className="absolute inset-0 bg-emerald-500 rounded-t opacity-80"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-zinc-500">{dynamicsData[0]?.date}</span>
          <span className="text-xs text-zinc-500">{dynamicsData[dynamicsData.length - 1]?.date}</span>
        </div>
      </div>
      
      {/* Funnel */}
      <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Воронка</h3>
        <div className="space-y-3">
          {Object.entries(STATUSES).map(([key, { label, color }]) => {
            const count = statusCounts[key] || 0;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 md:w-36 text-zinc-400 text-sm truncate">{label}</div>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div className={`h-full ${color} transition-all duration-500`} style={{ width: pct + '%' }} />
                </div>
                <div className="w-12 text-right text-white text-sm font-medium">{count}</div>
                <div className="w-12 text-right text-zinc-500 text-sm">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Expert Stats (якщо вибрано всіх) */}
      {selectedExpert === 'all' && selectedBot === 'all' && experts.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800 mb-6">
          <h3 className="text-lg font-medium text-white mb-4">По експертах</h3>
          <div className="space-y-3">
            {expertStats.map(expert => (
              <div key={expert.id} className="bg-black/50 rounded-xl p-4 cursor-pointer hover:bg-black/70 transition" onClick={() => handleExpertChange(expert.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-white font-bold">{expert.name?.[0]}</div>
                    <div>
                      <span className="text-white font-medium">{expert.name}</span>
                      <div className="text-xs text-zinc-500">{expert.botsCount} ботів</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-white font-bold">{expert.uniqueClients}</div>
                      <div className="text-xs text-zinc-500">клієнтів</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold">{expert.conversion}%</div>
                      <div className="text-xs text-zinc-500">конверсія</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Bot Stats */}
      {selectedBot === 'all' && botStats.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
          <h3 className="text-lg font-medium text-white mb-4">По ботах</h3>
          <div className="space-y-3">
            {botStats.map(bot => (
              <div key={bot.id} className="bg-black/50 rounded-xl p-4 cursor-pointer hover:bg-black/70 transition" onClick={() => setSelectedBot(bot.id)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🤖</span>
                    <div>
                      <span className="text-white font-medium">@{bot.bot_username}</span>
                      {selectedExpert === 'all' && <div className="text-xs text-zinc-500">{experts.find(e => e.id === bot.expert_id)?.name}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-white font-bold">{bot.clientsCount}</div>
                      <div className="text-xs text-zinc-500">клієнтів</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold">{bot.conversion}%</div>
                      <div className="text-xs text-zinc-500">конверсія</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(STATUSES).map(([key, { label, color }]) => (
                    <div key={key} className="flex-1 text-center">
                      <div className={`text-sm font-medium ${color.replace('bg-', 'text-')}`}>{bot.statusCounts[key]}</div>
                      <div className="text-xs text-zinc-600 truncate">{label.split(' ')[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN APP ====================
export default function App() {
  const [user, setUser] = useState(null);
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('expert_id');
    const name = localStorage.getItem('expert_name');
    const role = localStorage.getItem('expert_role');
    if (id) setUser({ id, name, role });
    setLoading(false);
  }, []);

  const handleLogin = (data) => setUser(data);
  const handleLogout = () => { localStorage.clear(); setUser(null); setSelectedExpert(null); };
  const handleSelectExpert = (expert) => setSelectedExpert(expert);
  const handleBackToAdmin = () => setSelectedExpert(null);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-500">Завантаження...</div></div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;
  
  if (user.role === 'admin') {
    if (selectedExpert) return <ExpertDashboard expertId={selectedExpert.id} expertName={selectedExpert.name} onLogout={handleBackToAdmin} isAdminView={true} />;
    return <AdminPanel onSelectExpert={handleSelectExpert} onLogout={handleLogout} />;
  }
  
  return <ExpertDashboard expertId={user.id} expertName={user.name} onLogout={handleLogout} />;
}
