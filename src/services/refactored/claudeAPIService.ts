/**
 * Claude API Service for direct communication with Anthropic API
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIServiceConfig } from '../../config/serviceConfig';
import { logger } from '../../utils/logger';
import { AIAnalysisResult } from '../../types';

export class ClaudeAPIService {
  private anthropic: Anthropic | null = null; // Initialize to null
  private isConfigured: boolean;

  constructor(private config: AIServiceConfig) {
    this.isConfigured = this.initializeAnthropic();
  }

  private initializeAnthropic(): boolean {
    const apiKey = process.env.ANTHROPIC_API_KEY; // Assuming ANTHROPIC_API_KEY in .env
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      logger.warn('Anthropic API key not configured. Claude API will not be available.');
      return false;
    }

    try {
      this.anthropic = new Anthropic({ apiKey });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Anthropic SDK', error as Error);
      this.anthropic = null;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  getName(): string {
    return 'Claude';
  }

  /**
   * Analyze email content for unsubscribe options using Claude
   */
  async analyzeUnsubscribeOptions(emailContent: string, headers: Record<string, string>): Promise<{
    unsubscribeLinks: string[];
    complexity: 'simple' | 'medium' | 'complex';
    recommendation: string;
  }> {
    if (!this.anthropic) {
      throw new Error('Claude API is not configured or available.');
    }

    const listUnsubscribe = headers['list-unsubscribe'] || 'Not present';
    const listUnsubscribePost = headers['list-unsubscribe-post'] || 'Not present';

    const prompt = `Analyze this email content and identify all unsubscribe options:

Email Headers (relevant):
List-Unsubscribe: ${listUnsubscribe}
List-Unsubscribe-Post: ${listUnsubscribePost}

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

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.model, // e.g., 'claude-3-5-sonnet-20241022'
        max_tokens: this.config.maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      } else {
        throw new Error('Unexpected Claude response format');
      }
    } catch (error) {
      logger.error('Error analyzing unsubscribe options with Claude', error as Error);
      throw new Error(`Claude analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Use Claude's computer vision capabilities to analyze and interact with a webpage.
   * This method is intended for advanced automation where direct API calls are insufficient.
   * It returns instructions for a browser automation service.
   */
  async getComputerUseInstructions(
    screenshotBase64: string, 
    url: string
  ): Promise<{
    canProcess: boolean;
    steps: Array<{ action: string; target?: string; coordinates?: [number, number]; text?: string }>;
    reasoning: string;
  }> {
    if (!this.anthropic) {
      throw new Error('Claude API is not configured or available.');
    }

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

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.model, // Ensure this model supports vision, e.g., 'claude-3-opus-20240229' or 'claude-3-sonnet-20240229'
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

      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      } else {
        throw new Error('Unexpected Claude response format for computer use');
      }
    } catch (error) {
      logger.error('Error getting Claude computer use instructions', error as Error);
      throw new Error(`Claude computer use failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}