// Session Manager - Hybrid Sync Engine
// Layer 1: PeerJS (WebRTC Peer-to-Peer Data Channels) - Works instantly across any devices/browsers!
// Layer 2: Firebase Realtime Database (if configured)
// Layer 3: LocalStorage + BroadcastChannel (for local offline / same browser tabs)

import {
  ref,
  set,
  get,
  update,
  push,
  onValue,
  remove,
  Unsubscribe,
} from 'firebase/database';
import Peer, { DataConnection } from 'peerjs';
import { getDB, isFirebaseReady } from '../config/firebase';
import { BroadcastMessage, ChatMessage, SessionData, User } from '../types';

// ==========================================
// Constants
// ==========================================

const SESSION_PREFIX = 'collab_session_';
const USER_PREFIX = 'collab_user_';
const CHANNEL_NAME = 'collab_sync_v2';
const PEER_PREFIX = 'arena-collab-v6-';

// Local Sync State
let channel: BroadcastChannel | null = null;
let activeListeners: Map<string, Unsubscribe> = new Map();

// PeerJS state
let peerInstance: Peer | null = null;
let peerConnections: DataConnection[] = [];
let onPeerMessageCallback: ((data: BroadcastMessage) => void) | null = null;

// ==========================================
// ID & Code Generation
// ==========================================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==========================================
// Local User Management
// ==========================================

export function getLocalUserId(): string {
  let userId = localStorage.getItem(USER_PREFIX + 'id');
  if (!userId) {
    userId = generateId();
    localStorage.setItem(USER_PREFIX + 'id', userId);
  }
  return userId;
}

export function saveLocalUserName(name: string): void {
  localStorage.setItem(USER_PREFIX + 'name', name);
}

export function getLocalUserName(): string {
  return localStorage.getItem(USER_PREFIX + 'name') || '';
}

export function saveActiveSession(sessionId: string): void {
  localStorage.setItem(USER_PREFIX + 'activeSession', sessionId);
}

export function getActiveSession(): string | null {
  return localStorage.getItem(USER_PREFIX + 'activeSession');
}

export function clearActiveSession(): void {
  localStorage.removeItem(USER_PREFIX + 'activeSession');
}

export function getGasUrl(): string {
  return localStorage.getItem('collab_gas_url') || (import.meta as any).env?.VITE_GAS_URL || '';
}

export function saveGasUrl(url: string): void {
  localStorage.setItem('collab_gas_url', url);
}

// ==========================================
// PeerJS WebRTC P2P Layer
// ==========================================

export function initPeerConnection(
  sessionCode: string,
  isHost: boolean,
  onMessage: (msg: BroadcastMessage) => void
) {
  onPeerMessageCallback = onMessage;
  cleanupPeer();

  const peerId = PEER_PREFIX + sessionCode.toUpperCase();

  try {
    if (isHost) {
      // Host registers the fixed peer ID
      peerInstance = new Peer(peerId);

      peerInstance.on('connection', (conn) => {
        setupDataConnection(conn, true);
      });

      peerInstance.on('error', (err) => {
        console.warn('PeerJS Host Error:', err);
      });
    } else {
      // Guest creates random peer and connects to host peer ID
      peerInstance = new Peer();

      peerInstance.on('open', () => {
        if (peerInstance) {
          const conn = peerInstance.connect(peerId, { reliable: true });
          setupDataConnection(conn, false);
        }
      });

      peerInstance.on('error', (err) => {
        console.warn('PeerJS Guest Error:', err);
      });
    }
  } catch (err) {
    console.warn('Failed to start PeerJS:', err);
  }
}

