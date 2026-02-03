import * as readline from 'readline';
import { AIType, POLL_INTERVAL, RESPONSE_TIMEOUT, needsSetup, saveConfig, CONFIG_FILE, MESSAGE_PREFIX } from './config';
import fs from 'fs';
import {
  getNewMessages,
  getLastMessageId,
  saveLastMessageId,
  initializeMessageReader,
  Message,
} from './imessage/reader';
import { sendMessage, sendErrorMessage, wasSentByUs } from './imessage/sender';
import { parseMessage, isCommand, ModelTier } from './router';
import { BaseAI, AIError } from './ai/base';
import { GeminiAI } from './ai/gemini';
import { ChatGPTAI } from './ai/chatgpt';
import { GrokAI } from './ai/grok';

// AI instances
const aiInstances: Record<AIType, BaseAI> = {
  gemini: new GeminiAI(),
  chatgpt: new ChatGPTAI(),
  grok: new GrokAI(),
};

const skippedAIs: Record<AIType, boolean> = {
  gemini: false,
  chatgpt: false,
  grok: false,
};

const prefixSent: Record<AIType, boolean> = {
  gemini: false,
  chatgpt: false,
  grok: false,
};

let lastAIUsed: AIType | null = null;

// Message queue for sequential processing
const messageQueue: Message[] = [];
let isProcessing = false;

/**
 * Prompt user for setup
 */
async function runSetup(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║          FIRST TIME SETUP              ║');
  console.log('╚════════════════════════════════════════╝\n');

  const phone = await new Promise<string>((resolve) => {
    rl.question('Enter your phone number or email for iMessage:\n> ', (answer) => {
      resolve(answer.trim());
    });
  });

  rl.close();
  saveConfig(phone);
  console.log('\nSetup complete! Restart the app to begin.\n');
  process.exit(0);
}

async function waitForLoginOrSkip(name: AIType, ai: BaseAI): Promise<boolean> {
  console.log(`[${name}] Not logged in. Please log in via the browser window.`);
  console.log(`[${name}] Press 's' + Enter to skip this AI\n`);
  
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    let resolved = false;
    
    const checkLogin = async () => {
      if (resolved) return;
      
      if (await ai.isLoggedIn()) {
        resolved = true;
        rl.close();
        console.log(`[${name}] Login detected!`);
        resolve(true);
        return;
      }
      
      setTimeout(checkLogin, 2000);
    };
    
    rl.on('line', (input) => {
      if (resolved) return;
      
      if (input.trim().toLowerCase() === 's') {
        resolved = true;
        rl.close();
        console.log(`[${name}] Skipped - this AI will not be available\n`);
        resolve(false);
      }
    });
    
    checkLogin();
  });
}

async function initializeAIs(): Promise<void> {
  console.log('\n=== Initializing AI Browsers ===\n');

  await Promise.all([
    aiInstances.gemini.initialize(),
    aiInstances.chatgpt.initialize(),
    aiInstances.grok.initialize(),
  ]);

  console.log('\n=== Checking Login Status ===\n');

  for (const [name, ai] of Object.entries(aiInstances)) {
    const aiName = name as AIType;
    await new Promise(r => setTimeout(r, 2000));
    const loggedIn = await ai.isLoggedIn();
    
    if (!loggedIn) {
      const didLogin = await waitForLoginOrSkip(aiName, ai);
      if (!didLogin) {
        skippedAIs[aiName] = true;
        await ai.cleanup();
      }
    } else {
      console.log(`[${name}] Already logged in!`);
    }
  }

  const activeAIs = Object.entries(skippedAIs)
    .filter(([_, skipped]) => !skipped)
    .map(([name]) => name);
  
  if (activeAIs.length === 0) {
    console.log('\n[Error] No AIs configured! At least one AI must be logged in.\n');
    process.exit(1);
  }

  console.log(`\n=== Ready! Active AIs: ${activeAIs.join(', ')} ===\n`);
}

/**
 * Process a single message immediately
 */
