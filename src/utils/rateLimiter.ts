/**
 * Rate limiter implementation with exponential backoff
 */

import { IRateLimiter } from '../interfaces/services';
import { RateLimitConfig } from '../config/serviceConfig';
import { logger } from './logger';

export class RateLimiter implements IRateLimiter {
  private requestTimestamps: number[] = [];
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private currentDelay: number;

  constructor(private config: RateLimitConfig) {
    this.currentDelay = config.retryDelay;
  }

  async canProceed(): Promise<boolean> {
    const now = Date.now();
    
    // Check if we're in a backoff period
    if (this.failureCount > 0) {
      const timeSinceLastFailure = now - this.lastFailureTime;
      const requiredDelay = this.config.getBackoffDelay(this.failureCount);
      
      if (timeSinceLastFailure < requiredDelay) {
        return false;
      }
    }
    
    // Clean old timestamps
    const oneSecondAgo = now - 1000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
    
    // Check rate limit
    return this.requestTimestamps.length < this.config.requestsPerSecond;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Handle backoff period
    if (this.failureCount > 0) {
      const timeSinceLastFailure = now - this.lastFailureTime;
      const requiredDelay = this.config.getBackoffDelay(this.failureCount);
      
      if (timeSinceLastFailure < requiredDelay) {
        const waitTime = requiredDelay - timeSinceLastFailure;
        logger.debug(`Rate limiter: waiting ${waitTime}ms due to failures`);
        await this.delay(waitTime);
      }
    }
    
    // Handle rate limiting
    const oneSecondAgo = now - 1000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
    
    if (this.requestTimestamps.length >= this.config.requestsPerSecond) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        logger.debug(`Rate limiter: waiting ${waitTime}ms to respect rate limit`);
        await this.delay(waitTime);
      }
    }
    
    this.requestTimestamps.push(Date.now());
  }

  recordSuccess(): void {
    // Reset failure count on success
    if (this.failureCount > 0) {
      logger.debug('Rate limiter: resetting failure count after success');
      this.failureCount = 0;
      this.currentDelay = this.config.retryDelay;
    }
  }

  recordFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    const isRateLimit = error.message?.includes('429') || error.message?.includes('rate');
    if (isRateLimit) {
      // Double the delay for rate limit errors
      this.currentDelay = Math.min(this.currentDelay * 2, this.config.maxBackoffDelay);
    }
    
    logger.warn(`Rate limiter: recorded failure #${this.failureCount}`, {
      error: error.message,
      nextDelay: this.config.getBackoffDelay(this.failureCount)
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state for monitoring
   */
  getState(): {
    requestsInWindow: number;
    failureCount: number;
    currentDelay: number;
  } {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const requestsInWindow = this.requestTimestamps.filter(ts => ts > oneSecondAgo).length;
    
    return {
      requestsInWindow,
      failureCount: this.failureCount,
      currentDelay: this.currentDelay
    };
  }
}

/**
 * Decorator for rate-limited methods
 */
export function RateLimited(rateLimiter: IRateLimiter) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      await rateLimiter.waitIfNeeded();
      
      try {
        const result = await originalMethod.apply(this, args);
        rateLimiter.recordSuccess();
        return result;
      } catch (error) {
        rateLimiter.recordFailure(error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}