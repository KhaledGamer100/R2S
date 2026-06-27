// App.tsx - Root component managing navigation between Login and MainBoard views
// Provides hybrid PeerJS + Firebase + Local sync

import { useState, useEffect } from 'react';
import { AppView } from './types';
import { initFirebase, isFirebaseReady } from './config/firebase';
import {
  createSession,
  joinSession,
  getSession,
  getLocalUserId,
  saveLocalUserName,
  getLocalUserName,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
  cleanupOldSessions,
  initPeerConnection,
} from './utils/sessionManager';
import LoginScreen from './components/LoginScreen';
import MainBoard from './components/MainBoard';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [sessionId, setSessionId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fbReady, setFbReady] = useState(false);

  useEffect(() => {
    // 1. Initialize Firebase if configured
    const db = initFirebase();
    setFbReady(db !== null);

    // 2. Load saved username
    const savedName = getLocalUserName();
    if (savedName) setUserName(savedName);

    // 3. Check for existing active session
    const checkExistingSession = async () => {
      const activeSessionId = getActiveSession();
      if (activeSessionId) {
        try {
          const session = await getSession(activeSessionId);
          if (session) {
            const userId = getLocalUserId();
            const userExists = session.users.some((u) => u.id === userId);
            if (userExists) {
              setSessionId(activeSessionId);
              // Init PeerJS P2P connection
              initPeerConnection(session.code, session.users[0]?.id === userId, () => {});
              setView('board');
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore
        }
        clearActiveSession();
      }

      cleanupOldSessions();
      setLoading(false);
    };

    checkExistingSession();
  }, []);

  // Handle session creation
  const handleCreateSession = async (name: string, segment: string) => {
    const userId = getLocalUserId();
    saveLocalUserName(name);
    setUserName(name);

    const session = await createSession(segment, userId, name);
    saveActiveSession(session.id);
    setSessionId(session.id);

    // Start PeerJS Host connection
    initPeerConnection(session.code, true, () => {});
    setView('board');
  };

  // Handle joining session
  const handleJoinSession = async (
    name: string,
    code: string
  ): Promise<boolean> => {
    const userId = getLocalUserId();
    saveLocalUserName(name);
    setUserName(name);

    const session = await joinSession(code, userId, name);
    if (session) {
      saveActiveSession(session.id);
      setSessionId(session.id);

      // Start PeerJS Guest connection
      initPeerConnection(session.code, false, () => {});
      setView('board');
      return true;
    }
    return false;
  };

  // Leave session
  const handleLeave = () => {
    clearActiveSession();
    setView('login');
    setSessionId('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4 shadow-lg shadow-cyan-500/20 animate-pulse">
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
          <p className="text-white/40 text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Top Status Bar & Settings Button */}
      <div className="fixed top-3 left-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="glass-strong px-3 py-1.5 rounded-xl text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 hover:border-cyan-500/40 transition-all shadow-lg"
        >
          <span>⚙️</span>
          <span>إعدادات الاتصال</span>
        </button>
        <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 glass ${
          fbReady ? 'text-emerald-400 border-emerald-500/30' : 'text-cyan-300 border-cyan-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${fbReady ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
          <span>{fbReady ? 'تزامن عبر Firebase' : 'تزامن مباشر (P2P Mesh)'}</span>
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => {
        setSettingsOpen(false);
        setFbReady(isFirebaseReady());
      }} />

      {view === 'login' && (
        <LoginScreen
          onCreateSession={handleCreateSession}
          onJoinSession={handleJoinSession}
          savedName={userName}
        />
      )}
      {view === 'board' && sessionId && (
        <MainBoard
          sessionId={sessionId}
          userName={userName}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