function setupDataConnection(conn: DataConnection, isHost: boolean) {
  conn.on('open', () => {
    if (!peerConnections.includes(conn)) {
      peerConnections.push(conn);
    }

    // If we are host, immediately send current session state to the new connection
    if (isHost) {
      const activeSessionId = getActiveSession();
      if (activeSessionId) {
        const currentSession = getSessionLocal(activeSessionId);
        if (currentSession) {
          conn.send({
            type: 'session_state_sync',
            sessionId: activeSessionId,
            senderId: getLocalUserId(),
            payload: currentSession,
          } as BroadcastMessage);
        }
      }
    } else {
      // Ask host for full sync and identify this guest
      conn.send({
        type: 'request_sync',
        senderId: getLocalUserId(),
        payload: {
          id: getLocalUserId(),
          name: getLocalUserName(),
        },
      } as BroadcastMessage);
    }
  });

  conn.on('data', (data: any) => {
    const msg = data as BroadcastMessage;

    // Handle full state sync from Host
    if (msg.type === 'session_state_sync' && msg.payload) {
      const remoteSession = msg.payload as SessionData;
      saveSessionLocal(remoteSession);
      if (onPeerMessageCallback) onPeerMessageCallback(msg);
      return;
    }

    // Handle incoming actions
    if (msg.type === 'solution_update' && msg.payload && msg.sessionId) {
      updateSolutionLocal(msg.sessionId, msg.payload.userId, msg.payload.solution);
    } else if (msg.type === 'chat_message' && msg.payload && msg.sessionId) {
      addChatMessageLocal(msg.sessionId, msg.payload as ChatMessage);
    } else if (msg.type === 'user_joined' && msg.payload && msg.sessionId) {
      const sess = getSessionLocal(msg.sessionId);
      if (sess && !sess.users.find((u) => u.id === msg.payload.id)) {
        sess.users.push({ id: msg.payload.id, name: msg.payload.name, solution: '' });
        saveSessionLocal(sess);
      }
    } else if (msg.type === 'next_segment' && msg.payload && msg.sessionId) {
      saveAndResetLocal(msg.sessionId, msg.payload.newSegment);
    } else if (msg.type === 'request_sync' && isHost) {
      const activeId = getActiveSession();
      if (activeId) {
        const sess = getSessionLocal(activeId);
        if (sess) {
          const guestId = msg.payload?.id || msg.senderId;
          const guestName = msg.payload?.name || 'زميلك';
          if (guestId && !sess.users.find((u) => u.id === guestId)) {
            sess.users.push({ id: guestId, name: guestName, solution: '' });
            saveSessionLocal(sess);
          }
          conn.send({
            type: 'session_state_sync',
            sessionId: activeId,
            senderId: getLocalUserId(),
            payload: sess,
          });
        }
      }
    }

    if (onPeerMessageCallback) onPeerMessageCallback(msg);
  });

  conn.on('close', () => {
    peerConnections = peerConnections.filter((c) => c !== conn);
  });
}

export function sendPeerMessage(msg: BroadcastMessage) {
  for (const conn of peerConnections) {
    if (conn.open) {
      conn.send(msg);
    }
  }
}

export function cleanupPeer() {
  for (const conn of peerConnections) {
    try { conn.close(); } catch { /* ignore */ }
  }
  peerConnections = [];
  if (peerInstance) {
    try { peerInstance.destroy(); } catch { /* ignore */ }
    peerInstance = null;
  }
}

// ==========================================
// Session CRUD Operations
// ==========================================

export async function createSession(
  segment: string,
  userId: string,
  userName: string
): Promise<SessionData> {
  const code = generateSessionCode();
  const sessionId = isFirebaseReady() ? generateId() : 'p2p_' + code;

  const session: SessionData = {
    id: sessionId,
    code,
    segment,
    users: [{ id: userId, name: userName, solution: '' }],
    chat: [],
    history: [],
  };

  saveSessionLocal(session);
  saveActiveSession(sessionId);

  if (isFirebaseReady()) {
    const db = getDB()!;
    await set(ref(db, `sessions/${sessionId}`), {
      code,
      segment,
      createdAt: Date.now(),
      users: { [userId]: { name: userName, solution: '' } },
      chat: {},
      history: {},
    });
    await set(ref(db, `codes/${code}`), sessionId);
  }

  return session;
}

export async function joinSession(
  code: string,
  userId: string,
  userName: string
): Promise<SessionData | null> {
  const normalizedCode = code.toUpperCase().trim();

  // 1. Try Firebase first if connected
  if (isFirebaseReady()) {
    const db = getDB()!;
    const codeSnap = await get(ref(db, `codes/${normalizedCode}`));
    if (codeSnap.exists()) {
      const sessionId = codeSnap.val() as string;
      const sessionSnap = await get(ref(db, `sessions/${sessionId}`));
      if (sessionSnap.exists()) {
        const data = sessionSnap.val();
        const userCount = data.users ? Object.keys(data.users).length : 0;

        if (data.users && data.users[userId]) {
          const session = firebaseToSessionData(sessionId, data);
          saveSessionLocal(session);
          saveActiveSession(sessionId);
          return session;
        }

        if (userCount >= 2) return null;

        await update(ref(db, `sessions/${sessionId}/users/${userId}`), {
          name: userName,
          solution: '',
        });

        const updatedSnap = await get(ref(db, `sessions/${sessionId}`));
        if (updatedSnap.exists()) {
          const session = firebaseToSessionData(sessionId, updatedSnap.val());
          saveSessionLocal(session);
          saveActiveSession(sessionId);
          return session;
        }
      }
    }
  }

  // 2. Try P2P PeerJS connection / local storage
  const localSession = getSessionByCodeLocal(normalizedCode);
  if (localSession) {
    const user = localSession.users.find((u) => u.id === userId);
    if (!user) {
      if (localSession.users.length >= 2) return null;
      localSession.users.push({ id: userId, name: userName, solution: '' });
      saveSessionLocal(localSession);
    }
    saveActiveSession(localSession.id);
    return localSession;
  }

  // Even if not found locally, create a placeholder guest session and let PeerJS P2P fetch the real data!
  const placeholderSession: SessionData = {
    id: 'p2p_' + normalizedCode,
    code: normalizedCode,
    segment: 'جاري جلب البيانات من زميلك عبر P2P...',
    users: [{ id: userId, name: userName, solution: '' }],
    chat: [],
    history: [],
  };
  saveSessionLocal(placeholderSession);
  saveActiveSession(placeholderSession.id);
  return placeholderSession;
}