async function processMessage(msg: Message): Promise<void> {
  const text = msg.text;
  const images = msg.attachments.map(a => a.filepath);
  
  console.log(`\n[Incoming] "${text?.substring(0, 40) || '(image)'}..."${images.length ? ` +${images.length} image(s)` : ''}`);

  // Check for commands
  if (text && !images.length) {
    const { isCommand: isCmd, command } = isCommand(text);
    if (isCmd) {
      if (command === 'reset') {
        console.log('[Command] Resetting all conversations...');
        const resetPromises = [];
        if (!skippedAIs.gemini) resetPromises.push(aiInstances.gemini.startNewConversation());
        if (!skippedAIs.chatgpt) resetPromises.push(aiInstances.chatgpt.startNewConversation());
        if (!skippedAIs.grok) resetPromises.push(aiInstances.grok.startNewConversation());
        await Promise.all(resetPromises);
        prefixSent.gemini = false;
        prefixSent.chatgpt = false;
        prefixSent.grok = false;
        sendMessage('All conversations have been reset.');
        return;
      }
      if (command === 'status') {
        const activeAIs = Object.entries(skippedAIs)
          .filter(([_, skipped]) => !skipped)
          .map(([name]) => name);
        sendMessage(`Active AIs: ${activeAIs.join(', ')}. Use . for thinking, .. for max.`);
        return;
      }
    }
  }

  const { ai, message: parsedMsg, startNewChat, modelTier } = parseMessage(text || '');
  
  if (skippedAIs[ai]) {
    const availableAIs = Object.entries(skippedAIs)
      .filter(([_, skipped]) => !skipped)
      .map(([name]) => name);
    sendMessage(`${ai.toUpperCase()} is not configured. Available: ${availableAIs.join(', ')}`);
    return;
  }
  
  const baseMessage = parsedMsg || 'What is in this image?';
  
  const needsPrefix = !prefixSent[ai] || startNewChat || (lastAIUsed !== null && lastAIUsed !== ai);
  const finalMessage = needsPrefix ? MESSAGE_PREFIX + baseMessage : baseMessage;

  const tierLabel = modelTier !== 'fast' ? ` [${modelTier}]` : '';
  console.log(`[Router] ${ai.toUpperCase()}${tierLabel}${startNewChat ? ' (new chat)' : ''}${needsPrefix ? ' (with prefix)' : ''}`);

  const aiInstance = aiInstances[ai];

  try {
    const loggedIn = await aiInstance.isLoggedIn();
    if (!loggedIn) {
      console.log(`[${ai}] Session expired. Waiting for re-login...`);
      sendMessage(`[${ai.toUpperCase()}] Session expired. Please log in again.`);
      await aiInstance.waitForLogin();
    }

    if (startNewChat) {
      console.log(`[${ai}] Starting new conversation...`);
      await aiInstance.startNewConversation();
      prefixSent[ai] = false;
    }

    const response = await aiInstance.sendAndGetResponse(
      finalMessage,
      RESPONSE_TIMEOUT,
      images,
      modelTier
    );
    
    prefixSent[ai] = true;
    lastAIUsed = ai;
    
    console.log(`[${ai}] Response: "${response.substring(0, 80)}..."`);
    sendMessage(response);
  } catch (error) {
    const aiError = error as AIError;
    console.error(`[${ai}] Error:`, aiError.message);
    sendErrorMessage(aiError.code);
  }
}

/**
 * Process queue sequentially
 */
async function processQueue(): Promise<void> {
  if (isProcessing || messageQueue.length === 0) return;
  
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift()!;
    try {
      await processMessage(msg);
    } catch (error) {
      console.error('[Queue] Error processing message:', error);
    }
  }
  
  isProcessing = false;
}

async function pollForMessages(): Promise<void> {
  let lastMessageId = getLastMessageId();
  
  if (lastMessageId === 0) {
    lastMessageId = initializeMessageReader();
    saveLastMessageId(lastMessageId);
    console.log(`[Poll] Starting from message ID: ${lastMessageId}`);
  }

  console.log('[Poll] Listening for new messages...\n');

  while (true) {
    try {
      const newMessages = getNewMessages(lastMessageId);

      if (newMessages.length > 0) {
        lastMessageId = newMessages[newMessages.length - 1].rowid;
        saveLastMessageId(lastMessageId);
        
        // Filter and queue messages
        for (const msg of newMessages) {
          if (!wasSentByUs(msg.text)) {
            messageQueue.push(msg);
          }
        }
        
        // Process queue (non-blocking start)
        processQueue();
      }
    } catch (error) {
      console.error('[Poll] Error:', error);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

async function cleanup(): Promise<void> {
  console.log('\n[Shutdown] Cleaning up...');
  const cleanupPromises = [];
  if (!skippedAIs.gemini) cleanupPromises.push(aiInstances.gemini.cleanup());
  if (!skippedAIs.chatgpt) cleanupPromises.push(aiInstances.chatgpt.cleanup());
  if (!skippedAIs.grok) cleanupPromises.push(aiInstances.grok.cleanup());
  await Promise.all(cleanupPromises);
  console.log('[Shutdown] Done.');
  process.exit(0);
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     iMessage AI Bridge v2.0.0          ║');
  console.log('║  Gemini (default) | ChatGPT | Grok     ║');
  console.log('║  Prefixes: . = thinking, .. = max     ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Check for --setup flag to force reconfiguration
  if (process.argv.includes('--setup')) {
    // Delete existing config to force setup
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    await runSetup();
    return;
  }

  // Check if setup needed
  if (needsSetup()) {
    await runSetup();
    return;
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await initializeAIs();
    await pollForMessages();
  } catch (error) {
    console.error('[Fatal] Error:', error);
    await cleanup();
  }
}

main().catch(console.error);
