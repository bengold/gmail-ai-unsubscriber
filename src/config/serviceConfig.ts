/**
 * Service configuration classes
 */

/**
 * Rate limiting configuration
 */
export class RateLimitConfig {
  constructor(
    public readonly requestsPerSecond: number = 10,
    public readonly burstLimit: number = 50,
    public readonly retryDelay: number = 1000,
    public readonly maxRetries: number = 3,
    public readonly backoffMultiplier: number = 2,
    public readonly maxBackoffDelay: number = 30000
  ) {}

  /**
   * Calculate backoff delay for a given attempt
   */
  getBackoffDelay(attempt: number): number {
    const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.maxBackoffDelay);
  }
}

/**
 * Cache configuration
 */
export class CacheConfig {
  constructor(
    public readonly stdTTL: number,
    public readonly checkperiod: number = 600,
    public readonly maxKeys?: number,
    public readonly useClones: boolean = false,
    public readonly deleteOnExpire: boolean = true
  ) {}

  /**
   * Create config for specific cache type
   */
  static forEmailCache(): CacheConfig {
    return new CacheConfig(3600, 600, 1000); // 1 hour TTL, 1000 max keys
  }

  static forSearchCache(): CacheConfig {
    return new CacheConfig(1800, 300, 100); // 30 min TTL, 100 max keys
  }

  static forDomainCache(): CacheConfig {
    return new CacheConfig(7200, 600, 500); // 2 hour TTL, 500 max keys
  }

  static forAICache(): CacheConfig {
    return new CacheConfig(14400, 1200, 200); // 4 hour TTL, 200 max keys
  }
}

/**
 * AI service configuration
 */
export class AIServiceConfig {
  constructor(
    public readonly provider: 'openai' | 'anthropic' | 'mock' = 'openai',
    public readonly model: string = 'gpt-3.5-turbo',
    public readonly maxTokens: number = 300,
    public readonly temperature: number = 0.1,
    public readonly rateLimitDelay: number = 1000,
    public readonly enableCaching: boolean = true,
    public readonly fallbackToMock: boolean = true
  ) {}
}

/**
 * Gmail service configuration
 */
export class GmailServiceConfig {
  constructor(
    public readonly batchSize: number = 20,
    public readonly maxBatchSize: number = 50,
    public readonly searchMaxResults: number = 100,
    public readonly tokenRefreshBuffer: number = 300000, // 5 minutes
    public readonly enableCaching: boolean = true,
    public readonly rateLimitConfig: RateLimitConfig = new RateLimitConfig()
  ) {}
}

/**
 * Unsubscribe service configuration
 */
export class UnsubscribeServiceConfig {
  constructor(
    public readonly enableEnhancedUnsubscribe: boolean = true,
    public readonly puppeteerHeadless: boolean = false,
    public readonly screenshotPath: string = './cache',
    public readonly navigationTimeout: number = 30000,
    public readonly defaultTimeout: number = 30000,
    public readonly maxUnsubscribeAttempts: number = 3
  ) {}
}

/**
 * Global service configuration
 */
export class ServiceConfiguration {
  constructor(
    public readonly ai: AIServiceConfig = new AIServiceConfig(),
    public readonly gmail: GmailServiceConfig = new GmailServiceConfig(),
    public readonly unsubscribe: UnsubscribeServiceConfig = new UnsubscribeServiceConfig(),
    public readonly cache: {
      email: CacheConfig,
      search: CacheConfig,
      domain: CacheConfig,
      ai: CacheConfig
    } = {
      email: CacheConfig.forEmailCache(),
      search: CacheConfig.forSearchCache(),
      domain: CacheConfig.forDomainCache(),
      ai: CacheConfig.forAICache()
    }
  ) {}

  /**
   * Create configuration from environment variables
   */
  static fromEnv(): ServiceConfiguration {
    return new ServiceConfiguration(
      new AIServiceConfig(
        process.env.AI_PROVIDER as any || 'openai',
        process.env.AI_MODEL || 'gpt-3.5-turbo',
        parseInt(process.env.AI_MAX_TOKENS || '300'),
        parseFloat(process.env.AI_TEMPERATURE || '0.1')
      ),
      new GmailServiceConfig(
        parseInt(process.env.GMAIL_BATCH_SIZE || '20'),
        parseInt(process.env.GMAIL_MAX_BATCH_SIZE || '50'),
        parseInt(process.env.GMAIL_SEARCH_MAX_RESULTS || '100')
      ),
      new UnsubscribeServiceConfig(
        process.env.ENABLE_ENHANCED_UNSUBSCRIBE !== 'false',
        process.env.PUPPETEER_HEADLESS === 'true',
        process.env.SCREENSHOT_PATH || './cache'
      )
    );
  }
}