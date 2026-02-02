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
      const modelSelector = await this.page.$('button[aria-label*="model"], div[class*="model-selector"], button[class*="model"]');
      if (!modelSelector) {
        console.log(`[gemini] Model selector not found, using default`);
        return;
      }

      await modelSelector.click();
      await this.sleep(500);

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

    console.log(`[gemini] Uploading ${imagePaths.length} image(s) via clipboard paste`);

    try {
      // Focus on the input area first
      const inputArea = await this.page.$('div.ql-editor[contenteditable="true"]');
      if (inputArea) {
        await inputArea.click();
        await this.sleep(200);
      }

      // Paste each image from clipboard
      for (const imagePath of imagePaths) {
        const success = await this.pasteImageFromClipboard(imagePath);
        if (success) {
          await this.sleep(1500); // Wait for image to process
        }
      }
    } catch (error) {
      console.error(`[gemini] Image upload failed:`, error);
    }
  }

  protected async typeMessage(message: string): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

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
      await this.sleep(500); // Wait for any upload to settle
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

    await this.sleep(2000); // Wait longer for image processing

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
