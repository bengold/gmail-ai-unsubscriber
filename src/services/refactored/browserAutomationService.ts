/**
 * Browser Automation Service using Puppeteer for complex unsubscribe flows
 */

import puppeteer, { Page, Browser } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { UnsubscribeServiceConfig } from '../../config/serviceConfig';

export class BrowserAutomationService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(private config: UnsubscribeServiceConfig) {}

  /**
   * Launches a new browser instance and navigates to the target URL.
   */
  async launchAndNavigate(url: string): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.puppeteerHeadless,
        defaultViewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();

      await this.page.setDefaultNavigationTimeout(this.config.navigationTimeout);
      await this.page.setDefaultTimeout(this.config.defaultTimeout);

      logger.info(`Navigating to: ${url}`);
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.navigationTimeout
      });

      // Wait a bit for dynamic content to load
      await this.delay(2000);
    } catch (error) {
      logger.error(`Error launching browser or navigating to ${url}`, error as Error);
      await this.closeBrowser(); // Ensure browser is closed on error
      throw error;
    }
  }

  /**
   * Takes a screenshot of the current page and returns it as a base64 string.
   */
  async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not initialized. Call launchAndNavigate first.');
    }

    try {
      const screenshotBase64 = await this.page.screenshot({
        fullPage: true,
        encoding: 'base64'
      });
      return screenshotBase64 as string;
    } catch (error) {
      logger.error('Error taking screenshot', error as Error);
      throw error;
    }
  }

  /**
   * Executes a series of actions (click, type) on the current page.
   */
  async executeActions(
    actions: Array<{ action: string; target?: string; coordinates?: [number, number]; text?: string }>
  ): Promise<string[]> {
    if (!this.page) {
      throw new Error('Browser page not initialized. Call launchAndNavigate first.');
    }

    const steps: string[] = [];

    for (const step of actions) {
      try {
        if (step.action === 'click' && step.coordinates) {
          steps.push(`Clicking at coordinates: ${step.coordinates[0]}, ${step.coordinates[1]}`);
          await this.page.mouse.click(step.coordinates[0], step.coordinates[1]);
          await this.delay(1000); // Wait for page to respond
        } else if (step.action === 'type' && step.text) {
          steps.push(`Typing: "${step.text}"`);
          // If a target is provided, try to type into a specific element
          if (step.target) {
            const element = await this.page.$(step.target);
            if (element) {
              await element.type(step.text);
            } else {
              logger.warn(`Could not find element with selector: ${step.target} for typing.`);
              await this.page.keyboard.type(step.text); // Fallback to general typing
            }
          } else {
            await this.page.keyboard.type(step.text);
          }
          await this.delay(500);
        } else if (step.action === 'click' && step.target) {
          // Try to find and click by text content or selector
          const elementFound = await this.page.evaluate((targetTextOrSelector) => {
            const elements = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]'));
            const element = elements.find(el => {
              if (el.textContent && el.textContent.includes(targetTextOrSelector)) return true;
              if (el instanceof HTMLInputElement && el.value && el.value.includes(targetTextOrSelector)) return true;
              try {
                if (el.matches(targetTextOrSelector)) return true;
              } catch (e) {
                // Invalid selector
              }
              return false;
            });
            if (element && element instanceof HTMLElement) {
              element.click();
              return true;
            }
            return false;
          }, step.target);

          if (elementFound) {
            steps.push(`Clicking element with text/selector: "${step.target}"`);
            await this.delay(1000);
          } else {
            steps.push(`Could not find element with text/selector: "${step.target}"`);
            logger.warn(`Could not find element to click: ${step.target}`);
          }
        }
      } catch (stepError) {
        steps.push(`Error executing step: ${stepError}`);
        logger.error(`Step execution error: ${stepError}`);
        throw stepError; // Re-throw to indicate failure
      }
    }
    return steps;
  }

  /**
   * Closes the browser instance.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed.');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}