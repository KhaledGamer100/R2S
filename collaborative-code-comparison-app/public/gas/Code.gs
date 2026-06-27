/**
 * Code.gs - Google Apps Script Backend
 * Collaborative Code & Solution Comparison App
 * 
 * This file contains all server-side logic for the GAS deployment.
 * It uses Google Sheets as the database for persistence.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Open Apps Script editor (Extensions > Apps Script)
 * 3. Paste this code into Code.gs
 * 4. Paste the frontend HTML into Index.html
 * 5. Deploy as Web App (Execute as: Me, Access: Anyone)
 * 6. Share the Web App URL with both users
 */

// ==========================================
// Configuration
// ==========================================

const SPREADSHEET_ID = ''; // Leave empty to auto-create, or paste your Sheet ID
const SHEET_NAME = 'Sessions';
const CHAT_SHEET_NAME = 'Chat';
const HISTORY_SHEET_NAME = 'History';

// ==========================================
// Initialization
// ==========================================

/**
 * Get or create the spreadsheet and sheets
 */
function getOrCreateSpreadsheet() {
  let ss;
  
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    const files = DriveApp.getFilesByName('Collaborative Comparison App');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create('Collaborative Comparison App');
    }
  }
  
  // Ensure sheets exist with proper headers
  ensureSheet(ss, SHEET_NAME, [
    'Session ID', 'Code', 'Segment', 'User 1 ID', 'User 1 Name', 
    'User 1 Solution', 'User 2 ID', 'User 2 Name', 'User 2 Solution', 
    'Created At', 'Updated At'
  ]);
  
  ensureSheet(ss, CHAT_SHEET_NAME, [
    'Session ID', 'Message ID', 'Sender ID', 'Sender Name', 
    'Content', 'Image Base64', 'Timestamp'
  ]);
  
  ensureSheet(ss, HISTORY_SHEET_NAME, [
    'Timestamp', 'Session ID', 'Segment', 'User 1 Name', 
    'User 2 Name', 'Solution 1', 'Solution 2', 'Chat Summary'
  ]);
  
  return ss;
}

/**
 * Ensure a sheet exists with the given headers
 */
function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#06b6d4');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// ==========================================
// Web App Entry Point
// ==========================================

/**
 * Serve the HTML frontend
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('مقارنة الحلول | Collaborative Solution Comparison')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ==========================================
// Session Management
// ==========================================

/**
 * Create a new session
 * @param {string} segment - The segment name
 * @param {string} userId - The creator's user ID
 * @param {string} userName - The creator's name
 * @returns {Object} The created session data
 */
function createSession(segment, userId, userName) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const sessionId = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  const code = generateSessionCode();
  const now = new Date();
  
  sheet.appendRow([
    sessionId, code, segment,
    userId, userName, '',
    '', '', '',
    now, now
  ]);
  
  return {
    id: sessionId,
    code: code,
    segment: segment,
    users: [{ id: userId, name: userName, solution: '' }],
    chat: [],
    history: []
  };
}

/**
 * Join an existing session by code
 * @param {string} code - The 6-character session code
 * @param {string} userId - The joining user's ID
 * @param {string} userName - The joining user's name
 * @returns {Object|null} The session data or null if not found
 */
function joinSession(code, userId, userName) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // Find session by code (column index 1)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === code.toUpperCase()) {
      const sessionId = data[i][0];
      
      // Check if user is already in session
      if (data[i][3] === userId || data[i][6] === userId) {
        return getSessionData(sessionId);
      }
      
      // Check if there's room for a second user
      if (!data[i][6]) {
        // Add as second user
        sheet.getRange(i + 1, 7).setValue(userId);    // User 2 ID
        sheet.getRange(i + 1, 8).setValue(userName);   // User 2 Name
        sheet.getRange(i + 1, 11).setValue(new Date()); // Updated At
        
        return getSessionData(sessionId);
      }
      
      // Session is full
      return null;
    }
  }
  
  return null;
}

/**
 * Get full session data including chat
 * @param {string} sessionId - The session ID
 * @returns {Object|null} The session data
 */
