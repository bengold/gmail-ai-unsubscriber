/**
 * Refactored AI Service with provider abstraction and improved error handling
 */

import { IAIService } from '../../interfaces/services';
import { EmailData, AIAnalysisResult } from '../../types';
import { AIServiceConfig, RateLimitConfig } from '../../config/serviceConfig';
import { RateLimiter } from '../../utils/rateLimiter';
import { logger } from '../../utils/logger';
import { ICacheService } from '../../interfaces/services';

/**
 * AI Provider interface for different AI services
 */
interface IAIProvider {
  analyzeEmail(email: EmailData): Promise<AIAnalysisResult>;
  isAvailable(): boolean;
  getName(): string;
}

/**
 * OpenAI provider implementation
 */
class OpenAIProvider implements IAIProvider {
  private openai: any;
  private isConfigured: boolean;

  constructor(private config: AIServiceConfig) {
    this.isConfigured = this.initializeOpenAI();
  }

  private initializeOpenAI(): boolean {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      logger.warn('OpenAI API key not configured');
      return false;
    }

    try {
      // Dynamic import to avoid dependency if not used
      const OpenAI = require('openai');
      this.openai = new OpenAI({ apiKey });
      return true;
    } catch (error) {
      logger.error('Failed to initialize OpenAI', error as Error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  getName(): string {
    return 'OpenAI';
  }

  async analyzeEmail(email: EmailData): Promise<AIAnalysisResult> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not available');
    }

    const headers = email.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const snippet = email.snippet || '';

    const prompt = this.buildPrompt(subject, from, snippet);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      return this.parseResponse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('OpenAI analysis failed', error as Error);
      throw error;
    }
  }

  private buildPrompt(subject: string, from: string, snippet: string): string {
    return `
Analyze this email and determine if it's junk/promotional:

Subject: ${subject}
From: ${from}
Snippet: ${snippet}

Respond with JSON:
{
  "isJunk": boolean,
  "confidence": number (0-1),
  "category": "marketing" | "newsletter" | "promotional" | "spam" | "legitimate",
  "unsubscribeMethod": "link" | "header" | "reply" | "none",
  "reasoning": "brief explanation"
}
`;
  }

  private parseResponse(content: string): AIAnalysisResult {
    try {
      const result = JSON.parse(content);
      return {
        isJunk: Boolean(result.isJunk),
        confidence: Number(result.confidence) || 0,
        category: result.category || 'legitimate',
        unsubscribeMethod: result.unsubscribeMethod || 'none',
        reasoning: result.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      logger.error('Failed to parse AI response', error as Error);
      throw new Error('Invalid AI response format');
    }
  }
}

/**
 * Mock provider for testing and fallback
 */
class MockAIProvider implements IAIProvider {
  isAvailable(): boolean {
    return true;
  }

  getName(): string {
    return 'Mock';
  }

  async analyzeEmail(email: EmailData): Promise<AIAnalysisResult> {
    const headers = email.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    
    // Enhanced heuristic analysis
    const indicators = {
      noreply: /noreply|no-reply|donotreply/i.test(from),
      newsletter: /newsletter|news|update|digest/i.test(from + subject),
      marketing: /marketing|promo|offer|deal|sale|discount/i.test(subject),
      unsubscribe: /unsubscribe|opt-out|preferences/i.test(email.snippet || ''),
      automated: /automated|automatic|system/i.test(from)
    };
    
    const indicatorCount = Object.values(indicators).filter(Boolean).length;
    const isJunk = indicatorCount >= 2;
    const confidence = Math.min(0.3 + (indicatorCount * 0.15), 0.9);
    
    let category: AIAnalysisResult['category'] = 'legitimate';
    if (indicators.newsletter) category = 'newsletter';
    else if (indicators.marketing) category = 'marketing';
    else if (isJunk) category = 'promotional';
    
    return {
      isJunk,
      confidence,
      category,
      unsubscribeMethod: indicators.unsubscribe ? 'link' : 'none',
      reasoning: `Mock analysis based on ${indicatorCount} indicators`
    };
  }
}

