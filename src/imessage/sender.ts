import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Load target phone from config
function getTargetPhone(): string {
  const configPath = path.join(os.homedir(), 'imessage-ai-bridge', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.targetPhoneFull || '';
    } catch {}
  }
  return '';
}

// Track messages we've sent - use a longer-lived set with timestamps
const sentMessages = new Map<string, number>();
const SENT_MESSAGE_TTL = 30000; // 30 seconds

// Also track specific patterns that are always from us
const OUR_PATTERNS = [
  /^Sorry, couldn't complete request/,
  /^Sorry, try again/,
  /^\[.+\] Session expired/,
  /^All conversations have been reset/,
  /^iMessage AI Bridge running/,
  /^Test Summary:/,
  /^\[.+ Test\]/,
];

export function wasSentByUs(text: string): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  
  // Check if matches our known patterns
  for (const pattern of OUR_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check tracked messages
  const now = Date.now();
  
  // Clean old entries
  for (const [msg, time] of sentMessages.entries()) {
    if (now - time > SENT_MESSAGE_TTL) {
      sentMessages.delete(msg);
    }
  }
  
  if (sentMessages.has(trimmed)) {
    sentMessages.delete(trimmed);
    return true;
  }
  
  return false;
}

function escapeForAppleScript(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function sendMessage(text: string, phone?: string): void {
  const targetPhone = phone || getTargetPhone();
  if (!targetPhone) {
    console.error('[iMessage] No target phone configured');
    return;
  }
  
  const escapedText = escapeForAppleScript(text);
  
  // Track this message
  sentMessages.set(text.trim(), Date.now());
  
  const script = `
tell application "Messages"
  set targetBuddy to "${targetPhone}"
  set targetService to id of 1st account whose service type = iMessage
  set theBuddy to participant targetBuddy of account id targetService
  send "${escapedText}" to theBuddy
end tell
`;

  try {
    const bashSafeScript = script.replace(/'/g, "'\"'\"'");
    execSync(`osascript -e '${bashSafeScript}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`[iMessage] Sent message to ${targetPhone}`);
  } catch (error) {
    console.error('[iMessage] Failed to send message:', error);
    sentMessages.delete(text.trim());
    throw error;
  }
}

export function sendErrorMessage(errorCode?: string | number): void {
  const message = errorCode
    ? `Sorry, couldn't complete request. Error: ${errorCode}`
    : 'Sorry, try again.';
  
  sendMessage(message);
}
