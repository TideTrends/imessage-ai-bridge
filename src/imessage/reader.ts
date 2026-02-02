import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHAT_DB_PATH = path.join(os.homedir(), 'Library/Messages/chat.db');
const PROJECT_ROOT = path.join(os.homedir(), 'imessage-ai-bridge');
const LAST_MESSAGE_ID_FILE = path.join(PROJECT_ROOT, 'state', 'last-message-id.txt');

// Load target phone from config
function getTargetPhone(): string {
  const configPath = path.join(PROJECT_ROOT, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.targetPhone || '';
    } catch {}
  }
  return '';
}

export interface Attachment {
  filename: string;
  filepath: string;
  mimeType: string;
}

export interface Message {
  rowid: number;
  text: string;
  date: number;
  isFromMe: boolean;
  attachments: Attachment[];
}

export function getLastMessageId(): number {
  try {
    if (fs.existsSync(LAST_MESSAGE_ID_FILE)) {
      const content = fs.readFileSync(LAST_MESSAGE_ID_FILE, 'utf-8').trim();
      return parseInt(content, 10) || 0;
    }
  } catch (error) {
    console.error('Error reading last message ID:', error);
  }
  return 0;
}

export function saveLastMessageId(rowid: number): void {
  try {
    const dir = path.dirname(LAST_MESSAGE_ID_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LAST_MESSAGE_ID_FILE, rowid.toString(), 'utf-8');
  } catch (error) {
    console.error('Error saving last message ID:', error);
  }
}

function getAttachments(db: Database.Database, messageRowId: number): Attachment[] {
  try {
    const query = `
      SELECT 
        a.filename,
        a.mime_type as mimeType
      FROM attachment a
      JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
      WHERE maj.message_id = ?
    `;
    
    const rows = db.prepare(query).all(messageRowId) as { filename: string; mimeType: string }[];
    
    return rows
      .filter(row => row.filename && row.mimeType?.startsWith('image/'))
      .map(row => {
        let filepath = row.filename;
        if (filepath.startsWith('~')) {
          filepath = filepath.replace('~', os.homedir());
        }
        return {
          filename: path.basename(row.filename),
          filepath,
          mimeType: row.mimeType,
        };
      })
      .filter(att => fs.existsSync(att.filepath));
  } catch (error) {
    console.error('Error getting attachments:', error);
    return [];
  }
}

export function getNewMessages(sinceRowId: number = 0): Message[] {
  const targetPhone = getTargetPhone();
  if (!targetPhone) return [];
  
  let db: Database.Database | null = null;
  
  try {
    db = new Database(CHAT_DB_PATH, { readonly: true, fileMustExist: true });
    
    const query = `
      SELECT 
        m.ROWID as rowid,
        m.text,
        m.date,
        m.is_from_me as isFromMe,
        m.cache_has_attachments as hasAttachments
      FROM message m
      JOIN handle h ON m.handle_id = h.ROWID
      WHERE h.id LIKE ?
        AND m.is_from_me = 0
        AND m.ROWID > ?
        AND (m.text IS NOT NULL OR m.cache_has_attachments = 1)
      ORDER BY m.ROWID ASC
    `;
    
    const phonePattern = `%${targetPhone}%`;
    const rows = db.prepare(query).all(phonePattern, sinceRowId) as {
      rowid: number;
      text: string | null;
      date: number;
      isFromMe: boolean;
      hasAttachments: number;
    }[];
    
    return rows.map(row => ({
      rowid: row.rowid,
      text: row.text || '',
      date: row.date,
      isFromMe: row.isFromMe,
      attachments: row.hasAttachments ? getAttachments(db!, row.rowid) : [],
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'SQLITE_BUSY') {
      console.log('Database is locked, will retry...');
      return [];
    }
    throw error;
  } finally {
    if (db) db.close();
  }
}

export function initializeMessageReader(): number {
  const targetPhone = getTargetPhone();
  if (!targetPhone) return 0;
  
  let db: Database.Database | null = null;
  
  try {
    db = new Database(CHAT_DB_PATH, { readonly: true, fileMustExist: true });
    
    const query = `
      SELECT MAX(m.ROWID) as maxRowId
      FROM message m
      JOIN handle h ON m.handle_id = h.ROWID
      WHERE h.id LIKE ?
    `;
    
    const phonePattern = `%${targetPhone}%`;
    const result = db.prepare(query).get(phonePattern) as { maxRowId: number | null };
    
    return result?.maxRowId || 0;
  } catch (error) {
    console.error('Error initializing message reader:', error);
    return 0;
  } finally {
    if (db) db.close();
  }
}