/**
 * Refactored AI Service
 */
export class RefactoredAIService implements IAIService {
  private providers: Map<string, IAIProvider> = new Map();
  private rateLimiter: RateLimiter;
  private activeProvider!: IAIProvider; // Will be initialized in constructor

  constructor(
    private config: AIServiceConfig,
    private cacheService: ICacheService
  ) {
    this.rateLimiter = new RateLimiter(
      new RateLimitConfig(
        10, // requestsPerSecond
        50, // burstLimit
        this.config.rateLimitDelay, // retryDelay
        3, // maxRetries
        2, // backoffMultiplier
        30000 // maxBackoffDelay
      )
    );

    this.initializeProviders();
    this.selectActiveProvider();
  }

  private initializeProviders(): void {
    // Initialize available providers
    this.providers.set('openai', new OpenAIProvider(this.config));
    this.providers.set('mock', new MockAIProvider());
    
    // Future: Add more providers
    // this.providers.set('anthropic', new AnthropicProvider(this.config));
  }

  private selectActiveProvider(): void {
    // Try to use configured provider
    const configuredProvider = this.providers.get(this.config.provider);
    if (configuredProvider?.isAvailable()) {
      this.activeProvider = configuredProvider;
      logger.info(`Using ${configuredProvider.getName()} AI provider`);
      return;
    }

    // Fallback to any available provider
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable() && name !== 'mock') {
        this.activeProvider = provider;
        logger.info(`Falling back to ${provider.getName()} AI provider`);
        return;
      }
    }

    // Last resort: use mock provider
    if (this.config.fallbackToMock) {
      this.activeProvider = this.providers.get('mock')!;
      logger.warn('Using mock AI provider as fallback');
    } else {
      throw new Error('No AI provider available');
    }
  }

  async analyzeEmail(email: EmailData): Promise<AIAnalysisResult> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(email);
    
    // Check cache if enabled
    if (this.config.enableCaching) {
      const cached = await this.cacheService.get<AIAnalysisResult>(cacheKey);
      if (cached) {
        logger.debug('AI analysis cache hit', { emailId: email.id });
        return cached;
      }
    }

    // Apply rate limiting
    await this.rateLimiter.waitIfNeeded();

    try {
      // Perform analysis
      const result = await this.activeProvider.analyzeEmail(email);
      
      // Cache result if enabled
      if (this.config.enableCaching) {
        await this.cacheService.set(cacheKey, result, 14400); // 4 hours
      }
      
      this.rateLimiter.recordSuccess();
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(error as Error);
      
      // Try fallback to mock if configured
      if (this.config.fallbackToMock && this.activeProvider.getName() !== 'Mock') {
        logger.warn('Falling back to mock analysis due to error', error as Error);
        const mockProvider = this.providers.get('mock')!;
        return mockProvider.analyzeEmail(email);
      }
      
      throw error;
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean; details: any }> {
    const providerStatuses: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      providerStatuses[name] = provider.isAvailable();
    }
    
    const rateLimiterState = this.rateLimiter.getState();
    
    return {
      healthy: this.activeProvider.isAvailable(),
      details: {
        activeProvider: this.activeProvider.getName(),
        providers: providerStatuses,
        rateLimiter: rateLimiterState,
        cacheEnabled: this.config.enableCaching
      }
    };
  }

  private generateCacheKey(email: EmailData): string {
    const headers = email.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    
    // Create a stable cache key
    const keyBase = `ai:${from}:${subject}`.substring(0, 100);
    return keyBase.replace(/[^a-zA-Z0-9:]/g, '_');
  }

  /**
   * Switch to a different AI provider
   */
  switchProvider(providerName: string): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    if (!provider.isAvailable()) {
      throw new Error(`Provider ${providerName} is not available`);
    }
    
    this.activeProvider = provider;
    logger.info(`Switched to ${provider.getName()} AI provider`);
  }
}