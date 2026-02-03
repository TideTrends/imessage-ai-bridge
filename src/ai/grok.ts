import { BaseAI } from './base';
import { AI_URLS, BROWSER_DATA, ModelTier } from '../config';

export class GrokAI extends BaseAI {
  constructor() {
    super('grok', AI_URLS.grok, BROWSER_DATA.grok);
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const inputArea = await this.page.$('textarea');
      return inputArea !== null;
    } catch {
      return false;
    }
  }

  async selectModel(tier: ModelTier): Promise<void> {
    if (!this.page) return;

    try {
      // Grok has "Think Harder" or model selection
      // Look for the thinking toggle or model selector
      if (tier === 'thinking' || tier === 'max') {
        const buttons = await this.page.$$('button, div');
        for (const btn of buttons) {
          const text = await this.page.evaluate(el => el.textContent, btn);
          if (text?.toLowerCase().includes('think')) {
            await btn.click();
            await this.sleep(500);
            console.log(`[grok] Enabled thinking mode`);
            return;
          }
        }
      }
      // For fast/default, we don't need to do anything
    } catch (error) {
      console.log(`[grok] Could not change model: ${error}`);
    }
  }

  async uploadImages(imagePaths: string[]): Promise<void> {
    if (!this.page || imagePaths.length === 0) return;

    console.log(`[grok] Uploading ${imagePaths.length} image(s) via clipboard paste`);

    try {
      // Focus on the input area first
      const inputArea = await this.page.$('textarea');
      if (inputArea) {
        await inputArea.click();
        await this.sleep(200);
      }

      // Paste each image from clipboard
      for (const imagePath of imagePaths) {
        const success = await this.pasteImageFromClipboard(imagePath);
        if (success) {
          await this.sleep(1500);
        }
      }
    } catch (error) {
      console.log(`[grok] Image upload failed: ${error}`);
    }
  }

  protected async typeMessage(message: string): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    const inputSelector = 'textarea';
    
    await this.page.waitForSelector(inputSelector, { timeout: 10000 });
    
    const input = await this.page.$(inputSelector);
    if (!input) throw this.createError('Could not find input field', 'INPUT_NOT_FOUND');
    
    await input.click();
    await this.randomDelay(100, 300);
    await this.humanType(message);
  }

  protected async submitMessage(): Promise<void> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    const sendButtonSelector = 'button[aria-label*="Send"], button[type="submit"]';
    
    try {
      await this.randomDelay(200, 500);
      
      const sendButton = await this.page.$(sendButtonSelector);
      if (sendButton) {
        await sendButton.click();
        return;
      }
      
      await this.page.keyboard.press('Enter');
    } catch {
      await this.page.keyboard.press('Enter');
    }
  }

  protected async waitForResponse(timeout: number): Promise<string> {
    if (!this.page) throw this.createError('Page not initialized', 'NOT_INITIALIZED');

    await this.sleep(2000);

    const getLastResponse = async (): Promise<string> => {
      try {
        const responseDivs = await this.page!.$$('div[class*="r-1wbh5a2"][class*="r-bnwqim"]');
        if (responseDivs.length > 0) {
          const last = responseDivs[responseDivs.length - 1];
          const text = await this.getTextContent(last);
          return text?.trim() || '';
        }
      } catch {}

      try {
        const textDivs = await this.page!.$$('div[class*="r-rjixqe"]');
        if (textDivs.length > 0) {
          const last = textDivs[textDivs.length - 1];
          const text = await this.getTextContent(last);
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
