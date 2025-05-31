/**
 * Service interfaces for dependency injection and abstraction
 */

import { EmailData, AIAnalysisResult, UnsubscribeInfo } from '../types';

/**
 * AI Service interface for email analysis
 */
export interface IAIService {
  /**
   * Analyze an email to determine if it's junk/promotional
   */
  analyzeEmail(email: EmailData): Promise<AIAnalysisResult>;
  
  /**
   * Get service health status
   */
  getHealthStatus(): Promise<{ healthy: boolean; details: any }>;
}

/**
 * Cache service interface for data persistence
 */
export interface ICacheService {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * Delete a key from cache
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear cache entries matching a pattern
   */
  clear(pattern?: string): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
  
  // Specific cache methods for backward compatibility
  cacheEmail(messageId: string, emailData: any): Promise<void>;
  getCachedEmail(messageId: string): Promise<any | null>;
  cacheSearchResults(query: string, results: any): Promise<void>;
  getCachedSearchResults(query: string): Promise<any | null>;
  cacheDomainAnalysis(domain: string, analysis: any): Promise<void>;
  getCachedDomainAnalysis(domain: string): Promise<any | null>;
  cacheAIAnalysis(emailBatch: string[], analysis: any): Promise<void>;
  getCachedAIAnalysis(emailBatch: string[]): Promise<any | null>;
}

/**
 * Email service interface for Gmail operations
 */
export interface IEmailService {
  /**
   * Search for emails matching a query
   */
  searchEmails(query: string, maxResults?: number): Promise<EmailData[]>;
  
  /**
   * Get a single email by ID
   */
  getEmail(messageId: string): Promise<EmailData>;
  
  /**
   * Archive an email
   */
  archiveEmail(messageId: string): Promise<void>;
  
  /**
   * Archive multiple emails
   */
  archiveEmails(messageIds: string[]): Promise<void>;
  
  /**
   * Mark an email as read
   */
  markAsRead(messageId: string): Promise<void>;
  
  /**
   * Delete an email
   */
  deleteEmail(messageId: string): Promise<void>;
  
  /**
   * Check if service is authenticated
   */
  isAuthenticated(): Promise<boolean>;
}

/**
 * Unsubscribe service interface
 */
export interface IUnsubscribeService {
  /**
   * Analyze email for unsubscribe options
   */
  analyzeUnsubscribeOptions(email: EmailData): Promise<UnsubscribeInfo>;
  
  /**
   * Perform unsubscribe action
   */
  performUnsubscribe(email: EmailData, method: UnsubscribeMethod): Promise<UnsubscribeResult>;
  
  /**
   * Perform bulk unsubscribe for multiple emails
   */
  performBulkUnsubscribe(
    emailIds: string[], 
    senderDomain: string
  ): Promise<BulkUnsubscribeResult>;
}

/**
 * Unsubscribe method types
 */
export enum UnsubscribeMethod {
  LIST_UNSUBSCRIBE_HEADER = 'list-unsubscribe-header',
  FORM_AUTOMATION = 'form-automation',
  COMPUTER_USE = 'computer-use',
  MANUAL_FALLBACK = 'manual-fallback',
  EMAIL_REPLY = 'email-reply'
}

/**
 * Unsubscribe result interface
 */
export interface UnsubscribeResult {
  success: boolean;
  method: UnsubscribeMethod;
  message: string;
  url?: string;
  error?: string;
  steps?: string[];
}

/**
 * Bulk unsubscribe result interface
 */
export interface BulkUnsubscribeResult {
  success: boolean;
  method: string;
  details?: string;
  archived?: boolean;
  enhancedResults?: UnsubscribeResult[];
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
}

/**
 * Rate limiter interface
 */
export interface IRateLimiter {
  /**
   * Check if request can proceed
   */
  canProceed(): Promise<boolean>;
  
  /**
   * Wait for rate limit if needed
   */
  waitIfNeeded(): Promise<void>;
  
  /**
   * Record a successful request
   */
  recordSuccess(): void;
  
  /**
   * Record a failed request
   */
  recordFailure(error: Error): void;
}

/**
 * Token manager interface for OAuth
 */
export interface ITokenManager {
  /**
   * Get current tokens
   */
  getTokens(): Promise<any>;
  
  /**
   * Save tokens
   */
  saveTokens(tokens: any): Promise<void>;
  
  /**
   * Refresh access token
   */
  refreshToken(): Promise<any>;
  
  /**
   * Check if tokens are valid
   */
  isValid(): Promise<boolean>;
}