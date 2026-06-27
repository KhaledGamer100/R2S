// Firebase Configuration
// Automatically checks import.meta.env or settings stored in localStorage

import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

let app: FirebaseApp | null = null;
let database: Database | null = null;

export function getCustomFirebaseConfig() {
  try {
    const saved = localStorage.getItem('collab_custom_firebase');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return null;
}

export function saveCustomFirebaseConfig(config: { apiKey: string; databaseURL: string; projectId?: string }) {
  localStorage.setItem('collab_custom_firebase', JSON.stringify(config));
  // Re-init
  initFirebase(true);
}

/**
 * Initialize Firebase
 */
export function initFirebase(forceReinit = false): Database | null {
  try {
    if (database && !forceReinit) return database;

    const custom = getCustomFirebaseConfig();
    const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;
    const envDbUrl = (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL;

    const apiKey = custom?.apiKey || envApiKey;
    const databaseURL = custom?.databaseURL || envDbUrl;

    if (!apiKey || !databaseURL || apiKey.includes("PLACEHOLDER")) {
      console.log(
        "%c🌐 No Firebase config found. Using PeerJS (WebRTC P2P) real-time cloud + localStorage fallback.",
        "color: #3b82f6; font-size: 13px; font-weight: bold;"
      );
      database = null;
      return null;
    }

    const firebaseConfig = {
      apiKey,
      authDomain: custom?.projectId ? `${custom.projectId}.firebaseapp.com` : "collab-app.firebaseapp.com",
      databaseURL,
      projectId: custom?.projectId || "collab-app",
      storageBucket: custom?.projectId ? `${custom.projectId}.appspot.com` : "collab-app.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };

    if (getApps().length === 0 || forceReinit) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    database = getDatabase(app);
    console.log(
      "%c✅ Firebase connected successfully!",
      "color: #10b981; font-size: 14px; font-weight: bold;"
    );
    return database;
  } catch (error) {
    console.warn("Firebase init failed, falling back to P2P PeerJS:", error);
    database = null;
    return null;
  }
}

export function getDB(): Database | null {
  return database;
}

export function isFirebaseReady(): boolean {
  return database !== null;
}
