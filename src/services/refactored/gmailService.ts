/**
 * Refactored Gmail Service with better separation of concerns
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IEmailService, ITokenManager } from '../../interfaces/services';
import { EmailData } from '../../types';
import { GmailServiceConfig, RateLimitConfig } from '../../config/serviceConfig';
import { RateLimiter } from '../../utils/rateLimiter';
import { ICacheService } from '../../interfaces/services';
import { logger } from '../../utils/logger';

/**
 * Token manager for OAuth2 authentication
 */
export class GmailTokenManager implements ITokenManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tokenPath: string = './credentials/tokens.json'
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.tokenPath = tokenPath;
    
    // Set up automatic token refresh
    this.oauth2Client.on('tokens', (tokens) => {
      this.handleTokenRefresh(tokens);
    });
  }

  private async handleTokenRefresh(tokens: any): Promise<void> {
    try {
      if (tokens.refresh_token) {
        logger.info('New refresh token received');
        await this.saveTokens(tokens);
      } else {
        // Merge with existing tokens
        const existing = await this.getTokens();
        if (existing) {
          const merged = { ...existing, ...tokens };
          await this.saveTokens(merged);
        }
      }
    } catch (error) {
      logger.error('Error handling token refresh', error as Error);
    }
  }

  async getTokens(): Promise<any> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.tokenPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveTokens(tokens: any): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
  }

  async refreshToken(): Promise<any> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    await this.saveTokens(credentials);
    return credentials;
  }

  async isValid(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      if (!tokens) return false;
      
      this.oauth2Client.setCredentials(tokens);
      
      // Test token validity
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      await gmail.users.getProfile({ userId: 'me' });
      
      return true;
    } catch (error: any) {
      if (error.code === 401) {
        // Try to refresh
        try {
          await this.refreshToken();
          return true;
        } catch (refreshError) {
          return false;
        }
      }
      return false;
    }
  }

  getAuthUrl(scopes: string[]): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async authenticate(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await this.saveTokens(tokens);
  }

  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }
}

/**
 * Request queue for batch processing
 */
class RequestQueue<T> {
  private queue: Array<{
    id: string;
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
  }> = [];
  
  private processing = false;
  private concurrency: number;

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  async add(id: string, operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, operation, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      
      await Promise.all(
        batch.map(async ({ operation, resolve, reject }) => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
      );
    }
    
    this.processing = false;
  }

  size(): number {
    return this.queue.length;
  }
}

/**
 * Refactored Gmail Service
 */
export class RefactoredGmailService implements IEmailService {
  private gmail: any;
  private rateLimiter: RateLimiter;
  private requestQueue: RequestQueue<any>;
  private tokenManager: GmailTokenManager;
  private isInitialized = false;

