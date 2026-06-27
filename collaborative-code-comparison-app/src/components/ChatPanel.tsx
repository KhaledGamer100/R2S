// ChatPanel - Real-time chat with text messages and image uploads
// Supports Base64 image encoding for sharing screenshots

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (content: string, image?: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  otherUserName: string;
}

export default function ChatPanel({
  messages,
  currentUserId,
  onSendMessage,
  isOpen,
  onToggle,
  otherUserName,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      // Resize image to reduce size
      resizeImage(base64, 800, (resized) => {
        onSendMessage('📷 صورة', resized);
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Resize image to reduce Base64 size
  const resizeImage = (
    dataUrl: string,
    maxWidth: number,
    callback: (resized: string) => void
  ) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        callback(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        callback(dataUrl);
      }
    };
    img.src = dataUrl;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  return (
    <>
      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setImagePreview(null)}
        >
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
          />
          <button className="absolute top-4 left-4 text-white/60 hover:text-white text-2xl">
            ✕
          </button>
        </div>
      )}

      {/* Chat toggle button (mobile) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-bl from-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {messages.length > 9 ? '9+' : messages.length}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="glass-strong rounded-2xl flex flex-col h-full max-h-[calc(100vh-2rem)]">
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-sm font-medium">
                محادثة مع {otherUserName || 'زميلك'}
              </span>
            </div>
            <button
              onClick={onToggle}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center text-white/20 text-xs py-8">
                ابدأ المحادثة... 🗨️
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`chat-msg flex flex-col ${
                      isOwn ? 'items-start' : 'items-end'
                    }`}
                  >
                    {/* Sender name */}
                    <span
                      className={`text-xs mb-1 ${
                        isOwn ? 'text-cyan-400/60' : 'text-purple-400/60'
                      }`}
                    >
                      {msg.senderName}
                    </span>

                    {/* Message bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                        isOwn
                          ? 'bg-cyan-500/10 border border-cyan-500/15 rounded-tr-sm'
                          : 'bg-purple-500/10 border border-purple-500/15 rounded-tl-sm'
                      }`}
                    >
                      {/* Image */}
                      {msg.image && (
                        <div className="mb-2">
                          <img
                            src={msg.image}
                            alt="Shared"
                            className="chat-image cursor-pointer"
                            onClick={() => setImagePreview(msg.image!)}
                          />
                        </div>
                      )}

                      {/* Text */}
                      {msg.content && (
                        <p className="text-white/80 text-sm leading-relaxed break-words">
                          {msg.content}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-white/15 text-xs mt-0.5">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t border-white/5">
            <div className="flex items-end gap-2">
              {/* Image upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-9 h-9 rounded-xl glass flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                title="ارفع صورة"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>

              {/* Text input */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالة..."
                rows={1}
                className="flex-1 glass-input px-3 py-2 rounded-xl text-white text-sm placeholder-white/20 resize-none max-h-24 min-h-[36px]"
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  text.trim()
                    ? 'bg-gradient-to-bl from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20 hover:scale-105'
                    : 'glass text-white/20'
                }`}
              >
                <svg
                  className="w-4 h-4 rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
