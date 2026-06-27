// Login Screen - Entry point where users enter their name and create/join a session
// Full Arabic UI with Egyptian Arabic dialect

import { useState } from 'react';

interface LoginScreenProps {
  onCreateSession: (name: string, segment: string) => void;
  onJoinSession: (name: string, code: string) => Promise<boolean> | boolean;
  savedName?: string;
}

type LoginTab = 'create' | 'join';

export default function LoginScreen({
  onCreateSession,
  onJoinSession,
  savedName = '',
}: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<LoginTab>('create');
  const [name, setName] = useState(savedName);
  const [segment, setSegment] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      setError('لازم تكتب اسمك يا برو 😅');
      return;
    }
    if (!segment.trim()) {
      setError('حدد الجزء اللي شغال عليه');
      return;
    }
    setError('');
    onCreateSession(name.trim(), segment.trim());
  };

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('لازم تكتب اسمك يا برو 😅');
      return;
    }
    if (!code.trim()) {
      setError('اكتب كود الجلسة عشان تنضم');
      return;
    }
    if (code.trim().length !== 6) {
      setError('كود الجلسة لازم يكون 6 حروف');
      return;
    }
    setError('');
    try {
      const success = await onJoinSession(name.trim(), code.trim().toUpperCase());
      if (!success) {
        setError('الكود غلط أو الجلسة مليانة 😕');
      }
    } catch {
      setError('حصل مشكلة في الاتصال. جرب تاني.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activeTab === 'create') handleCreate();
      else handleJoin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute top-1/4 right-1/4 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="orb-2 absolute bottom-1/3 left-1/4 w-96 h-96 rounded-full bg-purple-500/8 blur-3xl" />
        <div className="orb-3 absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-pink-500/6 blur-3xl" />
      </div>

      {/* Main card */}
      <div className="glass-strong rounded-3xl p-8 md:p-10 w-full max-w-md relative z-10 fade-in-up">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4 shadow-lg shadow-cyan-500/20">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-l from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            مقارنة الحلول
          </h1>
          <p className="text-white/40 text-sm mt-2">
            قارن حلّك مع زميلك واتفقوا على الحل الصح 🎯
          </p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 glass rounded-xl p-1">
          <button
            onClick={() => {
              setActiveTab('create');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === 'create'
                ? 'bg-gradient-to-l from-cyan-500/20 to-purple-500/20 text-white shadow-lg'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            إنشاء جلسة جديدة
          </button>
          <button
            onClick={() => {
              setActiveTab('join');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === 'join'
                ? 'bg-gradient-to-l from-cyan-500/20 to-purple-500/20 text-white shadow-lg'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            انضم لجلسة
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Name input */}
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5 mr-1">
              اسمك 👤
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: خالد"
              className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm"
              maxLength={30}
            />
          </div>

          {activeTab === 'create' ? (
            /* Segment input */
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 mr-1">
                الجزء / السegment 📋
              </label>
              <input
                type="text"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="مثلاً: Part 1 - Header"
                className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm"
                maxLength={100}
              />
            </div>
          ) : (
            /* Session code input */
            <div>
              <label className="block text-white/50 text-xs font-medium mb-1.5 mr-1">
                كود الجلسة 🔗
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder="مثلاً: ABC123"
                className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm tracking-widest text-center font-mono"
                maxLength={6}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm text-center fade-in">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={activeTab === 'create' ? handleCreate : handleJoin}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 bg-gradient-to-l from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {activeTab === 'create' ? '🚀 ابدأ الجلسة' : '🔗 انضم دلوقتي'}
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-white/20 text-xs text-center mt-6">
          {activeTab === 'create'
            ? 'هتاخد كود تشاركه مع زميلك عشان ينضم'
            : 'اطلب الكود من اللي عمل الجلسة'}
        </p>
      </div>
    </div>
  );
}