export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  if (isFirebaseReady() && !sessionId.startsWith('p2p_')) {
    const db = getDB()!;
    const snap = await get(ref(db, `sessions/${sessionId}`));
    if (snap.exists()) {
      const session = firebaseToSessionData(sessionId, snap.val());
      saveSessionLocal(session);
      return session;
    }
  }
  return getSessionLocal(sessionId);
}

export function subscribeToSession(
  sessionId: string,
  callback: (session: SessionData) => void
): () => void {
  if (isFirebaseReady() && !sessionId.startsWith('p2p_')) {
    const db = getDB()!;
    const sessionRef = ref(db, `sessions/${sessionId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const session = firebaseToSessionData(sessionId, snapshot.val());
        saveSessionLocal(session);
        callback(session);
      }
    });

    activeListeners.set(sessionId, unsubscribe);

    return () => {
      unsubscribe();
      activeListeners.delete(sessionId);
    };
  } else {
    // Local / P2P callback
    const interval = setInterval(() => {
      const session = getSessionLocal(sessionId);
      if (session) callback(session);
    }, 1000);

    const session = getSessionLocal(sessionId);
    if (session) callback(session);

    return () => clearInterval(interval);
  }
}

export async function updateSolution(
  sessionId: string,
  userId: string,
  solution: string
): Promise<void> {
  updateSolutionLocal(sessionId, userId, solution);

  sendPeerMessage({
    type: 'solution_update',
    sessionId,
    senderId: userId,
    payload: { userId, solution },
  });

  if (isFirebaseReady() && !sessionId.startsWith('p2p_')) {
    const db = getDB()!;
    await update(ref(db, `sessions/${sessionId}/users/${userId}`), {
      solution,
    });
  }
}

export async function addChatMessage(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  addChatMessageLocal(sessionId, message);

  sendPeerMessage({
    type: 'chat_message',
    sessionId,
    senderId: message.senderId,
    payload: message,
  });

  if (isFirebaseReady() && !sessionId.startsWith('p2p_')) {
    const db = getDB()!;
    await set(ref(db, `sessions/${sessionId}/chat/${message.id}`), {
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      image: message.image || null,
      timestamp: message.timestamp,
    });
  }
}

export async function saveAndReset(
  sessionId: string,
  newSegment: string
): Promise<SessionData | null> {
  const localUpdated = saveAndResetLocal(sessionId, newSegment);

  sendPeerMessage({
    type: 'next_segment',
    sessionId,
    senderId: getLocalUserId(),
    payload: { newSegment },
  });

  // Check if GAS URL is set and push to Google Sheets!
  const gasUrl = getGasUrl();
  if (gasUrl && localUpdated && localUpdated.history.length > 0) {
    const latestHistory = localUpdated.history[localUpdated.history.length - 1];
    try {
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveSegment',
          segment: latestHistory.segment,
          user1Name: latestHistory.user1Name,
          user2Name: latestHistory.user2Name,
          solution1: latestHistory.solution1,
          solution2: latestHistory.solution2,
          timestamp: latestHistory.timestamp,
        }),
      }).catch((e) => console.warn('GAS POST failed:', e));
    } catch {
      // ignore
    }
  }

  if (isFirebaseReady() && !sessionId.startsWith('p2p_')) {
    const db = getDB()!;
    const snap = await get(ref(db, `sessions/${sessionId}`));
    if (snap.exists()) {
      const data = snap.val();
      const userIds = data.users ? Object.keys(data.users) : [];
      const historyEntry: Record<string, any> = {
        segment: data.segment || '',
        timestamp: Date.now(),
        user1Name: '',
        user2Name: '',
        solution1: '',
        solution2: '',
      };

      if (userIds.length >= 1) {
        historyEntry.user1Name = data.users[userIds[0]]?.name || '';
        historyEntry.solution1 = data.users[userIds[0]]?.solution || '';
      }
      if (userIds.length >= 2) {
        historyEntry.user2Name = data.users[userIds[1]]?.name || '';
        historyEntry.solution2 = data.users[userIds[1]]?.solution || '';
      }

      await push(ref(db, `sessions/${sessionId}/history`), historyEntry);

      for (const uid of userIds) {
        await update(ref(db, `sessions/${sessionId}/users/${uid}`), {
          solution: '',
        });
      }

      await update(ref(db, `sessions/${sessionId}`), { segment: newSegment });
      await remove(ref(db, `sessions/${sessionId}/chat`));
    }
  }

  return localUpdated;
}

export function getOtherUser(
  session: SessionData,
  currentUserId: string
): User | null {
  return session.users.find((u) => u.id !== currentUserId) || null;
}

export function cleanupSession(sessionId: string): void {
  const unsub = activeListeners.get(sessionId);
  if (unsub) {
    unsub();
    activeListeners.delete(sessionId);
  }
  cleanupPeer();
}

export function cleanupOldSessions(): void {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SESSION_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '');
        const lastActivity =
          data.chat?.length > 0
            ? data.chat[data.chat.length - 1].timestamp
            : 0;
        if (lastActivity < oneDayAgo && data.history?.length > 0) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

// ==========================================
// Local Storage & Helper Functions
// ==========================================

function getSessionLocal(sessionId: string): SessionData | null {
  try {
    const data = localStorage.getItem(SESSION_PREFIX + sessionId);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveSessionLocal(session: SessionData): void {
  localStorage.setItem(SESSION_PREFIX + session.id, JSON.stringify(session));
  // Also save by code for easy lookup
  localStorage.setItem('code_map_' + session.code, session.id);
}

function getSessionByCodeLocal(code: string): SessionData | null {
  const mappedId = localStorage.getItem('code_map_' + code);
  if (mappedId) return getSessionLocal(mappedId);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SESSION_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '');
        if (data.code === code) return data;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function updateSolutionLocal(
  sessionId: string,
  userId: string,
  solution: string
): void {
  const session = getSessionLocal(sessionId);
  if (!session) return;

  const user = session.users.find((u) => u.id === userId);
  if (user) {
    user.solution = solution;
    saveSessionLocal(session);
  }
}

function addChatMessageLocal(sessionId: string, message: ChatMessage): void {
  const session = getSessionLocal(sessionId);
  if (!session) return;

  if (!session.chat.some((m) => m.id === message.id)) {
    session.chat.push(message);
    saveSessionLocal(session);
  }
}

function saveAndResetLocal(
  sessionId: string,
  newSegment: string
): SessionData | null {
  const session = getSessionLocal(sessionId);
  if (!session) return null;

  if (session.users.length >= 2) {
    session.history.push({
      segment: session.segment,
      timestamp: Date.now(),
      user1Name: session.users[0].name,
      user2Name: session.users[1]?.name || '',
      solution1: session.users[0].solution,
      solution2: session.users[1]?.solution || '',
    });
  }

  session.segment = newSegment;
  session.users = session.users.map((u) => ({ ...u, solution: '' }));
  session.chat = [];
  saveSessionLocal(session);
  return session;
}

function firebaseToSessionData(sessionId: string, data: any): SessionData {
  const users: User[] = [];
  const chat: ChatMessage[] = [];
  const history: any[] = [];

  if (data.users) {
    for (const [uid, udata] of Object.entries(data.users) as [string, any][]) {
      users.push({
        id: uid,
        name: udata.name || '',
        solution: udata.solution || '',
      });
    }
  }

  if (data.chat) {
    for (const [mid, mdata] of Object.entries(data.chat) as [string, any][]) {
      chat.push({
        id: mid,
        senderId: mdata.senderId || '',
        senderName: mdata.senderName || '',
        content: mdata.content || '',
        timestamp: mdata.timestamp || 0,
        image: mdata.image || undefined,
      });
    }
    chat.sort((a, b) => a.timestamp - b.timestamp);
  }

  if (data.history) {
    for (const hdata of Object.values(data.history) as any[]) {
      history.push({
        segment: hdata.segment || '',
        timestamp: hdata.timestamp || 0,
        user1Name: hdata.user1Name || '',
        user2Name: hdata.user2Name || '',
        solution1: hdata.solution1 || '',
        solution2: hdata.solution2 || '',
      });
    }
    history.sort((a, b) => a.timestamp - b.timestamp);
  }

  return {
    id: sessionId,
    code: data.code || '',
    segment: data.segment || '',
    users,
    chat,
    history,
  };
}

// Local Cross-Tab channel compatibility
export function initLocalChannel(callback: (data: BroadcastMessage) => void) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e) => callback(e.data);
  } catch { /* ignore */ }
}

export function closeLocalChannel() {
  if (channel) channel.close();
}
