import { AIService } from './aiService';
import { ClaudeService } from './claudeService';
import { config } from '../config/env';
import { AIAnalysisResult } from '../types';
import { logger } from '../utils/logger';

export class UnifiedAIService {
  private aiService: AIService;
  private claudeService: ClaudeService;
  private preferredProvider: string;

  constructor() {
    this.aiService = new AIService();
    this.claudeService = new ClaudeService();
    this.preferredProvider = config.ai.preferredProvider;
    
    logger.info(`Unified AI Service initialized with preferred provider: ${this.preferredProvider}`);
  }

  /**
   * Analyze an email using the configured AI provider
   */
  async analyzeEmail(email: any): Promise<AIAnalysisResult> {
    if (config.ai.useClaudeForAnalysis || this.preferredProvider === 'claude') {
      return this.analyzeEmailWithClaude(email);
    }
    
    // Default to OpenAI/custom provider
    return this.aiService.analyzeEmail(email);
  }

  /**
   * Analyze email using Claude
   */
  private async analyzeEmailWithClaude(email: any): Promise<AIAnalysisResult> {
    try {
      const headers = email.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const snippet = email.snippet || '';

      const prompt = `Analyze this email and determine if it's junk/promotional:

Subject: ${subject}
From: ${from}
Snippet: ${snippet}

Respond with JSON only:
{
  "isJunk": boolean,
  "confidence": number (0-1),
  "category": "marketing" | "newsletter" | "promotional" | "spam" | "legitimate",
  "unsubscribeMethod": "link" | "header" | "reply" | "none",
  "reasoning": "brief explanation"
}`;

      const response = await this.claudeService['anthropic'].messages.create({
        model: this.claudeService['model'],
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        return {
          isJunk: Boolean(result.isJunk),
          confidence: Number(result.confidence) || 0,
          category: result.category || 'legitimate',
          unsubscribeMethod: result.unsubscribeMethod || 'none',
          reasoning: result.reasoning || 'No reasoning provided'
        };
      }
      
      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      logger.warn('Claude analysis failed, falling back to OpenAI service:', error as Error);
      return this.aiService.analyzeEmail(email);
    }
  }

  /**
   * Get information about the current AI configuration
   */
  getConfigInfo(): {
    provider: string;
    model: string;
    baseURL?: string;
  } {
    if (config.ai.useClaudeForAnalysis || this.preferredProvider === 'claude') {
      return {
        provider: 'claude',
        model: config.anthropic.model
      };
    }
    
    return {
      provider: 'openai',
      model: config.openai.model,
      baseURL: config.openai.baseURL
    };
  }
}
