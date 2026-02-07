import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlwjocmcmrplvulqxnik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd2pvY21jbXJwbHZ1bHF4bmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODY5NjgsImV4cCI6MjA4NTg2Mjk2OH0.5jbJRQVUJ2Hcle3bhq3LOtAtRpaHAd5_Slh44_h9apM';
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUSES = {
  new: { label: 'Новый', color: 'bg-gray-500', order: 1 },
  diagnostic_scheduled: { label: 'Диагностика запланирована', color: 'bg-yellow-500', order: 2 },
  diagnostic_done: { label: 'Диагностика проведена', color: 'bg-blue-500', order: 3 },
  call_scheduled: { label: 'Звонок запланирован', color: 'bg-purple-500', order: 4 },
  call_done: { label: 'Звонок проведён', color: 'bg-green-500', order: 5 },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
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
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
};

const ClientList = ({ clients, selectedClient, onSelectClient, unreadCounts, onClose }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filteredClients = clients
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.first_name?.toLowerCase().includes(s) || c.last_name?.toLowerCase().includes(s) || c.telegram_username?.toLowerCase().includes(s);
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <input type="text" placeholder="Поиск клиента..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500" />
      </div>
      <div className="p-3 border-b border-slate-700 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium transition ${filter === 'all' ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
          Все ({clients.length})
        </button>
        {Object.entries(STATUSES).map(([key, { label }]) => {
          const count = clients.filter(c => c.status === key).length;
          return (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${filter === key ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {label.split(' ')[0]} ({count})
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredClients.map((client) => {
          const unread = unreadCounts[client.id] || 0;
          const isSelected = selectedClient?.id === client.id;
          return (
            <div key={client.id} onClick={() => { onSelectClient(client); if (onClose) onClose(); }}
              className={`p-4 border-b border-slate-700/50 cursor-pointer transition ${isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold">
                    {client.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-white">{client.first_name} {client.last_name}</div>
                    <div className="text-sm text-slate-400">@{client.telegram_username || 'no username'}</div>
                  </div>
                </div>
                {unread > 0 && <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded-full">{unread}</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUSES[client.status]?.color || 'bg-gray-500'}`}></span>
                <span className="text-xs text-slate-400">{STATUSES[client.status]?.label || client.status}</span>
                <span className="text-xs text-slate-500 ml-auto">{formatDate(client.updated_at)}</span>
              </div>
            </div>
          );
        })}
        {filteredClients.length === 0 && <div className="p-8 text-center text-slate-500">Клиенты не найдены</div>}
      </div>
    </div>
  );
};

const ChatWindow = ({ client, messages, onSendMessage, onSendFile, onStatusChange, onNotesChange, onAddReminder, onBack, isMobile }) => {
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState(client?.notes || '');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const videoStreamRef = useRef(null);

  useEffect(() => { setNotes(client?.notes || ''); }, [client?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
        <div className="text-center"><div className="text-6xl mb-4">💬</div><div>Выберите клиента для начала общения</div></div>
      </div>
    );
  }

  const handleSend = () => { if (!newMessage.trim()) return; onSendMessage(newMessage); setNewMessage(''); };
  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await onSendFile(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Ошибка загрузки файла');
    }
    setUploading(false);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Пробуем использовать ogg формат, если браузер поддерживает
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mimeType });
        
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        setIsRecording(false);
        
        setUploading(true);
        try {
          await onSendFile(audioFile, 'voice');
        } catch (err) {
          console.error('Upload error:', err);
          alert('Ошибка отправки аудио');
        }
        setUploading(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
      setIsRecording(false);
      audioChunksRef.current = [];
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Функции для записи видео-кружочка
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 384, height: 384, facingMode: 'user' }, 
        audio: true 
      });
      
      videoStreamRef.current = stream;
      setShowVideoPreview(true);
      
      // Показываем превью
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 100);
      
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
        const videoFile = new File([videoBlob], `video_note_${Date.now()}.webm`, { type: mimeType });
        
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        setIsVideoRecording(false);
        setShowVideoPreview(false);
        
        setUploading(true);
        try {
          await onSendFile(videoFile, 'video_note');
        } catch (err) {
          console.error('Upload error:', err);
          alert('Ошибка отправки видео');
        }
        setUploading(false);
      };

      mediaRecorder.start();
      setIsVideoRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          // Максимум 60 секунд для видео-кружочка
          if (prev >= 59) {
            stopVideoRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Не удалось получить доступ к камере');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isVideoRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelVideoRecording = () => {
    if (mediaRecorderRef.current && isVideoRecording) {
      videoStreamRef.current?.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
      setIsVideoRecording(false);
      setShowVideoPreview(false);
      videoChunksRef.current = [];
    }
  };

  return (
    <div className="flex-1 flex bg-slate-950 relative">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-3 md:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            {isMobile && (
              <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold flex-shrink-0">{client.first_name?.[0] || '?'}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-white truncate">{client.first_name} {client.last_name}</div>
              <div className="text-sm text-slate-400 truncate">@{client.telegram_username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={client.status} onChange={(e) => onStatusChange(e.target.value)} className="px-2 md:px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm">
              {Object.entries(STATUSES).map(([key, { label }]) => (<option key={key} value={key}>{isMobile ? label.split(' ')[0] : label}</option>))}
            </select>
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 md:hidden">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'expert' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-md rounded-2xl px-3 md:px-4 py-2 md:py-3 ${msg.direction === 'expert' ? 'bg-amber-500 text-black rounded-br-md' : 'bg-slate-800 text-white rounded-bl-md'}`}>
                {msg.content_type === 'photo' && msg.file_url && <img src={msg.file_url} alt="Фото" className="rounded-lg mb-2 max-w-full cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />}
                {msg.content_type === 'video' && msg.file_url && <video src={msg.file_url} controls className="rounded-lg mb-2 max-w-full" />}
                {msg.content_type === 'video_note' && msg.file_url && (
                  <video src={msg.file_url} controls className="rounded-full mb-2 w-48 h-48 object-cover cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />
                )}
                {msg.content_type === 'voice' && msg.file_url && <audio src={msg.file_url} controls className="mb-2 max-w-full" />}
                {msg.content_type === 'audio' && msg.file_url && <audio src={msg.file_url} controls className="mb-2 max-w-full" />}
                {msg.content_type === 'document' && msg.file_url && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    {msg.file_name || 'Документ'}
                  </a>
                )}
                {msg.text_content && <div className="break-words">{msg.text_content}</div>}
                <div className={`text-xs mt-1 ${msg.direction === 'expert' ? 'text-black/60' : 'text-slate-500'}`}>{formatFullDate(msg.created_at)}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-700">
          {isRecording ? (
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
              <button onClick={cancelRecording} className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition" title="Отменить">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex-1 flex items-center gap-3">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-white font-medium">🎤 Запись... {formatRecordingTime(recordingTime)}</span>
              </div>
              <button onClick={stopRecording} className="p-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full transition" title="Отправить">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          ) : isVideoRecording || showVideoPreview ? (
            <div className="flex flex-col items-center gap-3 bg-slate-800 rounded-xl p-4">
              <div className="relative">
                <video 
                  ref={videoPreviewRef} 
                  autoPlay 
                  muted 
                  playsInline
                  className="w-48 h-48 rounded-full object-cover border-4 border-amber-500"
                />
                {isVideoRecording && (
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {formatRecordingTime(recordingTime)}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={cancelVideoRecording} className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition" title="Отменить">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {isVideoRecording && (
                  <button onClick={stopVideoRecording} className="p-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full transition" title="Отправить">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2 md:gap-3">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition flex-shrink-0" title="Прикрепить файл">
                {uploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                )}
              </button>
              <button onClick={startRecording} disabled={uploading} className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition flex-shrink-0" title="Записать аудио">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
              <button onClick={startVideoRecording} disabled={uploading} className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition flex-shrink-0" title="Записать видео-кружочек">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Введите сообщение..." rows={1}
                className="flex-1 px-3 md:px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none" />
              <button onClick={handleSend} disabled={!newMessage.trim()} className="px-4 md:px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-medium rounded-xl transition flex-shrink-0">
                <span className="hidden md:inline">Отправить</span>
                <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Sidebar - Desktop always visible, Mobile as overlay */}
      <div className={`${isMobile ? 'absolute inset-y-0 right-0 z-10 transform transition-transform duration-300' : ''} ${isMobile && !showSidebar ? 'translate-x-full' : 'translate-x-0'} w-80 bg-slate-900 border-l border-slate-700 flex flex-col ${isMobile ? 'shadow-2xl' : 'hidden md:flex'}`}>
        {isMobile && (
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-medium text-white">Информация</h3>
            <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-slate-800 rounded text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className={`p-4 border-b border-slate-700 ${isMobile ? '' : ''}`}>
          {!isMobile && <h3 className="font-medium text-white mb-3">Информация</h3>}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Telegram ID:</span><span className="text-white">{client.telegram_id}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Добавлен:</span><span className="text-white">{formatFullDate(client.created_at)}</span></div>
          </div>
        </div>
        <div className="p-4 border-b border-slate-700 flex-1">
          <h3 className="font-medium text-white mb-3">Заметки</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Заметки по клиенту..."
            className="w-full h-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none text-sm" />
          <button onClick={() => onNotesChange(notes)} className="mt-2 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition">Сохранить заметки</button>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Напоминания</h3>
            <button onClick={() => setShowReminder(!showReminder)} className="text-amber-500 hover:text-amber-400 text-sm">+ Добавить</button>
          </div>
          {showReminder && (
            <div className="mb-4 p-3 bg-slate-800 rounded-lg space-y-2">
              <input type="text" value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="Текст напоминания..." className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none text-sm" />
              <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none text-sm" />
              <button onClick={() => { if (reminderText && reminderDate) { onAddReminder(reminderText, reminderDate); setReminderText(''); setReminderDate(''); setShowReminder(false); } }} className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black rounded text-sm font-medium">Создать</button>
            </div>
          )}
        </div>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {isMobile && showSidebar && (
        <div className="absolute inset-0 bg-black/50 z-0" onClick={() => setShowSidebar(false)} />
      )}
    </div>
  );
};

const Analytics = ({ analytics }) => {
  if (!analytics) return null;
  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen overflow-auto">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Аналитика</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700"><div className="text-2xl md:text-3xl font-bold text-white">{analytics.total_clients}</div><div className="text-slate-400 mt-1 text-sm md:text-base">Всего клиентов</div></div>
        <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700"><div className="text-2xl md:text-3xl font-bold text-amber-500">{analytics.unread_messages}</div><div className="text-slate-400 mt-1 text-sm md:text-base">Непрочитанных</div></div>
        <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700"><div className="text-2xl md:text-3xl font-bold text-green-500">{analytics.conversion_rates?.to_diagnostic || 0}%</div><div className="text-slate-400 mt-1 text-sm md:text-base">В диагностику</div></div>
        <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700"><div className="text-2xl md:text-3xl font-bold text-purple-500">{analytics.conversion_rates?.to_call || 0}%</div><div className="text-slate-400 mt-1 text-sm md:text-base">В звонок</div></div>
      </div>
      <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700">
        <h3 className="text-lg font-medium text-white mb-4">Воронка</h3>
        <div className="space-y-3">
          {Object.entries(STATUSES).map(([key, { label, color }]) => {
            const count = analytics.status_counts?.[key] || 0;
            const pct = analytics.total_clients > 0 ? Math.round(count / analytics.total_clients * 100) : 0;
            return (
              <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="md:w-48 text-slate-300 text-sm md:text-base">{label}</div>
                <div className="flex-1 bg-slate-800 rounded-full h-6 md:h-8 overflow-hidden"><div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} /></div>
                <div className="md:w-20 text-right text-white font-medium text-sm md:text-base">{count} ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AccessManagement = ({ authorizedUsers, onAddUser, onRemoveUser }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const handleAdd = () => { if (!username && !email) return; onAddUser({ telegram_username: username, email }); setUsername(''); setEmail(''); };
  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen overflow-auto">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Управление доступом</h2>
      <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Добавить пользователя</h3>
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username в Telegram" className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (опционально)" className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500" />
          <button onClick={handleAdd} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition">Добавить</button>
        </div>
      </div>
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead className="bg-slate-800"><tr><th className="text-left p-4 text-slate-300 font-medium">Username</th><th className="text-left p-4 text-slate-300 font-medium">Email</th><th className="text-left p-4 text-slate-300 font-medium">Добавлен</th><th className="text-right p-4 text-slate-300 font-medium">Действия</th></tr></thead>
          <tbody>
            {authorizedUsers.map((user) => (
              <tr key={user.id} className="border-t border-slate-700">
                <td className="p-4 text-white">@{user.telegram_username || '—'}</td>
                <td className="p-4 text-slate-400">{user.email || '—'}</td>
                <td className="p-4 text-slate-400">{formatFullDate(user.created_at)}</td>
                <td className="p-4 text-right"><button onClick={() => onRemoveUser(user.id)} className="text-red-400 hover:text-red-300">Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {authorizedUsers.length === 0 && <div className="p-8 text-center text-slate-500">Нет авторизованных пользователей</div>}
      </div>
    </div>
  );
};

const Reminders = ({ reminders, onComplete }) => {
  const now = new Date();
  const overdue = reminders.filter(r => new Date(r.remind_at) < now && !r.is_completed);
  const today = reminders.filter(r => { const d = new Date(r.remind_at); return d >= now && d.toDateString() === now.toDateString() && !r.is_completed; });
  const future = reminders.filter(r => { const d = new Date(r.remind_at); return d > now && d.toDateString() !== now.toDateString() && !r.is_completed; });
  const ReminderItem = ({ reminder }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-800 rounded-lg">
      <div><div className="text-white">{reminder.reminder_text}</div><div className="text-sm text-slate-400 mt-1">{reminder.clients?.first_name} {reminder.clients?.last_name} • {formatFullDate(reminder.remind_at)}</div></div>
      <button onClick={() => onComplete(reminder.id)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm self-start md:self-auto">Выполнено</button>
    </div>
  );
  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen overflow-auto">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Напоминания</h2>
      {overdue.length > 0 && <div className="mb-6"><h3 className="text-lg font-medium text-red-400 mb-3">🔴 Просрочено</h3><div className="space-y-2">{overdue.map(r => <ReminderItem key={r.id} reminder={r} />)}</div></div>}
      {today.length > 0 && <div className="mb-6"><h3 className="text-lg font-medium text-amber-400 mb-3">🟡 Сегодня</h3><div className="space-y-2">{today.map(r => <ReminderItem key={r.id} reminder={r} />)}</div></div>}
      {future.length > 0 && <div className="mb-6"><h3 className="text-lg font-medium text-slate-300 mb-3">🔵 Предстоящие</h3><div className="space-y-2">{future.map(r => <ReminderItem key={r.id} reminder={r} />)}</div></div>}
      {reminders.filter(r => !r.is_completed).length === 0 && <div className="text-center text-slate-500 py-12">Нет активных напоминаний</div>}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [showClientList, setShowClientList] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadClients(); loadAuthorizedUsers(); loadReminders();
    const clientsSub = supabase.channel('clients').on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadClients()).subscribe();
    const msgSub = supabase.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      if (selectedClient && payload.new.client_id === selectedClient.id) setMessages(prev => [...prev, payload.new]);
      loadUnreadCounts();
    }).subscribe();
    return () => { supabase.removeChannel(clientsSub); supabase.removeChannel(msgSub); };
  }, [selectedClient]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('updated_at', { ascending: false });
    if (data) { setClients(data); computeAnalytics(data); }
    loadUnreadCounts();
  };

  const loadUnreadCounts = async () => {
    const { data } = await supabase.from('messages').select('client_id').eq('direction', 'client').eq('is_read', false);
    if (data) { const counts = {}; data.forEach(m => { counts[m.client_id] = (counts[m.client_id] || 0) + 1; }); setUnreadCounts(counts); }
  };

  const loadMessages = async (clientId) => {
    const { data } = await supabase.from('messages').select('*').eq('client_id', clientId).order('created_at');
    if (data) setMessages(data);
    await supabase.from('messages').update({ is_read: true }).eq('client_id', clientId).eq('direction', 'client');
    loadUnreadCounts();
  };

  const computeAnalytics = (clientsData) => {
    const statusCounts = { new: 0, diagnostic_scheduled: 0, diagnostic_done: 0, call_scheduled: 0, call_done: 0 };
    clientsData.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });
    const total = clientsData.length;
    setAnalytics({
      total_clients: total, status_counts: statusCounts,
      unread_messages: Object.values(unreadCounts).reduce((a, b) => a + b, 0),
      conversion_rates: { to_diagnostic: total > 0 ? Math.round((statusCounts.diagnostic_done + statusCounts.call_scheduled + statusCounts.call_done) / total * 100) : 0, to_call: total > 0 ? Math.round(statusCounts.call_done / total * 100) : 0 }
    });
  };

  const loadAuthorizedUsers = async () => { const { data } = await supabase.from('authorized_users').select('*').order('created_at', { ascending: false }); if (data) setAuthorizedUsers(data); };
  const loadReminders = async () => { const { data } = await supabase.from('reminders').select('*, clients(first_name, last_name)').eq('is_completed', false).order('remind_at'); if (data) setReminders(data); };

  const handleSelectClient = (client) => { 
    setSelectedClient(client); 
    loadMessages(client.id); 
    if (isMobile) setShowClientList(false);
  };

  const handleSendMessage = async (text) => {
    if (!selectedClient) return;
    await supabase.from('messages').insert({ client_id: selectedClient.id, direction: 'expert', content_type: 'text', text_content: text, is_read: false });
    loadMessages(selectedClient.id);
  };

  const handleSendFile = async (file, forceContentType = null) => {
    if (!selectedClient) return;
    
    const timestamp = Date.now();
    const fileName = `expert_${timestamp}_${file.name}`;
    const filePath = `uploads/${fileName}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage.from('diagnostic-files').upload(filePath, file);
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('diagnostic-files').getPublicUrl(filePath);
    
    // Determine content type
    let contentType = forceContentType || 'document';
    if (!forceContentType) {
      if (file.type.startsWith('image/')) contentType = 'photo';
      else if (file.type.startsWith('video/')) contentType = 'video';
      else if (file.type.startsWith('audio/')) contentType = 'voice';
    }
    
    // Save message
    await supabase.from('messages').insert({
      client_id: selectedClient.id,
      direction: 'expert',
      content_type: contentType,
      file_url: publicUrl,
      file_name: file.name,
      is_read: false
    });
    
    loadMessages(selectedClient.id);
  };

  const handleStatusChange = async (status) => {
    if (!selectedClient) return;
    await supabase.from('clients').update({ status }).eq('id', selectedClient.id);
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
  const handleAddAuthorizedUser = async (userData) => { await supabase.from('authorized_users').insert({ ...userData, telegram_username: userData.telegram_username?.toLowerCase().replace('@', '') }); loadAuthorizedUsers(); };
  const handleRemoveAuthorizedUser = async (id) => { await supabase.from('authorized_users').delete().eq('id', id); loadAuthorizedUsers(); };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-700 px-3 md:px-6 py-2 md:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl">💎</span>
          <span className="text-lg md:text-xl font-bold text-white hidden sm:inline">Diagnostic CRM</span>
        </div>
        <div className="flex gap-1 md:gap-2">
          {[
            { id: 'chat', label: '💬', fullLabel: '💬 Чаты', count: totalUnread },
            { id: 'reminders', label: '🔔', fullLabel: '🔔 Напоминания', count: reminders.length },
            { id: 'analytics', label: '📊', fullLabel: '📊 Аналитика' },
            { id: 'access', label: '👥', fullLabel: '👥 Доступ' }
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'chat' && isMobile) setShowClientList(true); }} className={`px-3 md:px-4 py-2 rounded-lg font-medium transition flex items-center gap-1 md:gap-2 text-sm md:text-base ${activeTab === tab.id ? 'bg-amber-500 text-black' : 'text-slate-300 hover:bg-slate-800'}`}>
              <span className="md:hidden">{tab.label}</span>
              <span className="hidden md:inline">{tab.fullLabel}</span>
              {tab.count > 0 && <span className={`text-xs px-1.5 md:px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-amber-500 text-black'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </nav>
      
      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' && (
          <>
            {/* Client list - Hidden on mobile when chat is open */}
            <div className={`${isMobile ? (showClientList ? 'w-full' : 'hidden') : 'w-80'}`}>
              <ClientList 
                clients={clients} 
                selectedClient={selectedClient} 
                onSelectClient={handleSelectClient} 
                unreadCounts={unreadCounts}
                onClose={() => setShowClientList(false)}
              />
            </div>
            {/* Chat window - Hidden on mobile when client list is open */}
            <div className={`flex-1 ${isMobile && showClientList ? 'hidden' : 'flex'}`}>
              <ChatWindow 
                client={selectedClient} 
                messages={messages} 
                onSendMessage={handleSendMessage}
                onSendFile={handleSendFile}
                onStatusChange={handleStatusChange} 
                onNotesChange={handleNotesChange} 
                onAddReminder={handleAddReminder}
                onBack={() => setShowClientList(true)}
                isMobile={isMobile}
              />
            </div>
          </>
        )}
        {activeTab === 'analytics' && <Analytics analytics={analytics} />}
        {activeTab === 'access' && <AccessManagement authorizedUsers={authorizedUsers} onAddUser={handleAddAuthorizedUser} onRemoveUser={handleRemoveAuthorizedUser} />}
        {activeTab === 'reminders' && <Reminders reminders={reminders} onComplete={handleCompleteReminder} />}
      </div>
    </div>
  );
}
