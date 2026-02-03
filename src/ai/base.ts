import puppeteer, { Browser, Page } from 'puppeteer-core';
import { execSync } from 'child_process';
import { AIType, ModelTier, RESPONSE_TIMEOUT, STABILIZATION_TIME, BROWSER_PROFILES } from '../config';

export interface AIError extends Error {
  code?: string | number;
}

export abstract class BaseAI {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected isInitialized = false;
  protected currentModelTier: ModelTier = 'fast';

  constructor(
    public readonly name: AIType,
    protected readonly url: string,
    protected readonly browserDataPath: string
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`[${this.name}] Launching browser...`);

    const profileName = BROWSER_PROFILES[this.name];
    
    this.browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      userDataDir: this.browserDataPath,
      args: [
        `--profile-directory=${profileName}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await this.sleep(2000);
    await this.dismissPopups();

    this.isInitialized = true;
    console.log(`[${this.name}] Browser initialized`);
  }

  abstract isLoggedIn(): Promise<boolean>;

  async waitForLogin(): Promise<void> {
    console.log(`[${this.name}] Waiting for login...`);
    console.log(`[${this.name}] Please log in to ${this.url} in the browser window`);

    while (!(await this.isLoggedIn())) {
      await this.sleep(2000);
    }

    console.log(`[${this.name}] Login detected!`);
  }

  /**
   * Send a message with optional images and model tier
   */
  async sendAndGetResponse(
    message: string,
    timeout: number = RESPONSE_TIMEOUT,
    imagePaths: string[] = [],
    modelTier: ModelTier = 'fast'
  ): Promise<string> {
    if (!this.page) {
      throw this.createError('Browser not initialized', 'NOT_INITIALIZED');
    }

    try {
      // Select model if tier changed
      if (modelTier !== this.currentModelTier) {
        await this.selectModel(modelTier);
        this.currentModelTier = modelTier;
      }

      // Upload images if any
      if (imagePaths.length > 0) {
        await this.uploadImages(imagePaths);
      }

      // Type and send message
      await this.typeMessage(message);
      await this.submitMessage();

      // Wait for response
      const response = await this.waitForResponse(timeout);
      return response;
    } catch (error) {
      if ((error as AIError).code) {
        throw error;
      }
      throw this.createError(
        `Failed to get response: ${(error as Error).message}`,
        'RESPONSE_FAILED'
      );
    }
  }

  protected abstract typeMessage(message: string): Promise<void>;
  protected abstract submitMessage(): Promise<void>;
  protected abstract waitForResponse(timeout: number): Promise<string>;
  abstract startNewConversation(): Promise<void>;

  /**
   * Select model tier (abstract - each AI implements differently)
   */
  abstract selectModel(tier: ModelTier): Promise<void>;

  /**
   * Upload images (abstract - each AI implements differently)
   */
  abstract uploadImages(imagePaths: string[]): Promise<void>;

  async stopGeneration(): Promise<void> {
    if (!this.page) return;
    
    try {
      const stopSelectors = [
        'button[aria-label="Stop generating"]',
        'button[aria-label="Stop"]',
        'button[data-testid="stop-button"]',
      ];
      
      for (const selector of stopSelectors) {
        const stopBtn = await this.page.$(selector);
        if (stopBtn) {
          await stopBtn.click();
          await this.sleep(500);
          return;
        }
      }
    } catch {}
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    this.isInitialized = false;
    console.log(`[${this.name}] Browser closed`);
  }

  async dismissPopups(): Promise<void> {
    if (!this.page) return;

    try {
      const blockingElement = await this.page.$('[role="dialog"]:visible, [role="alertdialog"]:visible, .modal:visible, mat-dialog-container');
      
      if (!blockingElement) {
        await this.page.keyboard.press('Escape');
        return;
      }

      console.log(`[${this.name}] Popup detected, dismissing...`);

      const dismissSelectors = [
        'button:has-text("Got it")',
        'button:has-text("OK")',
        'button:has-text("Close")',
        'button:has-text("Skip")',
        'button:has-text("No thanks")',
        'button:has-text("Continue")',
        'button[aria-label="Close"]',
        '[role="dialog"] button',
      ];

      for (const selector of dismissSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const isVisible = await button.isIntersectingViewport();
            if (isVisible) {
              console.log(`[${this.name}] Clicking: ${selector}`);
              await button.click();
              await this.sleep(300);
              return;
            }
          }
        } catch {
          continue;
        }
      }

      await this.page.keyboard.press('Escape');

    } catch {
    }
  }

  protected async pasteImageFromClipboard(imagePath: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      const script = `
        set theFile to POSIX file "${imagePath}"
        set theImage to read theFile as TIFF picture
        set the clipboard to theImage
      `;
      
      execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      console.log(`[${this.name}] Image copied to clipboard`);

      await this.sleep(200);

      await this.page.keyboard.down('Meta');
      await this.page.keyboard.press('KeyV');
      await this.page.keyboard.up('Meta');
      await this.sleep(1000);

      console.log(`[${this.name}] Image pasted from clipboard`);
      return true;
    } catch (error) {
      console.error(`[${this.name}] Clipboard paste failed:`, error);
      return false;
    }
  }

  protected createError(message: string, code: string): AIError {
    const error = new Error(message) as AIError;
    error.code = code;
    return error;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async getTextContent(element: any): Promise<string | null> {
    return await this.page!.evaluate(el => el.textContent, element);
  }

  protected async getAttribute(element: any, attr: string): Promise<string | null> {
    return await this.page!.evaluate((el, attribute) => el.getAttribute(attribute), element, attr);
  }

  protected randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return this.sleep(delay);
  }

  protected async humanType(text: string): Promise<void> {
    if (!this.page) return;
    
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.randomDelay(30, 120);
    }
  }

  protected async waitForStabilization(
    getContent: () => Promise<string>,
    timeout: number,
    stabilizationTime: number = STABILIZATION_TIME
  ): Promise<string> {
    const startTime = Date.now();
    let lastContent = '';
    let lastChangeTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentContent = await getContent();

      if (currentContent !== lastContent) {
        lastContent = currentContent;
        lastChangeTime = Date.now();
      } else if (currentContent && Date.now() - lastChangeTime >= stabilizationTime) {
        return currentContent;
      }

      await this.sleep(200);
    }

    if (lastContent) {
      return lastContent;
    }
    throw this.createError('Response timeout', 'TIMEOUT');
  }
}
