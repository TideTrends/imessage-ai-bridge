import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { execSync } from 'child_process';
import { AIType, ModelTier, RESPONSE_TIMEOUT, STABILIZATION_TIME } from '../config';

export interface AIError extends Error {
  code?: string | number;
}

export abstract class BaseAI {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected isInitialized = false;
  protected currentModelTier: ModelTier = 'fast';

  constructor(
    public readonly name: AIType,
    protected readonly url: string,
    protected readonly browserDataPath: string
  ) {}

  /**
   * Initialize the browser with persistent context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`[${this.name}] Launching browser...`);

    this.context = await chromium.launchPersistentContext(this.browserDataPath, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Dismiss any popups/modals that appear
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
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
    this.isInitialized = false;
    console.log(`[${this.name}] Browser closed`);
  }

  /**
   * Dismiss popups, modals, and "what's new" dialogs
   */
  async dismissPopups(): Promise<void> {
    if (!this.page) return;

    console.log(`[${this.name}] Checking for popups to dismiss...`);

    try {
      // Common dismiss button selectors
      const dismissSelectors = [
        // Generic close/dismiss buttons
        'button[aria-label="Close"]',
        'button[aria-label="Dismiss"]',
        'button[aria-label="Got it"]',
        'button[aria-label="OK"]',
        'button[aria-label="Skip"]',
        'button[aria-label="No thanks"]',
        'button[aria-label="Maybe later"]',
        // Text-based buttons
        'button:has-text("Got it")',
        'button:has-text("OK")',
        'button:has-text("Close")',
        'button:has-text("Dismiss")',
        'button:has-text("Skip")',
        'button:has-text("No thanks")',
        'button:has-text("Maybe later")',
        'button:has-text("Not now")',
        'button:has-text("Continue")',
        // Material/Angular style
        'mat-dialog-container button',
        '[role="dialog"] button[aria-label="Close"]',
        '[role="dialog"] button:has-text("Got it")',
        '[role="alertdialog"] button',
        // Overlay close buttons
        '.modal-close',
        '.dialog-close',
        '[data-testid="close-button"]',
        // X buttons
        'button[aria-label="close"]',
        'button svg[data-testid="CloseIcon"]',
      ];

      for (const selector of dismissSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            if (isVisible) {
              console.log(`[${this.name}] Dismissing popup with: ${selector}`);
              await button.click();
              await this.sleep(500);
            }
          }
        } catch {
          // Selector didn't match, continue
        }
      }

      // Also try pressing Escape to close any modal
      await this.page.keyboard.press('Escape');
      await this.sleep(300);

    } catch (error) {
      console.log(`[${this.name}] Error dismissing popups: ${error}`);
    }
  }

  /**
   * Copy an image to clipboard and paste it (macOS)
   */
  protected async pasteImageFromClipboard(imagePath: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Use osascript to copy image to clipboard
      const script = `
        set theFile to POSIX file "${imagePath}"
        set theImage to read theFile as TIFF picture
        set the clipboard to theImage
      `;
      
      execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      console.log(`[${this.name}] Image copied to clipboard`);

      // Give clipboard a moment
      await this.sleep(200);

      // Paste with Cmd+V
      await this.page.keyboard.press('Meta+v');
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
