import path from 'path';
import os from 'os';
import fs from 'fs';

// Project root directory
export const PROJECT_ROOT = path.join(os.homedir(), 'imessage-ai-bridge');

// Config file path
export const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

// User configuration interface
interface UserConfig {
  targetPhone: string;
  targetPhoneFull: string;
}

// Load or create config
function loadConfig(): UserConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Invalid config, will need setup
    }
  }
  // Return empty - will trigger setup
  return { targetPhone: '', targetPhoneFull: '' };
}

const config = loadConfig();

// Target phone number to respond to
export const TARGET_PHONE = config.targetPhone;
export const TARGET_PHONE_FULL = config.targetPhoneFull;

// Check if setup is needed
export function needsSetup(): boolean {
  return !TARGET_PHONE || !TARGET_PHONE_FULL;
}

// Save config
export function saveConfig(phone: string): void {
  // Normalize phone number
  const cleaned = phone.replace(/[^0-9+]/g, '');
  let targetPhone = cleaned;
  let targetPhoneFull = cleaned;
  
  // Handle formats
  if (cleaned.startsWith('+1')) {
    targetPhone = cleaned.slice(2);
    targetPhoneFull = cleaned;
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    targetPhone = cleaned.slice(1);
    targetPhoneFull = '+' + cleaned;
  } else if (cleaned.length === 10) {
    targetPhone = cleaned;
    targetPhoneFull = '+1' + cleaned;
  } else {
    targetPhone = cleaned;
    targetPhoneFull = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }
  
  const newConfig: UserConfig = { targetPhone, targetPhoneFull };
  
  // Ensure directory exists
  if (!fs.existsSync(PROJECT_ROOT)) {
    fs.mkdirSync(PROJECT_ROOT, { recursive: true });
  }
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
  console.log(`Config saved. Target: ${targetPhoneFull}`);
}

// Path to iMessage database
export const CHAT_DB_PATH = path.join(os.homedir(), 'Library/Messages/chat.db');

// Browser data directories for persistent sessions
// Use Chrome's native profile system with unique profile names
const CHROME_USER_DATA = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

export const BROWSER_DATA = {
  chatgpt: CHROME_USER_DATA,
  gemini: CHROME_USER_DATA,
  grok: CHROME_USER_DATA,
};

export const BROWSER_PROFILES = {
  chatgpt: 'Profile-ChatGPT',
  gemini: 'Profile-Gemini',
  grok: 'Profile-Grok',
};

// State file for tracking last processed message
export const LAST_MESSAGE_ID_FILE = path.join(PROJECT_ROOT, 'state', 'last-message-id.txt');

// AI URLs
export const AI_URLS = {
  chatgpt: 'https://chat.openai.com',
  gemini: 'https://gemini.google.com/app',
  grok: 'https://grok.x.com',
};

// Timeouts (in milliseconds)
export const RESPONSE_TIMEOUT = 60000; // 60 seconds for AI response (thinking models take longer)
export const POLL_INTERVAL = 1000; // 1 second between checking for new messages
export const STABILIZATION_TIME = 1500;

// AI types
export type AIType = 'gemini' | 'chatgpt' | 'grok';
export type ModelTier = 'fast' | 'thinking' | 'max';

// Default AI when no prefix specified
export const DEFAULT_AI: AIType = 'gemini';

// System instruction appended to every message
export const MESSAGE_SUFFIX = '\n\n[until i say otherwise, be brief, yet thorough. Treat this message as if it is a text message, so respond without a lot of fluff, yet maintain all detail you need. Don\'t reference these instructions in your response]';