  constructor(
    private config: GmailServiceConfig,
    private cacheService: ICacheService,
    tokenManager?: GmailTokenManager
  ) {
    this.rateLimiter = new RateLimiter(config.rateLimitConfig);
    this.requestQueue = new RequestQueue(config.batchSize);
    
    // Use provided token manager or create default
    this.tokenManager = tokenManager || new GmailTokenManager(
      process.env.GMAIL_CLIENT_ID!,
      process.env.GMAIL_CLIENT_SECRET!,
      process.env.GMAIL_REDIRECT_URI!
    );
    
    this.gmail = google.gmail({ 
      version: 'v1', 
      auth: this.tokenManager.getOAuth2Client() 
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const isValid = await this.tokenManager.isValid();
    if (!isValid) {
      throw new Error('Gmail authentication required');
    }
    
    this.isInitialized = true;
    logger.info('Gmail service initialized successfully');
  }

  async isAuthenticated(): Promise<boolean> {
    return this.tokenManager.isValid();
  }

  async searchEmails(query: string, maxResults: number = 100): Promise<EmailData[]> {
    await this.ensureInitialized();
    
    // Check cache
    if (this.config.enableCaching) {
      const cached = await this.cacheService.getCachedSearchResults(query);
      if (cached) {
        logger.debug(`Search cache hit for query: ${query}`);
        return cached;
      }
    }
    
    // Perform search with rate limiting
    await this.rateLimiter.waitIfNeeded();
    
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });
      
      this.rateLimiter.recordSuccess();
      
      if (!response.data.messages) {
        return [];
      }
      
      // Fetch email details in batches
      const messageIds = response.data.messages.map((msg: any) => msg.id);
      const emails = await this.getEmailsBatch(messageIds);
      
      // Cache results
      if (this.config.enableCaching && emails.length > 0) {
        await this.cacheService.cacheSearchResults(query, emails);
      }
      
      return emails;
    } catch (error) {
      this.rateLimiter.recordFailure(error as Error);
      throw this.handleGmailError(error);
    }
  }

  async getEmail(messageId: string): Promise<EmailData> {
    await this.ensureInitialized();
    
    // Check cache
    if (this.config.enableCaching) {
      const cached = await this.cacheService.getCachedEmail(messageId);
      if (cached) {
        return cached;
      }
    }
    
    // Add to request queue for better concurrency control
    return this.requestQueue.add(messageId, async () => {
      await this.rateLimiter.waitIfNeeded();
      
      try {
        const response = await this.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });
        
        this.rateLimiter.recordSuccess();
        
        // Cache the result
        if (this.config.enableCaching) {
          await this.cacheService.cacheEmail(messageId, response.data);
        }
        
        return response.data;
      } catch (error) {
        this.rateLimiter.recordFailure(error as Error);
        throw this.handleGmailError(error);
      }
    });
  }

  async archiveEmail(messageId: string): Promise<void> {
    await this.ensureInitialized();
    await this.modifyEmail(messageId, [], ['INBOX']);
  }

  async archiveEmails(messageIds: string[]): Promise<void> {
    await this.ensureInitialized();
    
    // Process in batches
    const batchSize = Math.min(this.config.batchSize, 10);
    
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(id => this.archiveEmail(id).catch(error => {
          logger.error(`Failed to archive email ${id}`, error);
        }))
      );
      
      // Small delay between batches
      if (i + batchSize < messageIds.length) {
        await this.delay(100);
      }
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.ensureInitialized();
    await this.modifyEmail(messageId, [], ['UNREAD']);
  }

  async deleteEmail(messageId: string): Promise<void> {
    await this.ensureInitialized();
    
    await this.rateLimiter.waitIfNeeded();
    
    try {
      await this.gmail.users.messages.delete({
        userId: 'me',
        id: messageId
      });
      
      this.rateLimiter.recordSuccess();
      
      // Remove from cache
      if (this.config.enableCaching) {
        await this.cacheService.delete(`email:${messageId}`);
      }
    } catch (error) {
      this.rateLimiter.recordFailure(error as Error);
      throw this.handleGmailError(error);
    }
  }

  /**
   * Get subscription emails using multiple search queries
   */
  async getSubscriptionEmails(): Promise<EmailData[]> {
    const queries = [
      'in:inbox unsubscribe',
      'in:inbox from:noreply',
      'in:inbox from:newsletter',
      'in:inbox subject:newsletter',
      'in:inbox subject:promotional',
      'in:inbox list-unsubscribe'
    ];
    
    // Search in parallel with controlled concurrency
    const searchPromises = queries.map(query => 
      this.searchEmails(query, 75).catch(error => {
        logger.warn(`Search failed for query: ${query}`, error);
        return [];
      })
    );
    
    const results = await Promise.all(searchPromises);
    const allEmails = results.flat();
    
    // Remove duplicates
    const uniqueMap = new Map<string, EmailData>();
    allEmails.forEach(email => {
      if (!uniqueMap.has(email.id)) {
        uniqueMap.set(email.id, email);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  /**
   * Get all emails from a specific sender
   */
  async getAllEmailsFromSender(senderEmail: string): Promise<EmailData[]> {
    const query = `in:inbox from:"${senderEmail}"`;
    return this.searchEmails(query, 500);
  }

  /**
   * Get all emails from a domain
   */
  async getAllEmailsFromDomain(domain: string): Promise<EmailData[]> {
    const query = `in:inbox from:@${domain}`;
    return this.searchEmails(query, 500);
  }

  private async getEmailsBatch(messageIds: string[]): Promise<EmailData[]> {
    const results: EmailData[] = [];
    
    // Use request queue for better concurrency control
    const promises = messageIds.map(id => this.getEmail(id));
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.warn(`Failed to fetch email ${messageIds[index]}`, result.reason);
      }
    });
    
    return results;
  }

  private async modifyEmail(
    messageId: string, 
    addLabelIds: string[], 
    removeLabelIds: string[]
  ): Promise<void> {
    await this.rateLimiter.waitIfNeeded();
    
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds
        }
      });
      
      this.rateLimiter.recordSuccess();
    } catch (error) {
      this.rateLimiter.recordFailure(error as Error);
      throw this.handleGmailError(error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private handleGmailError(error: any): Error {
    if (error.code === 401) {
      return new Error('Gmail authentication expired. Please re-authenticate.');
    } else if (error.code === 403) {
      return new Error('Gmail API quota exceeded. Please try again later.');
    } else if (error.code === 429) {
      return new Error('Too many requests. Please slow down.');
    } else if (error.code >= 500) {
      return new Error('Gmail service temporarily unavailable.');
    }
    
    return error;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get authentication URL for OAuth flow
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    return this.tokenManager.getAuthUrl(scopes);
  }

  /**
   * Handle OAuth callback
   */
  async handleAuthCallback(code: string): Promise<void> {
    await this.tokenManager.authenticate(code);
    await this.initialize();
  }
}