// Load environment variables first
import '../config/env';

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

interface BatchRequest {
  id: string;
  promise: Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  retryDelay: number;
  maxRetries: number;
}

export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private requestQueue: BatchRequest[] = [];
  private isProcessingQueue = false;
  private rateLimitConfig: RateLimitConfig = {
    requestsPerSecond: 10,
    burstLimit: 50,
    retryDelay: 1000,
    maxRetries: 3
  };
  private requestTimestamps: number[] = [];

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set up automatic token refresh with better logging
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        logger.info('New refresh token received, saving...');
        this.saveTokens(tokens);
      } else {
        // If no refresh token, merge with existing tokens
        logger.info('Access token refreshed');
        const existingTokens = this.loadTokensSync();
        if (existingTokens) {
          const updatedTokens = { ...existingTokens, ...tokens };
          this.saveTokens(updatedTokens);
        }
      }
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // This ensures we get a refresh token
    });
  }

  async authenticate(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    // Save tokens for future use
    this.saveTokens(tokens);
  }

  async handleAuthCallback(code: string): Promise<void> {
    return this.authenticate(code);
  }

  async loadSavedTokens(): Promise<boolean> {
    try {
      const tokenPath = path.join(__dirname, '../../credentials/tokens.json');
      if (fs.existsSync(tokenPath)) {
        const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        this.oauth2Client.setCredentials(tokens);
        logger.info('Loaded saved tokens successfully');
        
        // Test the tokens by trying to get profile info
        try {
          await this.gmail.users.getProfile({ userId: 'me' });
          logger.info('Tokens are valid and working');
          return true;
        } catch (error: any) {
          if (error.code === 401) {
            logger.info('Tokens expired, attempting refresh...');
            // Try to refresh the token
            try {
              const { credentials } = await this.oauth2Client.refreshAccessToken();
              this.oauth2Client.setCredentials(credentials);
              this.saveTokens(credentials);
              logger.info('Tokens refreshed successfully');
              return true;
            } catch (refreshError) {
              logger.warn('Token refresh failed, need re-authentication', refreshError as Error);
              return false;
            }
          }
          throw error;
        }
      }
    } catch (error) {
      logger.error('Error loading saved tokens', error as Error);
    }
    return false;
  }

  private loadTokensSync(): any {
    try {
      const tokenPath = path.join(__dirname, '../../credentials/tokens.json');
      if (fs.existsSync(tokenPath)) {
        return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      }
    } catch (error) {
      logger.error('Error loading tokens sync', error as Error);
    }
    return null;
  }

  private saveTokens(tokens: any): void {
    const credentialsDir = path.join(__dirname, '../../credentials');
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const tokenPath = path.join(credentialsDir, 'tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  }

  // Enhanced rate limiting
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
    
    // Check if we're within rate limits
    if (this.requestTimestamps.length >= this.rateLimitConfig.requestsPerSecond) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = 1000 - (now - oldestRequest);
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    
    this.requestTimestamps.push(now);
  }

  // Enhanced search with better error handling and caching
  async searchEmails(query: string, maxResults: number = 100): Promise<any[]> {
    logger.time(`searchEmails-${query}`);
    
    try {
      // Check cache first
      const cachedResults = cacheService.getCachedSearchResults(query);
      if (cachedResults) {
        logger.info(`Cache hit for search: ${query}`);
        logger.timeEnd(`searchEmails-${query}`);
        return cachedResults;
      }

      await this.enforceRateLimit();

      const response = await this.executeWithRetry(async () => {
        return await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
        });
      });

      if (!response.data.messages) {
        logger.timeEnd(`searchEmails-${query}`);
        return [];
      }

      // Use optimized batch processing
      const messageIds = response.data.messages.map((msg: any) => msg.id);
      const emails = await this.getEmailsBatch(messageIds, 25); // Optimized batch size

      // Cache the results with TTL
      cacheService.cacheSearchResults(query, emails);
      logger.info(`Cached search results for: ${query} (${emails.length} emails)`);

      logger.timeEnd(`searchEmails-${query}`);
      return emails;
    } catch (error: any) {
      logger.error(`Error searching emails with query: ${query}`, error);
      logger.timeEnd(`searchEmails-${query}`);
      throw error;
    }
  }

  // Enhanced retry mechanism
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.rateLimitConfig.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt === retries) {
          throw error;
        }

        if (error.code === 429 || error.code === 403) {
          const delay = Math.min(
            this.rateLimitConfig.retryDelay * Math.pow(2, attempt - 1),
            30000 // Max 30 seconds
          );
          logger.warn(`Rate limited, waiting ${delay}ms before retry ${attempt}/${retries}`);
          await this.delay(delay);
          continue;
        }

        if (error.code >= 500) {
          const delay = this.rateLimitConfig.retryDelay * attempt;
          logger.warn(`Server error, waiting ${delay}ms before retry ${attempt}/${retries}`);
          await this.delay(delay);
          continue;
        }

        // For other errors, don't retry
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  async searchEmailsBatch(queries: string[], maxResults: number = 100): Promise<any[]> {
    try {
      // Use batch requests to fetch multiple queries simultaneously
      const allEmails: any[] = [];
      
      // Process queries in batches to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (query) => {
          try {
            const response = await this.gmail.users.messages.list({
              userId: 'me',
              q: query,
              maxResults,
            });
            return response.data.messages || [];
          } catch (error) {
            logger.error(`Error with query "${query}":`, error as Error);
            return [];
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const batchMessages = batchResults.flat();
        
        // Fetch email details in batch
        if (batchMessages.length > 0) {
          const emailBatch = await this.getEmailsBatch(batchMessages.map(m => m.id));
          allEmails.push(...emailBatch);
        }
        
        // Small delay between batches
        if (i + batchSize < queries.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Remove duplicates based on message ID
      const uniqueEmails = allEmails.filter((email, index, self) =>
        index === self.findIndex(e => e.id === email.id)
      );

      return uniqueEmails;
    } catch (error) {
      logger.error('Error in batch search:', error as Error);
      throw error;
    }
  }

  // Optimized batch processing with intelligent batching
  async getEmailsBatch(messageIds: string[], maxBatchSize = 20): Promise<any[]> {
    if (messageIds.length === 0) return [];
    
    logger.time(`getEmailsBatch-${messageIds.length}`);
    const results: any[] = [];
    const errors: string[] = [];
    
    // Process in smaller batches for better rate limiting
    for (let i = 0; i < messageIds.length; i += maxBatchSize) {
      const batchIds = messageIds.slice(i, i + maxBatchSize);
      
      // Use Promise.allSettled for better error handling
      const batchPromises = batchIds.map(async (id) => {
        try {
          await this.enforceRateLimit();
          return await this.executeWithRetry(() => this.getEmailSingle(id));
        } catch (error) {
          errors.push(id);
          logger.warn(`Failed to fetch email ${id}`, error as Error);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      const successfulResults = batchResults
        .filter((result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      results.push(...successfulResults);
      
      // Adaptive delay based on success rate
      if (i + maxBatchSize < messageIds.length) {
        const successRate = successfulResults.length / batchIds.length;
        const delay = successRate < 0.8 ? 50 : 20; // Longer delay if many failures
        await this.delay(delay);
      }
    }
    
    if (errors.length > 0) {
      logger.warn(`Failed to fetch ${errors.length}/${messageIds.length} emails`);
    }
    
    logger.timeEnd(`getEmailsBatch-${messageIds.length}`);
    return results;
  }

  // Single email retrieval with caching
  private async getEmailSingle(messageId: string): Promise<any> {
    // Check cache first
    const cached = cacheService.getCachedEmail(messageId);
    if (cached) {
      return cached;
    }

    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    // Cache the email data
    cacheService.cacheEmail(messageId, response.data);
    return response.data;
  }

  async getSubscriptionEmails(): Promise<any[]> {
    logger.time('getSubscriptionEmails');
    
    const queries = [
      'in:inbox unsubscribe',
      'in:inbox from:noreply',
      'in:inbox from:newsletter',
      'in:inbox subject:newsletter',
      'in:inbox subject:promotional',
      'in:inbox list-unsubscribe'
    ];

    try {
      // Use parallel processing for better performance
      const searchPromises = queries.map(query =>
        this.searchEmails(query, 75).catch(error => {
          logger.warn(`Search failed for query: ${query}`, error as Error);
          return [];
        })
      );

      const allEmailArrays = await Promise.all(searchPromises);
      const allEmails = allEmailArrays.flat();

      // Remove duplicates based on message ID using Map for O(n) performance
      const uniqueEmailsMap = new Map();
      allEmails.forEach(email => {
        if (!uniqueEmailsMap.has(email.id)) {
          uniqueEmailsMap.set(email.id, email);
        }
      });

      const uniqueEmails = Array.from(uniqueEmailsMap.values());
      
      logger.info(`Found ${uniqueEmails.length} unique subscription emails from ${allEmails.length} total`);
      logger.timeEnd('getSubscriptionEmails');
      
      return uniqueEmails;
    } catch (error) {
      logger.error('Error getting subscription emails', error as Error);
      logger.timeEnd('getSubscriptionEmails');
      throw error;
    }
  }

  async getAllEmailsFromSender(senderEmail: string): Promise<any[]> {
    logger.time(`getAllEmailsFromSender-${senderEmail}`);
    
    try {
      logger.info(`Searching for inbox emails from ${senderEmail}`);
      
      // Search for emails from this sender in inbox only (faster and more relevant)
      const query = `in:inbox from:"${senderEmail}"`;
      const emails = await this.searchEmails(query, 500);
      
      logger.info(`Found ${emails.length} inbox emails from ${senderEmail}`);
      logger.timeEnd(`getAllEmailsFromSender-${senderEmail}`);
      return emails;
    } catch (error) {
      logger.error(`Error getting emails from ${senderEmail}`, error as Error);
      logger.timeEnd(`getAllEmailsFromSender-${senderEmail}`);
      return [];
    }
  }

  async getAllEmailsFromDomain(domain: string): Promise<any[]> {
    logger.time(`getAllEmailsFromDomain-${domain}`);
    
    try {
      logger.info(`Searching for inbox emails from domain ${domain}`);
      
      // Search for emails from this domain in inbox only
      const query = `in:inbox from:@${domain}`;
      const emails = await this.searchEmails(query, 500);
      
      logger.info(`Found ${emails.length} inbox emails from domain ${domain}`);
      logger.timeEnd(`getAllEmailsFromDomain-${domain}`);
      return emails;
    } catch (error) {
      logger.error(`Error getting emails from domain ${domain}`, error as Error);
      logger.timeEnd(`getAllEmailsFromDomain-${domain}`);
      return [];
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
  }

  async archiveMessage(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    });
  }

  async archiveMessages(messageIds: string[]): Promise<void> {
    // Archive messages in smaller batches to avoid rate limiting
    const batchSize = 10; // Reduced from 100 to 10
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      
      // Process batch sequentially to avoid concurrent request limits
      for (const id of batch) {
        try {
          await this.archiveMessage(id);
          await this.delay(100); // Small delay between archive operations
        } catch (error: any) {
          if (error.status === 429) {
            logger.debug('Rate limit hit during archiving, waiting 2s...');
            await this.delay(2000);
            // Retry the failed message
            await this.archiveMessage(id);
          } else {
            logger.error(`Failed to archive message ${id}: ${(error as Error).message}`);
          }
        }
      }
      logger.debug(`Archived batch of ${batch.length} messages`);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.gmail.users.messages.delete({
      userId: 'me',
      id: messageId
    });
  }

  async isAuthenticated(): Promise<boolean> {
    return await this.loadSavedTokens();
  }

  async getEmail(messageId: string): Promise<any> {
    try {
      const email = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      return email.data;
    } catch (error) {
      logger.error(`Error getting email ${messageId}:`, error as Error);
      throw error;
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}