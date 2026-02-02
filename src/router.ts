import { AIType, DEFAULT_AI } from './config';

export type ModelTier = 'fast' | 'thinking' | 'max';

export interface ParsedMessage {
  ai: AIType;
  message: string;
  startNewChat: boolean;
  modelTier: ModelTier;
}

/**
 * Parse an incoming message to determine:
 * - Which AI to route to (chatgpt, grok, or gemini default)
 * - Whether to start new chat (leading newline)
 * - Which model tier to use (. = thinking, .. = max, default = fast)
 */
export function parseMessage(text: string): ParsedMessage {
  // Check if message starts with newline (user pressed enter first)
  const startNewChat = text.startsWith('\n') || text.startsWith('\r');
  
  let trimmed = text.trim();
  
  // Check for model tier prefixes
  let modelTier: ModelTier = 'fast';
  if (trimmed.startsWith('..')) {
    modelTier = 'max';
    trimmed = trimmed.slice(2).trim();
  } else if (trimmed.startsWith('.')) {
    modelTier = 'thinking';
    trimmed = trimmed.slice(1).trim();
  }
  
  const lower = trimmed.toLowerCase();
  
  // Check for ChatGPT prefix
  if (lower.startsWith('chatgpt ')) {
    return {
      ai: 'chatgpt',
      message: trimmed.slice(8).trim(),
      startNewChat,
      modelTier,
    };
  }
  
  // Check for Grok prefix
  if (lower.startsWith('grok ')) {
    return {
      ai: 'grok',
      message: trimmed.slice(5).trim(),
      startNewChat,
      modelTier,
    };
  }
  
  // Check for explicit Gemini prefix
  if (lower.startsWith('gemini ')) {
    return {
      ai: 'gemini',
      message: trimmed.slice(7).trim(),
      startNewChat,
      modelTier,
    };
  }
  
  // Default to Gemini
  return {
    ai: DEFAULT_AI,
    message: trimmed,
    startNewChat,
    modelTier,
  };
}

/**
 * Check if a message is a special command
 */
export function isCommand(text: string): { isCommand: boolean; command?: string } {
  const trimmed = text.trim().toLowerCase();
  
  if (trimmed === 'reset' || trimmed === 'clear') {
    return { isCommand: true, command: 'reset' };
  }
  
  if (trimmed === 'status') {
    return { isCommand: true, command: 'status' };
  }
  
  return { isCommand: false };
}
