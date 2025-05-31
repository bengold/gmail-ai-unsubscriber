import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Page } from 'puppeteer';

export interface UnsubscribeResult {
  success: boolean;
  method: 'list-unsubscribe-header' | 'form-automation' | 'computer-use' | 'manual-fallback';
  message: string;
  url?: string;
  error?: string;
  steps?: string[];
}

export class ClaudeService {
  private anthropic: Anthropic;
  private model: string;

  constructor() {
    if (!config.anthropic.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
    console.log(`🤖 Claude Service initialized with model: ${this.model}`);
  }

  /**
   * Analyze unsubscribe options for an email
   */
  async analyzeUnsubscribeOptions(emailContent: string, headers: any): Promise<{
    hasListUnsubscribe: boolean;
    listUnsubscribeUrl?: string;
    listUnsubscribePost?: string;
    unsubscribeLinks: string[];
    complexity: 'simple' | 'medium' | 'complex';
    recommendation: string;
  }> {
    try {
      // Check for List-Unsubscribe headers first (RFC 2369/8058)
      const listUnsubscribe = headers['list-unsubscribe'];
      const listUnsubscribePost = headers['list-unsubscribe-post'];
      
      let hasListUnsubscribe = false;
      let listUnsubscribeUrl;
      
      if (listUnsubscribe) {
        hasListUnsubscribe = true;
        // Extract URL from List-Unsubscribe header
        const urlMatch = listUnsubscribe.match(/<([^>]+)>/);
        if (urlMatch) {
          listUnsubscribeUrl = urlMatch[1];
        }
      }

      // Use Claude to analyze the email content for unsubscribe links
      const prompt = `Analyze this email content and identify all unsubscribe options:

Email Headers (relevant):
List-Unsubscribe: ${listUnsubscribe || 'Not present'}
List-Unsubscribe-Post: ${listUnsubscribePost || 'Not present'}

Email Content:
${emailContent.substring(0, 5000)} // Truncate for API limits

Please identify:
1. All unsubscribe links in the email
2. The complexity of the unsubscribe process (simple/medium/complex)
3. Your recommendation for the best unsubscribe method

Return your analysis in this JSON format:
{
  "unsubscribeLinks": ["url1", "url2"],
  "complexity": "simple|medium|complex",
  "recommendation": "explanation of best approach"
}`;

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      let analysis;
      try {
        const content = response.content[0];
        if (content.type === 'text') {
          analysis = JSON.parse(content.text);
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (parseError) {
        logger.error(`Failed to parse Claude response: ${parseError}`);
        analysis = {
          unsubscribeLinks: [],
          complexity: 'complex',
          recommendation: 'Manual review required'
        };
      }

      return {
        hasListUnsubscribe,
        listUnsubscribeUrl,
        listUnsubscribePost,
        unsubscribeLinks: analysis.unsubscribeLinks || [],
        complexity: analysis.complexity || 'complex',
        recommendation: analysis.recommendation || 'Manual review required'
      };
    } catch (error) {
      logger.error(`Error analyzing unsubscribe options: ${error}`);
      throw error;
    }
  }

  /**
   * Attempt to unsubscribe using the best available method
   */
  async attemptUnsubscribe(emailId: string, analysisResult: any): Promise<UnsubscribeResult> {
    try {
      // Method 1: Try List-Unsubscribe header (most reliable)
      if (analysisResult.hasListUnsubscribe && analysisResult.listUnsubscribeUrl) {
        const headerResult = await this.unsubscribeViaHeader(
          analysisResult.listUnsubscribeUrl,
          analysisResult.listUnsubscribePost
        );
        if (headerResult.success) {
          return headerResult;
        }
      }

      // Method 2: Try direct unsubscribe links (if simple enough)
      if (analysisResult.complexity === 'simple' && analysisResult.unsubscribeLinks.length > 0) {
        const linkResult = await this.unsubscribeViaLink(analysisResult.unsubscribeLinks[0]);
        if (linkResult.success) {
          return linkResult;
        }
      }

      // Method 3: For complex cases, use Claude Computer Use (when available)
      if (analysisResult.complexity === 'complex' || analysisResult.unsubscribeLinks.length > 0) {
        return await this.unsubscribeViaComputerUse(analysisResult);
      }

      return {
        success: false,
        method: 'manual-fallback',
        message: 'No reliable unsubscribe method found. Manual action required.',
        error: 'All automated methods failed or unavailable'
      };
    } catch (error) {
      logger.error(`Error attempting unsubscribe: ${error}`);
      return {
        success: false,
        method: 'manual-fallback',
        message: 'Error during unsubscribe attempt',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unsubscribe via List-Unsubscribe header
   */
  private async unsubscribeViaHeader(url: string, postData?: string): Promise<UnsubscribeResult> {
    try {
      logger.info(`Attempting List-Unsubscribe header method for URL: ${url}`);
      
      const method = postData ? 'POST' : 'GET';
      const options: RequestInit = {
        method,
        headers: {
          'User-Agent': 'Gmail AI Unsubscriber/1.0',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      };

      if (postData && method === 'POST') {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        options.body = postData;
        logger.info(`Using POST method with data: ${postData}`);
      }

      logger.info(`Making ${method} request to: ${url}`);
      const response = await fetch(url, options);
      
      logger.info(`Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        logger.info('List-Unsubscribe request successful');
        return {
          success: true,
          method: 'list-unsubscribe-header',
          message: 'Successfully unsubscribed via List-Unsubscribe header',
          url
        };
      } else {
        logger.warn(`List-Unsubscribe request failed: ${response.status} ${response.statusText}`);
        return {
          success: false,
          method: 'list-unsubscribe-header',
          message: `Failed to unsubscribe via header: ${response.status} ${response.statusText}`,
          url,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      logger.error(`List-Unsubscribe header error: ${error}`);
      return {
        success: false,
        method: 'list-unsubscribe-header',
        message: 'Error making unsubscribe request',
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unsubscribe via direct link (simple cases)
   */
  private async unsubscribeViaLink(url: string): Promise<UnsubscribeResult> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Gmail AI Unsubscriber/1.0',
        }
      });

      if (response.ok) {
        return {
          success: true,
          method: 'form-automation',
          message: 'Successfully accessed unsubscribe link',
          url
        };
      } else {
        return {
          success: false,
          method: 'form-automation',
          message: `Failed to access unsubscribe link: ${response.status}`,
          url,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        method: 'form-automation',
        message: 'Error accessing unsubscribe link',
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unsubscribe via Claude Computer Use (for complex forms)
   */
  private async unsubscribeViaComputerUse(analysisResult: any): Promise<UnsubscribeResult> {
    try {
      if (!analysisResult.unsubscribeLinks || analysisResult.unsubscribeLinks.length === 0) {
        return {
          success: false,
          method: 'computer-use',
          message: 'No unsubscribe links found for computer use',
          error: 'No links available'
        };
      }

      const targetUrl = analysisResult.unsubscribeLinks[0];
      logger.info(`Starting computer use unsubscribe for URL: ${targetUrl}`);

      // Launch browser
      const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        defaultViewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      const steps: string[] = [];

      try {
        // Navigate to the unsubscribe page
        steps.push(`Navigating to: ${targetUrl}`);
        
        // Set up error handling for navigation
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(30000);
        
        try {
          await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          
          // Wait a bit for dynamic content to load
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (navError) {
          logger.warn(`Navigation warning for ${targetUrl}: ${navError}`);
          // Try to continue if page partially loaded
        }

        // Take initial screenshot
        const screenshotPath = path.join(process.cwd(), 'cache', `unsubscribe-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true });

        // Read screenshot for Claude analysis
        const screenshotBase64 = fs.readFileSync(screenshotPath, 'base64');

        // Use Claude Computer Use to analyze and interact with the page
        const computerUseResult = await this.performComputerUseUnsubscribe(
          screenshotBase64, 
          targetUrl, 
          page
        );

        await browser.close();

        if (computerUseResult.success) {
          return {
            success: true,
            method: 'computer-use',
            message: 'Successfully unsubscribed using computer use',
            url: targetUrl,
            steps: [...steps, ...computerUseResult.steps]
          };
        } else {
          return {
            success: false,
            method: 'computer-use',
            message: 'Computer use unsubscribe failed',
            url: targetUrl,
            error: computerUseResult.error,
            steps: [...steps, ...computerUseResult.steps]
          };
        }

      } catch (error) {
        await browser.close();
        throw error;
      }

    } catch (error) {
      logger.error(`Computer use unsubscribe error: ${error}`);
      return {
        success: false,
        method: 'computer-use',
        message: 'Error during computer use unsubscribe',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Use Claude's computer use capabilities to interact with unsubscribe page
   */
  private async performComputerUseUnsubscribe(
    screenshotBase64: string, 
    url: string, 
    page: Page
  ): Promise<{ success: boolean; error?: string; steps: string[] }> {
    try {
      const steps: string[] = [];

      const prompt = `You are helping to unsubscribe from an email list. You can see a screenshot of the unsubscribe page at ${url}.

Please analyze this screenshot and help me:
1. Identify the unsubscribe form elements (email input, checkboxes, buttons)
2. Provide step-by-step instructions to complete the unsubscribe process
3. Tell me what to click, what to type, and in what order

Look for:
- Email input fields that might need to be filled
- Unsubscribe buttons or confirmation buttons
- Checkboxes that need to be selected/deselected
- Any dropdown menus or other form elements

Respond with a JSON object containing:
{
  "canProcess": true/false,
  "steps": [
    {"action": "click", "target": "button text or selector description", "coordinates": [x, y]},
    {"action": "type", "target": "input field description", "text": "text to type"},
    {"action": "click", "target": "submit button", "coordinates": [x, y]}
  ],
  "reasoning": "explanation of what you see and why these steps will work"
}`;

      // Call Claude with computer use capabilities
      const response = await this.anthropic.messages.create({
        model: this.model, // Use configured model (should support computer use for this feature)
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64
              }
            }
          ]
        }]
      });

      let claudeInstructions;
      try {
        const content = response.content[0];
        if (content.type === 'text') {
          claudeInstructions = JSON.parse(content.text);
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (parseError) {
        logger.error(`Failed to parse Claude computer use response: ${parseError}`);
        return {
          success: false,
          error: 'Failed to parse Claude instructions',
          steps: ['Could not understand page layout']
        };
      }

      if (!claudeInstructions.canProcess) {
        return {
          success: false,
          error: 'Claude determined the page cannot be processed automatically',
          steps: [claudeInstructions.reasoning || 'Page too complex for automation']
        };
      }

      // Execute Claude's instructions
      steps.push(`Claude analysis: ${claudeInstructions.reasoning}`);

      for (const step of claudeInstructions.steps) {
        try {
          if (step.action === 'click' && step.coordinates) {
            steps.push(`Clicking at coordinates: ${step.coordinates[0]}, ${step.coordinates[1]}`);
            await page.mouse.click(step.coordinates[0], step.coordinates[1]);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for page to respond
          } else if (step.action === 'type' && step.text) {
            steps.push(`Typing: "${step.text}" into ${step.target}`);
            await page.keyboard.type(step.text);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (step.action === 'click' && step.target) {
            // Try to find and click by text content using evaluate
            try {
              const elementFound = await page.evaluate(`
                (function(targetText) {
                  const elements = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]'));
                  const element = elements.find(el => 
                    el.textContent && el.textContent.includes(targetText) || 
                    el.value && el.value.includes(targetText)
                  );
                  if (element) {
                    element.click();
                    return true;
                  }
                  return false;
                })('${step.target}')
              `);
              
              if (elementFound) {
                steps.push(`Clicking element with text: "${step.target}"`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                steps.push(`Could not find element with text: "${step.target}"`);
              }
            } catch (evaluateError) {
              steps.push(`Error finding element: ${evaluateError}`);
            }
          }
        } catch (stepError) {
          steps.push(`Error executing step: ${stepError}`);
          logger.error(`Step execution error: ${stepError}`);
        }
      }

      // Wait for any final page changes
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take a final screenshot to verify results
      const finalScreenshotPath = path.join(process.cwd(), 'cache', `unsubscribe-final-${Date.now()}.png`);
      await page.screenshot({ path: finalScreenshotPath as `${string}.png`, fullPage: true });

      steps.push('Unsubscribe process completed');

      return {
        success: true,
        steps
      };

    } catch (error) {
      logger.error(`Computer use execution error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: ['Computer use execution failed']
      };
    }
  }

  /**
   * Get unsubscribe statistics
   */
  async getUnsubscribeStats(): Promise<{
    totalAttempts: number;
    successRate: number;
    methodBreakdown: Record<string, number>;
  }> {
    // This would typically query a database
    // For now, return mock data
    return {
      totalAttempts: 0,
      successRate: 0,
      methodBreakdown: {
        'list-unsubscribe-header': 0,
        'form-automation': 0,
        'manual-fallback': 0
      }
    };
  }
}

export const claudeService = new ClaudeService();
