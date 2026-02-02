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

// Track messages we've sent to avoid processing them as incoming
const sentMessages = new Set<string>();

export function wasSentByUs(text: string): boolean {
  const trimmed = text.trim();
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
  
  sentMessages.add(text.trim());
  
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
