// MainBoard - Main comparison board using Hybrid Real-time Subscriptions (PeerJS P2P + Firebase)
// Handles solutions, HTML-aware previews, auto-comparison, chat, and "next segment" flow

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SessionData, ChatMessage, ComparisonResult } from '../types';
import { compareSolutions } from '../utils/diffEngine';
import { getComparableContent, parseHtmlContent } from '../utils/htmlFormatter';
import {
  subscribeToSession,
  updateSolution as updateSolutionRemote,
  addChatMessage as addChatMsgRemote,
  saveAndReset as saveAndResetRemote,
  getOtherUser,
  cleanupSession,
  generateId,
  getLocalUserId,
} from '../utils/sessionManager';
import DiffViewer from './DiffViewer';
import ChatPanel from './ChatPanel';
import StructuredSolutionPreview from './StructuredSolutionPreview';

interface MainBoardProps {
  sessionId: string;
  userName: string;
  onLeave: () => void;
}

type PanelMode = 'source' | 'structured';

export default function MainBoard({
  sessionId,
  userName,
  onLeave,
}: MainBoardProps) {
  const userId = getLocalUserId();
  const [session, setSession] = useState<SessionData | null>(null);
  const [mySolution, setMySolution] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showNextModal, setShowNextModal] = useState(false);
  const [nextSegment, setNextSegment] = useState('');
  const [copied, setCopied] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [myPanelMode, setMyPanelMode] = useState<PanelMode>('source');
  const [otherPanelMode, setOtherPanelMode] = useState<PanelMode>('structured');
  const solutionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // ==========================================
  // Real-time session subscription
  // ==========================================
  useEffect(() => {
    const unsubscribe = subscribeToSession(sessionId, (updatedSession) => {
      setSession(updatedSession);

      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        const currentUser = updatedSession.users.find((u) => u.id === userId);
        if (currentUser && currentUser.solution && !mySolution) {
          setMySolution(currentUser.solution);
        }
      }
    });

    return () => {
      unsubscribe();
      cleanupSession(sessionId);
    };
  }, [sessionId, userId]);

  const otherUser = session ? getOtherUser(session, userId) : null;
  const otherSolution = otherUser?.solution || '';

  const myParsed = useMemo(() => parseHtmlContent(mySolution), [mySolution]);
  const otherParsed = useMemo(() => parseHtmlContent(otherSolution), [otherSolution]);
  const myComparableContent = useMemo(() => getComparableContent(mySolution), [mySolution]);
  const otherComparableContent = useMemo(
    () => getComparableContent(otherSolution),
    [otherSolution]
  );

  useEffect(() => {
    if (myParsed.isHtml) {
      setMyPanelMode('structured');
    } else if (!mySolution.trim()) {
      setMyPanelMode('source');
    }
  }, [myParsed.isHtml, mySolution]);

  useEffect(() => {
    if (otherParsed.isHtml) {
      setOtherPanelMode('structured');
    } else if (!otherSolution.trim()) {
      setOtherPanelMode('source');
    }
  }, [otherParsed.isHtml, otherSolution]);

  // ==========================================
  // Auto-compare when solutions change
  // ==========================================
  useEffect(() => {
    if (compareTimeoutRef.current) {
      clearTimeout(compareTimeoutRef.current);
    }

    if (!session) return;

    if (!myComparableContent.trim() && !otherComparableContent.trim()) {
      setComparisonResult(null);
      return;
    }

    setIsComparing(true);
    compareTimeoutRef.current = setTimeout(() => {
      const result = compareSolutions(myComparableContent, otherComparableContent);
      setComparisonResult(result);
      setIsComparing(false);
    }, 250);

    return () => {
      if (compareTimeoutRef.current) clearTimeout(compareTimeoutRef.current);
    };
  }, [myComparableContent, otherComparableContent, session]);

  // ==========================================
  // Solution change handler (debounced save)
  // ==========================================
  const handleSolutionChange = useCallback(
    (value: string) => {
      setMySolution(value);

      if (solutionTimeoutRef.current) {
        clearTimeout(solutionTimeoutRef.current);
      }
      solutionTimeoutRef.current = setTimeout(() => {
        updateSolutionRemote(sessionId, userId, value);
      }, 500);
    },
    [sessionId, userId]
  );

  // ==========================================
  // Chat message sender
  // ==========================================
  const handleSendMessage = useCallback(
    async (content: string, image?: string) => {
      const msg: ChatMessage = {
        id: generateId(),
        senderId: userId,
        senderName: userName,
        content,
        timestamp: Date.now(),
        image,
      };
      await addChatMsgRemote(sessionId, msg);
    },
    [sessionId, userId, userName]
  );

  // ==========================================
  // Next segment handler
  // ==========================================
  const handleNext = async () => {
    if (!nextSegment.trim()) {
      setNextSegment(session?.segment || '');
      return;
    }

    const updated = await saveAndResetRemote(sessionId, nextSegment.trim());
    if (updated) {
      setSession(updated);
      setMySolution('');
      setComparisonResult(null);
      setShowNextModal(false);
      setNextSegment('');
      setMyPanelMode('source');
      setOtherPanelMode('structured');
    }
  };

  // ==========================================
  // Copy session code
  // ==========================================
  const handleCopyCode = async () => {
    if (!session?.code) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = session.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4 shadow-lg shadow-cyan-500/20 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-white/40 text-sm">جاري جلب بيانات الجلسة...</p>
        </div>
      </div>
    );
  }

  const hasColleague = session.users.length >= 2;
  const htmlDetected = myParsed.isHtml || otherParsed.isHtml;

  return (
    <div className="min-h-screen relative pt-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute top-20 right-10 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="orb-2 absolute bottom-40 left-20 w-80 h-80 rounded-full bg-purple-500/4 blur-3xl" />
        <div className="orb-3 absolute top-1/2 left-1/3 w-56 h-56 rounded-full bg-pink-500/3 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="glass border-b border-white/5 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onLeave}
                className="text-white/30 hover:text-white/60 transition-colors mr-2"
                title="خرج من الجلسة"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
              <div>
                <h1 className="text-white/90 font-bold text-sm">📋 {session.segment}</h1>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/30">كود الجلسة:</span>
                  <button onClick={handleCopyCode} className="font-mono text-cyan-400 hover:text-cyan-300 transition-colors font-bold text-sm">
                    {session.code}
                  </button>
                  {copied && <span className="text-emerald-400 text-xs">✓ تم النسخ</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasColleague ? (
                <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white/80 text-xs font-semibold">{otherUser?.name} أونلاين</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full pulse-glow border border-amber-500/30">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-300 text-xs font-medium">مستني زميلك...</span>
                </div>
              )}

              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="relative w-9 h-9 rounded-xl glass flex items-center justify-center text-white/40 hover:text-white/70 transition-colors border border-white/10"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {session.chat.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {session.chat.length > 9 ? '9+' : session.chat.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex gap-4">
            <div className={`flex-1 min-w-0 transition-all duration-300 ${chatOpen ? 'hidden lg:block' : ''}`}>
              {!hasColleague && (
                <div className="glass-strong rounded-2xl p-8 text-center mb-5 fade-in-up border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-4 border border-cyan-500/30">
                    <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-white font-bold text-lg mb-1">مستنيين زميلك ينضم 🎯</h2>
                  <p className="text-white/50 text-xs mb-4">ابعث الكود ده لزميلك وهو هيقدر ينضم معاك فوراً من أي جهاز:</p>
                  <div className="inline-flex items-center gap-3 glass-strong px-6 py-3 rounded-2xl border border-cyan-500/40">
                    <span className="font-mono text-3xl font-extrabold text-cyan-400 tracking-widest">{session.code}</span>
                    <button onClick={handleCopyCode} className="text-white/50 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                      <span>{copied ? '✓ تم' : '📋 نسخ'}</span>
                    </button>
                  </div>
                  <p className="text-white/30 text-[11px] mt-4">✓ أول ما يكتب الكود هيظهر هنا أونلاين.</p>
                </div>
              )}

              {htmlDetected && (
                <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/7 px-4 py-3 text-xs text-cyan-200 leading-6">
                  <span className="font-bold">تم اكتشاف HTML.</span> التطبيق دلوقتي بيحوّل المحتوى لعرض منظم، والمقارنة بتحصل على النص المستخرج من الفورم بدل الـ source الخام.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="glass rounded-2xl overflow-hidden border border-white/10">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-white/80 text-xs font-bold truncate">حلّك ({userName})</span>
                      {myParsed.isHtml && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-[10px] font-bold">HTML</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {myParsed.isHtml && (
                        <div className="flex items-center gap-1 glass px-1 py-1 rounded-lg">
                          <button
                            onClick={() => setMyPanelMode('structured')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                              myPanelMode === 'structured' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/35 hover:text-white/70'
                            }`}
                          >
                            معاينة
                          </button>
                          <button
                            onClick={() => setMyPanelMode('source')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                              myPanelMode === 'source' ? 'bg-white/10 text-white/90' : 'text-white/35 hover:text-white/70'
                            }`}
                          >
                            المصدر
                          </button>
                        </div>
                      )}
                      <span className="text-white/30 text-xs">{mySolution.length} حرف</span>
                    </div>
                  </div>

                  {myParsed.isHtml && myPanelMode === 'structured' ? (
                    <div className="h-48 md:h-56">
                      <StructuredSolutionPreview
                        content={mySolution}
                        title={`تم استخراج ${myParsed.qaPairs.length || myParsed.lines.length} عنصر للعرض`}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={mySolution}
                      onChange={(e) => handleSolutionChange(e.target.value)}
                      placeholder="حط حلّك هنا... ينفع نص عادي أو HTML من الفورم 💡"
                      className="w-full h-48 md:h-56 bg-transparent px-4 py-3 text-white/90 text-sm code-area placeholder-white/20 resize-none focus:outline-none"
                    />
                  )}
                </div>

                <div className="glass rounded-2xl overflow-hidden border border-white/10">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-white/80 text-xs font-bold truncate">حلّ زميلك ({otherUser?.name || '...'})</span>
                      {otherParsed.isHtml && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-bold">HTML</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {otherParsed.isHtml && (
                        <div className="flex items-center gap-1 glass px-1 py-1 rounded-lg">
                          <button
                            onClick={() => setOtherPanelMode('structured')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                              otherPanelMode === 'structured' ? 'bg-purple-500/20 text-purple-300' : 'text-white/35 hover:text-white/70'
                            }`}
                          >
                            معاينة
                          </button>
                          <button
                            onClick={() => setOtherPanelMode('source')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                              otherPanelMode === 'source' ? 'bg-white/10 text-white/90' : 'text-white/35 hover:text-white/70'
                            }`}
                          >
                            المصدر
                          </button>
                        </div>
                      )}
                      <span className="text-white/30 text-xs">{otherSolution.length} حرف</span>
                    </div>
                  </div>

                  {otherSolution ? (
                    otherParsed.isHtml && otherPanelMode === 'structured' ? (
                      <div className="h-48 md:h-56">
                        <StructuredSolutionPreview
                          content={otherSolution}
                          title={`تم استخراج ${otherParsed.qaPairs.length || otherParsed.lines.length} عنصر للعرض`}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 md:h-56 px-4 py-3 overflow-y-auto">
                        <pre className="text-white/80 text-sm code-area whitespace-pre-wrap">{otherSolution}</pre>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-48 md:h-56 px-4 py-3 overflow-y-auto">
                      <div className="h-full flex items-center justify-center text-center">
                        <span className="text-white/25 text-xs font-medium">
                          {hasColleague ? 'لسه مكتبش حل... ⏳' : 'مستنيين زميلك ينضم ويكتب حلّه...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 relative">
                {isComparing && (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 glass-strong px-3 py-1 rounded-full border border-cyan-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-300 text-xs font-medium">بقارن المحتوى المستخرج...</span>
                  </div>
                )}
                <DiffViewer
                  result={comparisonResult}
                  userName={userName}
                  colleagueName={otherUser?.name || 'زميلك'}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setChatOpen(true)}
                  className="lg:hidden glass px-4 py-2.5 rounded-xl text-white/70 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/10"
                >
                  💬 المحادثة
                  {session.chat.length > 0 && (
                    <span className="bg-cyan-500/30 text-cyan-300 px-1.5 rounded-full text-[10px] font-bold">{session.chat.length}</span>
                  )}
                </button>

                <div className="flex-1" />

                {session.history.length > 0 && (
                  <span className="text-white/30 text-xs font-medium">📁 {session.history.length} أجزاء اتسجلت</span>
                )}

                <button
                  onClick={() => setShowNextModal(true)}
                  disabled={!hasColleague || !mySolution.trim()}
                  className={`px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                    hasColleague && mySolution.trim()
                      ? 'bg-gradient-to-l from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]'
                      : 'glass text-white/20 cursor-not-allowed border border-white/5'
                  }`}
                >
                  يلا على اللي بعده 🚀
                </button>
              </div>
            </div>

            <div className={`${chatOpen ? 'w-80 xl:w-96 flex-shrink-0' : 'w-0 flex-shrink-0 overflow-hidden'} transition-all duration-300`}>
              <ChatPanel
                messages={session.chat}
                currentUserId={userId}
                onSendMessage={handleSendMessage}
                isOpen={chatOpen}
                onToggle={() => setChatOpen(false)}
                otherUserName={otherUser?.name || 'زميلك'}
              />
            </div>
          </div>
        </div>
      </div>

      {showNextModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 fade-in">
          <div className="glass-strong rounded-2xl p-6 md:p-8 w-full max-w-md fade-in-up border border-cyan-500/30">
            <h2 className="text-white font-bold text-lg mb-2">الجزء اللي بعده 🎯</h2>
            <p className="text-white/50 text-xs mb-5">اكتب اسم الجزء الجديد وهنمسح اللوح ونبدأ من جديد</p>

            <input
              type="text"
              value={nextSegment}
              onChange={(e) => setNextSegment(e.target.value)}
              placeholder="اسم الجزء الجديد..."
              className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm mb-5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNext();
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowNextModal(false)}
                className="flex-1 glass px-4 py-2.5 rounded-xl text-white/50 hover:text-white text-xs font-medium transition-colors"
              >
                لسه مش كفاية
              </button>
              <button
                onClick={handleNext}
                disabled={!nextSegment.trim()}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 ${
                  nextSegment.trim()
                    ? 'bg-gradient-to-l from-cyan-500 to-purple-600 text-white hover:scale-[1.02] shadow-lg shadow-cyan-500/20'
                    : 'glass text-white/20 cursor-not-allowed'
                }`}
              >
                يلا على اللي بعده 🚀
              </button>
            </div>

            {session.history.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-white/40 text-[11px] mb-2 font-bold">الأجزاء اللي اتسجلت في السجل:</p>
                <div className="flex flex-wrap gap-1.5">
                  {session.history.map((h, i) => (
                    <span key={i} className="glass px-2.5 py-1 rounded-md text-cyan-300 text-[11px] font-mono border border-cyan-500/20">{h.segment}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
