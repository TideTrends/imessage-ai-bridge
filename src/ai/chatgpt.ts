import { BaseAI } from './base';
import { AI_URLS, BROWSER_DATA, ModelTier } from '../config';

export class ChatGPTAI extends BaseAI {
  constructor() {
    super('chatgpt', AI_URLS.chatgpt, BROWSER_DATA.chatgpt);
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const inputArea = await this.page.$('#prompt-textarea, div.ProseMirror[contenteditable="true"]');
      return inputArea !== null;
    } catch {
      return false;
    }
  }

  async selectModel(tier: ModelTier): Promise<void> {
    if (!this.page) return;

    try {
      // Click model selector dropdown
      const modelBtn = await this.page.$('button[aria-label*="Model"], button[data-testid="model-selector"], div[class*="model-selector"]');
      if (!modelBtn) {
        console.log(`[chatgpt] Model selector not found`);
        return;
      }

      await modelBtn.click();
      await this.sleep(500);

      // GPT models: GPT-4o mini (fast), GPT-4o (thinking), GPT-4 (max)
      let modelPattern = '';
      switch (tier) {
        case 'fast':
          modelPattern = 'mini';
          break;
        case 'thinking':
          modelPattern = '4o';
          break;
        case 'max':
          modelPattern = 'gpt-4';
          break;
      }

      // Find and click the model option
      const options = await this.page.$$('div[role="option"], button[role="menuitem"], div[class*="model-option"]');
      for (const opt of options) {
        const text = await opt.textContent();
        if (text?.toLowerCase().includes(modelPattern)) {
          await opt.click();
          await this.sleep(500);
          console.log(`[chatgpt] Selected ${tier} model`);
          return;
        }
      }
    } catch (error) {
      console.log(`[chatgpt] Could not change model: ${error}`);
    }
  }

  async uploadImages(imagePaths: string[]): Promise<void> {
    if (!this.page || imagePaths.length === 0) return;

    try {
      // ChatGPT has a file input or attach button
      const attachBtn = await this.page.$('button[aria-label*="Attach"], button[aria-label*="Upload"], button[data-testid="attach-button"]');
      if (attachBtn) {
        await attachBtn.click();
        await this.sleep(300);
      }

      const fileInput = await this.page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(imagePaths);
        await this.sleep(2000); // Wait for upload
        console.log(`[chatgpt] Uploaded ${imagePaths.length} image(s)`);
      }
    } catch (error) {
      console.log(`[chatgpt] Image upload failed: ${error}`);
    }
  }

  protected async typeMessage(message: string): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    const inputSelector = '#prompt-textarea';
    
    await this.page.waitForSelector(inputSelector, { timeout: 10000 });
    
    const input = await this.page.$(inputSelector);
    if (!input) throw this.createError('Could not find input field', 'INPUT_NOT_FOUND');
    
    await input.click();
    await this.page.keyboard.type(message, { delay: 10 });
  }

  protected async submitMessage(): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    const sendButtonSelector = 'button[data-testid="send-button"], button[aria-label="Send prompt"]';
    
    try {
      await this.sleep(300);
      
      const sendButton = await this.page.$(sendButtonSelector);
      if (sendButton) {
        const isDisabled = await sendButton.getAttribute('disabled');
        if (!isDisabled) {
          await sendButton.click();
          return;
        }
      }
      
      await this.page.keyboard.press('Enter');
    } catch {
      await this.page.keyboard.press('Enter');
    }
  }

  protected async waitForResponse(timeout: number): Promise<string> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    await this.sleep(1000);

    const isGenerating = async (): Promise<boolean> => {
      const stopButton = await this.page!.$('button[aria-label="Stop generating"], button[data-testid="stop-button"]');
      return stopButton !== null;
    };

    const getLastResponse = async (): Promise<string> => {
      const responseSelectors = [
        'div[data-message-author-role="assistant"]',
        'div.agent-turn div.markdown',
      ];

      for (const selector of responseSelectors) {
        try {
          const responses = await this.page!.$$(selector);
          if (responses.length > 0) {
            const lastResponse = responses[responses.length - 1];
            const markdownDiv = await lastResponse.$('.markdown, .prose');
            const target = markdownDiv || lastResponse;
            const text = await target.textContent();
            return text?.trim() || '';
          }
        } catch {
          continue;
        }
      }

      return '';
    };

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (!(await isGenerating())) {
        await this.sleep(500);
        const response = await getLastResponse();
        if (response) return response;
      }
      await this.sleep(300);
    }

    return this.waitForStabilization(getLastResponse, timeout);
  }

  async startNewConversation(): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    try {
      const newChatButton = await this.page.$('a[href="/"], button[aria-label="New chat"]');
      if (newChatButton) {
        await newChatButton.click();
        await this.sleep(2000);
        return;
      }
    } catch {}

    await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.sleep(2000);
  }
}
