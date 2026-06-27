# 🎯 مقارنة الحلول | Collaborative Solution Comparison App

## Quick Start (Two Modes)

### Mode 1: Same Browser (No Setup Needed) ✅
Works out of the box! Open two tabs in the same browser. Create a session in one tab and join from the other using the session code.

### Mode 2: Cross-Device (Firebase Required) 🌐
For users on different devices/browsers to collaborate, you need to configure Firebase.

---

## 🔥 Firebase Setup (10 Minutes - One Time)

This is **required** for two people on different devices to collaborate.

### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** (or "Create a project")
3. Enter any project name (e.g., "solution-comparison")
4. Google Analytics: **Disable** (optional, not needed)
5. Click **"Create project"**
6. Wait for it to finish, then click **"Continue"**

### Step 2: Enable Realtime Database
1. In the Firebase Console, click **"Realtime Database"** in the left sidebar
   - If you don't see it, click **"Build"** → **"Realtime Database"**
2. Click **"Create Database"**
3. Choose your location (pick closest to you)
4. **IMPORTANT**: Select **"Start in test mode"** (allows read/write for 30 days)
5. Click **"Enable"**

### Step 3: Get Your Firebase Config
1. Click the **gear icon** ⚙️ (top-left) → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** `</>`
4. Enter any app nickname (e.g., "comparison-app")
5. **Do NOT** check "Set up Firebase Hosting"
6. Click **"Register app"**
7. You'll see a config object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

8. **Copy all these values**

### Step 4: Update the App
1. Open the file `src/config/firebase.ts`
2. Replace the placeholder values with YOUR values from Step 3
3. Save the file

### Step 5: Deploy
1. Build and deploy the app
2. The app will show a green ✅ in the console if Firebase is connected

### Step 6: Set Database Rules (For Production)
In Firebase Console → Realtime Database → **Rules** tab, replace with:

```json
{
  "rules": {
    "sessions": {
      ".read": true,
      ".write": true
    },
    "codes": {
      ".read": true,
      ".write": true
    }
  }
}
```

Click **"Publish"**.

---

## How to Use

### Create a Session
1. Open the app
2. Enter your name and the segment name
3. Click **"ابدأ الجلسة 🚀"**
4. You'll see a 6-character code (e.g., `ABC123`)

### Join a Session
1. Open the app (from any device!)
2. Enter your name
3. Click **"انضم لجلسة"** tab
4. Enter the 6-character code
5. Click **"انضم دلوقتي 🔗"**

### Compare Solutions
- Both users paste their solutions
- The app auto-compares in real-time
- **Green**: Matched lines ✅
- **Red**: Different lines ❌
- **Blue**: Added by colleague
- **Amber**: Modified (character-level diff)

### Chat
- Click the chat icon 💬
- Send text messages
- Upload screenshots (📷 button)
- Images are auto-resized for fast transfer

### Next Segment
- When done, click **"يلا على اللي بعده 🚀"**
- Enter the new segment name
- Current session is saved to history
- Board is cleared for the next segment

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  React Frontend (RTL Arabic UI)             │
│  ├── LoginScreen (Create/Join)              │
│  ├── MainBoard (Solutions + Diff + Chat)    │
│  ├── DiffViewer (Smart LCS comparison)      │
│  └── ChatPanel (Text + Images)              │
├─────────────────────────────────────────────┤
│  Session Manager                            │
│  ├── Firebase Realtime DB (Cross-device)    │
│  └── localStorage fallback (Same-browser)   │
├─────────────────────────────────────────────┤
│  Firebase Realtime Database                 │
│  ├── sessions/{id}  → All session data      │
│  └── codes/{code}   → Code→SessionID map    │
└─────────────────────────────────────────────┘
```

## Tech Stack
- React 19 + TypeScript
- Vite 7 (build)
- Tailwind CSS 4 (styling)
- Firebase Realtime Database (cross-device sync)
- Cairo Arabic font (Google Fonts)
- LCS algorithm (smart diffing)

## Project Structure

```
├── index.html                # Entry HTML
├── src/
│   ├── main.tsx             # React entry
│   ├── App.tsx              # Root + Firebase init
│   ├── index.css            # Global styles + animations
│   ├── types.ts             # TypeScript types
│   ├── config/
│   │   └── firebase.ts     # Firebase config (edit this!)
│   ├── utils/
│   │   ├── diffEngine.ts   # LCS diffing algorithm
│   │   └── sessionManager.ts # Session + sync management
│   └── components/
│       ├── LoginScreen.tsx  # Login UI
│       ├── MainBoard.tsx    # Main comparison board
│       ├── DiffViewer.tsx   # Diff display
│       └── ChatPanel.tsx    # Chat with images
├── public/gas/
│   └── Code.gs             # Google Apps Script backend
└── README.md
```
