import { BaseAI } from './base';
import { AI_URLS, BROWSER_DATA, ModelTier } from '../config';

export class GeminiAI extends BaseAI {
  constructor() {
    super('gemini', AI_URLS.gemini, BROWSER_DATA.gemini);
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.sleep(1000);
      const inputArea = await this.page.$('div.ql-editor[contenteditable="true"]');
      return inputArea !== null;
    } catch {
      return false;
    }
  }

  async selectModel(tier: ModelTier): Promise<void> {
    if (!this.page) return;

    try {
      // Click the model dropdown (usually near the top)
      const modelSelector = await this.page.$('button[aria-label*="model"], div[class*="model-selector"], button[class*="model"]');
      if (!modelSelector) {
        console.log(`[gemini] Model selector not found, using default`);
        return;
      }

      await modelSelector.click();
      await this.sleep(500);

      // Select based on tier
      // Gemini models: Flash (fast), Pro (thinking), Ultra (max)
      let modelName = '';
      switch (tier) {
        case 'fast':
          modelName = 'flash';
          break;
        case 'thinking':
          modelName = 'pro';
          break;
        case 'max':
          modelName = 'ultra';
          break;
      }

      const modelOption = await this.page.$(`button:has-text("${modelName}"), div:has-text("${modelName}")`);
      if (modelOption) {
        await modelOption.click();
        await this.sleep(500);
        console.log(`[gemini] Selected ${tier} model`);
      }
    } catch (error) {
      console.log(`[gemini] Could not change model: ${error}`);
    }
  }

  async uploadImages(imagePaths: string[]): Promise<void> {
    if (!this.page || imagePaths.length === 0) return;

    try {
      // Find the file input or attach button
      const fileInput = await this.page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(imagePaths);
        await this.sleep(1000);
        console.log(`[gemini] Uploaded ${imagePaths.length} image(s)`);
        return;
      }

      // Try clicking attach button first
      const attachBtn = await this.page.$('button[aria-label*="Add"], button[aria-label*="attach"], button[aria-label*="image"]');
      if (attachBtn) {
        await attachBtn.click();
        await this.sleep(300);
        
        const input = await this.page.$('input[type="file"]');
        if (input) {
          await input.setInputFiles(imagePaths);
          await this.sleep(1000);
          console.log(`[gemini] Uploaded ${imagePaths.length} image(s)`);
        }
      }
    } catch (error) {
      console.log(`[gemini] Image upload failed: ${error}`);
    }
  }

  protected async typeMessage(message: string): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    try {
      await this.page.keyboard.press('Escape');
      await this.sleep(300);
    } catch {}

    const inputSelector = 'div.ql-editor[contenteditable="true"]';
    
    await this.page.waitForSelector(inputSelector, { timeout: 10000 });
    
    const input = await this.page.$(inputSelector);
    if (!input) throw this.createError('Could not find input field', 'INPUT_NOT_FOUND');
    
    await input.click({ force: true });
    await this.page.keyboard.type(message, { delay: 10 });
  }

  protected async submitMessage(): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    const sendButtonSelector = 'button[aria-label*="Send"]';
    
    try {
      const sendButton = await this.page.$(sendButtonSelector);
      if (sendButton) {
        await sendButton.click();
      } else {
        await this.page.keyboard.press('Enter');
      }
    } catch {
      await this.page.keyboard.press('Enter');
    }
  }

  protected async waitForResponse(timeout: number): Promise<string> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    await this.sleep(1000);

    const getLastResponse = async (): Promise<string> => {
      try {
        const responses = await this.page!.$$('message-content');
        if (responses.length > 0) {
          const lastResponse = responses[responses.length - 1];
          const markdown = await lastResponse.$('div[class*="markdown"]');
          const target = markdown || lastResponse;
          const text = await target.textContent();
          return text?.trim() || '';
        }
      } catch {}

      try {
        const markdowns = await this.page!.$$('div[class*="markdown"]');
        if (markdowns.length > 0) {
          const last = markdowns[markdowns.length - 1];
          const text = await last.textContent();
          return text?.trim() || '';
        }
      } catch {}

      return '';
    };

    return this.waitForStabilization(getLastResponse, timeout);
  }

  async startNewConversation(): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.sleep(2000);
  }
}
