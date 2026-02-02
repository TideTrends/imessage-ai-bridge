import { GeminiAI } from './ai/gemini';
import { ChatGPTAI } from './ai/chatgpt';
import { GrokAI } from './ai/grok';

async function login() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║         LOGIN TO ALL AI SERVICES       ║');
  console.log('║  Take your time - no rush!             ║');
  console.log('╚════════════════════════════════════════╝\n');

  const gemini = new GeminiAI();
  const chatgpt = new ChatGPTAI();
  const grok = new GrokAI();

  console.log('Opening all three browsers...\n');

  await Promise.all([
    gemini.initialize(),
    chatgpt.initialize(),
    grok.initialize(),
  ]);

  console.log('\n=== All browsers open! Log in to each one. ===\n');

  // Check each one
  const checkLogin = async (ai: GeminiAI | ChatGPTAI | GrokAI, name: string) => {
    while (!(await ai.isLoggedIn())) {
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`✓ ${name} - logged in!`);
  };

  await Promise.all([
    checkLogin(gemini, 'Gemini'),
    checkLogin(chatgpt, 'ChatGPT'),
    checkLogin(grok, 'Grok'),
  ]);

  console.log('\n=== ALL LOGINS COMPLETE! ===');
  console.log('Sessions saved. You can now close this and run: npm start\n');
  console.log('Press Ctrl+C to exit...\n');

  // Keep alive
  await new Promise(() => {});
}

login().catch(console.error);
