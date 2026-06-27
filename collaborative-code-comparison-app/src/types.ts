// TypeScript type definitions for the Collaborative Comparison App

export interface User {
  id: string;
  name: string;
  solution: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  image?: string; // Base64 encoded image
}

export interface SessionData {
  id: string;
  code: string; // Short 6-char code for sharing
  segment: string;
  users: User[];
  chat: ChatMessage[];
  history: SessionHistory[];
}

export interface SessionHistory {
  segment: string;
  timestamp: number;
  user1Name: string;
  user2Name: string;
  solution1: string;
  solution2: string;
}

export interface CharDiff {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed' | 'modified';
  line1?: string;
  line2?: string;
  charDiffs?: CharDiff[];
}

export interface ComparisonResult {
  matchPercentage: number;
  totalLines: number;
  matchedLines: number;
  differentLines: number;
  diffLines: DiffLine[];
  matchedContent: string[];
  differentContent: DiffLine[];
}

export type AppView = 'login' | 'board';

export type DiffTab = 'all' | 'matched' | 'different';

// Sync & Broadcast message types
export type BroadcastType = 
  | 'session_state_sync'
  | 'solution_update'
  | 'chat_message'
  | 'user_joined'
  | 'next_segment'
  | 'request_sync';

export interface BroadcastMessage {
  type: BroadcastType;
  sessionId?: string;
  senderId: string;
  payload?: any;
}

export interface AppSettings {
  gasUrl: string;
  firebaseApiKey?: string;
  firebaseDatabaseUrl?: string;
}