function getSessionData(sessionId) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  let sessionRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      sessionRow = i;
      break;
    }
  }
  
  if (sessionRow === -1) return null;
  
  const row = data[sessionRow];
  
  const users = [];
  users.push({ id: row[3], name: row[4], solution: row[5] || '' });
  if (row[6]) {
    users.push({ id: row[6], name: row[7], solution: row[8] || '' });
  }
  
  // Get chat messages
  const chatSheet = ss.getSheetByName(CHAT_SHEET_NAME);
  const chatData = chatSheet.getDataRange().getValues();
  const chat = [];
  
  for (let i = 1; i < chatData.length; i++) {
    if (chatData[i][0] === sessionId) {
      chat.push({
        id: chatData[i][1],
        senderId: chatData[i][2],
        senderName: chatData[i][3],
        content: chatData[i][4],
        image: chatData[i][5] || null,
        timestamp: new Date(chatData[i][6]).getTime()
      });
    }
  }
  
  // Get history
  const historySheet = ss.getSheetByName(HISTORY_SHEET_NAME);
  const historyData = historySheet.getDataRange().getValues();
  const history = [];
  
  for (let i = 1; i < historyData.length; i++) {
    if (historyData[i][1] === sessionId) {
      history.push({
        segment: historyData[i][2],
        timestamp: new Date(historyData[i][0]).getTime(),
        user1Name: historyData[i][3],
        user2Name: historyData[i][4],
        solution1: historyData[i][5],
        solution2: historyData[i][6]
      });
    }
  }
  
  return {
    id: row[0],
    code: row[1],
    segment: row[2],
    users: users,
    chat: chat,
    history: history
  };
}

// ==========================================
// Solution & Chat Operations
// ==========================================

/**
 * Update a user's solution
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user's ID
 * @param {string} solution - The solution text
 */
function updateSolution(sessionId, userId, solution) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      if (data[i][3] === userId) {
        sheet.getRange(i + 1, 6).setValue(solution); // User 1 Solution
      } else if (data[i][6] === userId) {
        sheet.getRange(i + 1, 9).setValue(solution); // User 2 Solution
      }
      sheet.getRange(i + 1, 11).setValue(new Date()); // Updated At
      break;
    }
  }
}

/**
 * Add a chat message
 * @param {string} sessionId - The session ID
 * @param {Object} message - The message object
 */
function addChatMessage(sessionId, message) {
  const ss = getOrCreateSpreadsheet();
  const chatSheet = ss.getSheetByName(CHAT_SHEET_NAME);
  
  chatSheet.appendRow([
    sessionId,
    message.id,
    message.senderId,
    message.senderName,
    message.content,
    message.image || '',
    new Date(message.timestamp)
  ]);
}

/**
 * Save current state to history and reset for next segment
 * @param {string} sessionId - The session ID
 * @param {string} newSegment - The new segment name
 * @returns {Object|null} The updated session data
 */
function saveAndReset(sessionId, newSegment) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      // Save to history
      const historySheet = ss.getSheetByName(HISTORY_SHEET_NAME);
      historySheet.appendRow([
        new Date(),
        sessionId,
        data[i][2], // segment
        data[i][4], // user1 name
        data[i][7], // user2 name
        data[i][5], // solution1
        data[i][8], // solution2
        '' // chat summary
      ]);
      
      // Reset solutions and segment
      sheet.getRange(i + 1, 3).setValue(newSegment); // Segment
      sheet.getRange(i + 1, 6).setValue(''); // User 1 Solution
      sheet.getRange(i + 1, 9).setValue(''); // User 2 Solution
      sheet.getRange(i + 1, 11).setValue(new Date()); // Updated At
      
      // Clear chat for this session
      const chatSheet = ss.getSheetByName(CHAT_SHEET_NAME);
      const chatData = chatSheet.getDataRange().getValues();
      // Delete chat rows for this session (in reverse to maintain indices)
      for (let j = chatData.length - 1; j >= 1; j--) {
        if (chatData[j][0] === sessionId) {
          chatSheet.deleteRow(j + 1);
        }
      }
      
      return getSessionData(sessionId);
    }
  }
  
  return null;
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generate a 6-character session code
 */
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Upload an image to Google Drive and return the URL
 * @param {string} base64Data - The base64 encoded image
 * @param {string} fileName - The file name
 * @returns {string} The public URL of the uploaded image
 */
function uploadImageToDrive(base64Data, fileName) {
  try {
    const decoded = Utilities.base64Decode(base64Data.split(',')[1]);
    const mimeType = base64Data.split(';')[0].split(':')[1];
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) {
    console.error('Image upload failed: ' + e.message);
    return '';
  }
}

/**
 * Run on install/setup to initialize the spreadsheet
 */
function onInstall() {
  getOrCreateSpreadsheet();
}

/**
 * Run this function once to set up the spreadsheet
 */
function setup() {
  const ss = getOrCreateSpreadsheet();
  Logger.log('Spreadsheet created/found: ' + ss.getUrl());
  Logger.log('Setup complete!');
}
