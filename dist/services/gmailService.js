"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailService = void 0;
// Load environment variables first
require("../config/env");
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cacheService_1 = require("./cacheService");
const logger_1 = require("../utils/logger");
class GmailService {
    constructor() {
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitConfig = {
            requestsPerSecond: 10,
            burstLimit: 50,
            retryDelay: 1000,
            maxRetries: 3
        };
        this.requestTimestamps = [];
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
        // Set up automatic token refresh with better logging
        this.oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                logger_1.logger.info('New refresh token received, saving...');
                this.saveTokens(tokens);
            }
            else {
                // If no refresh token, merge with existing tokens
                logger_1.logger.info('Access token refreshed');
                const existingTokens = this.loadTokensSync();
                if (existingTokens) {
                    const updatedTokens = { ...existingTokens, ...tokens };
                    this.saveTokens(updatedTokens);
                }
            }
        });
        this.gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
    }
    getAuthUrl() {
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
    async authenticate(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        // Save tokens for future use
        this.saveTokens(tokens);
    }
    async handleAuthCallback(code) {
        return this.authenticate(code);
    }
    async loadSavedTokens() {
        try {
            const tokenPath = path.join(__dirname, '../../credentials/tokens.json');
            if (fs.existsSync(tokenPath)) {
                const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                this.oauth2Client.setCredentials(tokens);
                logger_1.logger.info('Loaded saved tokens successfully');
                // Test the tokens by trying to get profile info
                try {
                    await this.gmail.users.getProfile({ userId: 'me' });
                    logger_1.logger.info('Tokens are valid and working');
                    return true;
                }
                catch (error) {
                    if (error.code === 401) {
                        logger_1.logger.info('Tokens expired, attempting refresh...');
                        // Try to refresh the token
                        try {
                            const { credentials } = await this.oauth2Client.refreshAccessToken();
                            this.oauth2Client.setCredentials(credentials);
                            this.saveTokens(credentials);
                            logger_1.logger.info('Tokens refreshed successfully');
                            return true;
                        }
                        catch (refreshError) {
                            logger_1.logger.warn('Token refresh failed, need re-authentication', refreshError);
                            return false;
                        }
                    }
                    throw error;
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error loading saved tokens', error);
        }
        return false;
    }
    loadTokensSync() {
        try {
            const tokenPath = path.join(__dirname, '../../credentials/tokens.json');
            if (fs.existsSync(tokenPath)) {
                return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            }
        }
        catch (error) {
            logger_1.logger.error('Error loading tokens sync', error);
        }
        return null;
    }
    saveTokens(tokens) {
        const credentialsDir = path.join(__dirname, '../../credentials');
        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }
        const tokenPath = path.join(credentialsDir, 'tokens.json');
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    }
    // Enhanced rate limiting
    async enforceRateLimit() {
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
    async searchEmails(query, maxResults = 100) {
        logger_1.logger.time(`searchEmails-${query}`);
        try {
            // Check cache first
            const cachedResults = cacheService_1.cacheService.getCachedSearchResults(query);
            if (cachedResults) {
                logger_1.logger.info(`Cache hit for search: ${query}`);
                logger_1.logger.timeEnd(`searchEmails-${query}`);
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
                logger_1.logger.timeEnd(`searchEmails-${query}`);
                return [];
            }
            // Use optimized batch processing
            const messageIds = response.data.messages.map((msg) => msg.id);
            const emails = await this.getEmailsBatch(messageIds, 25); // Optimized batch size
            // Cache the results with TTL
            cacheService_1.cacheService.cacheSearchResults(query, emails);
            logger_1.logger.info(`Cached search results for: ${query} (${emails.length} emails)`);
            logger_1.logger.timeEnd(`searchEmails-${query}`);
            return emails;
        }
        catch (error) {
            logger_1.logger.error(`Error searching emails with query: ${query}`, error);
            logger_1.logger.timeEnd(`searchEmails-${query}`);
            throw error;
        }
    }
    // Enhanced retry mechanism
    async executeWithRetry(operation, retries = this.rateLimitConfig.maxRetries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                if (error.code === 429 || error.code === 403) {
                    const delay = Math.min(this.rateLimitConfig.retryDelay * Math.pow(2, attempt - 1), 30000 // Max 30 seconds
                    );
                    logger_1.logger.warn(`Rate limited, waiting ${delay}ms before retry ${attempt}/${retries}`);
                    await this.delay(delay);
                    continue;
                }
                if (error.code >= 500) {
                    const delay = this.rateLimitConfig.retryDelay * attempt;
                    logger_1.logger.warn(`Server error, waiting ${delay}ms before retry ${attempt}/${retries}`);
                    await this.delay(delay);
                    continue;
                }
                // For other errors, don't retry
                throw error;
            }
        }
        throw new Error('Max retries exceeded');
    }
    async searchEmailsBatch(queries, maxResults = 100) {
        try {
            // Use batch requests to fetch multiple queries simultaneously
            const allEmails = [];
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
                    }
                    catch (error) {
                        logger_1.logger.error(`Error with query "${query}":`, error);
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
            const uniqueEmails = allEmails.filter((email, index, self) => index === self.findIndex(e => e.id === email.id));
            return uniqueEmails;
        }
        catch (error) {
            logger_1.logger.error('Error in batch search:', error);
            throw error;
        }
    }
    // Optimized batch processing with intelligent batching
    async getEmailsBatch(messageIds, maxBatchSize = 20) {
        if (messageIds.length === 0)
            return [];
        logger_1.logger.time(`getEmailsBatch-${messageIds.length}`);
        const results = [];
        const errors = [];
        // Process in smaller batches for better rate limiting
        for (let i = 0; i < messageIds.length; i += maxBatchSize) {
            const batchIds = messageIds.slice(i, i + maxBatchSize);
            // Use Promise.allSettled for better error handling
            const batchPromises = batchIds.map(async (id) => {
                try {
                    await this.enforceRateLimit();
                    return await this.executeWithRetry(() => this.getEmailSingle(id));
                }
                catch (error) {
                    errors.push(id);
                    logger_1.logger.warn(`Failed to fetch email ${id}`, error);
                    return null;
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            const successfulResults = batchResults
                .filter((result) => result.status === 'fulfilled' && result.value !== null)
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
            logger_1.logger.warn(`Failed to fetch ${errors.length}/${messageIds.length} emails`);
        }
        logger_1.logger.timeEnd(`getEmailsBatch-${messageIds.length}`);
        return results;
    }
    // Single email retrieval with caching
    async getEmailSingle(messageId) {
        // Check cache first
        const cached = cacheService_1.cacheService.getCachedEmail(messageId);
        if (cached) {
            return cached;
        }
        const response = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });
        // Cache the email data
        cacheService_1.cacheService.cacheEmail(messageId, response.data);
        return response.data;
    }
    async getSubscriptionEmails() {
        logger_1.logger.time('getSubscriptionEmails');
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
            const searchPromises = queries.map(query => this.searchEmails(query, 75).catch(error => {
                logger_1.logger.warn(`Search failed for query: ${query}`, error);
                return [];
            }));
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
            logger_1.logger.info(`Found ${uniqueEmails.length} unique subscription emails from ${allEmails.length} total`);
            logger_1.logger.timeEnd('getSubscriptionEmails');
            return uniqueEmails;
        }
        catch (error) {
            logger_1.logger.error('Error getting subscription emails', error);
            logger_1.logger.timeEnd('getSubscriptionEmails');
            throw error;
        }
    }
    async getAllEmailsFromSender(senderEmail) {
        logger_1.logger.time(`getAllEmailsFromSender-${senderEmail}`);
        try {
            logger_1.logger.info(`Searching for inbox emails from ${senderEmail}`);
            // Search for emails from this sender in inbox only (faster and more relevant)
            const query = `in:inbox from:"${senderEmail}"`;
            const emails = await this.searchEmails(query, 500);
            logger_1.logger.info(`Found ${emails.length} inbox emails from ${senderEmail}`);
            logger_1.logger.timeEnd(`getAllEmailsFromSender-${senderEmail}`);
            return emails;
        }
        catch (error) {
            logger_1.logger.error(`Error getting emails from ${senderEmail}`, error);
            logger_1.logger.timeEnd(`getAllEmailsFromSender-${senderEmail}`);
            return [];
        }
    }
    async getAllEmailsFromDomain(domain) {
        logger_1.logger.time(`getAllEmailsFromDomain-${domain}`);
        try {
            logger_1.logger.info(`Searching for inbox emails from domain ${domain}`);
            // Search for emails from this domain in inbox only
            const query = `in:inbox from:@${domain}`;
            const emails = await this.searchEmails(query, 500);
            logger_1.logger.info(`Found ${emails.length} inbox emails from domain ${domain}`);
            logger_1.logger.timeEnd(`getAllEmailsFromDomain-${domain}`);
            return emails;
        }
        catch (error) {
            logger_1.logger.error(`Error getting emails from domain ${domain}`, error);
            logger_1.logger.timeEnd(`getAllEmailsFromDomain-${domain}`);
            return [];
        }
    }
    async markAsRead(messageId) {
        await this.gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['UNREAD']
            }
        });
    }
    async archiveMessage(messageId) {
        await this.gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['INBOX']
            }
        });
    }
    async archiveMessages(messageIds) {
        // Archive messages in smaller batches to avoid rate limiting
        const batchSize = 10; // Reduced from 100 to 10
        for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            // Process batch sequentially to avoid concurrent request limits
            for (const id of batch) {
                try {
                    await this.archiveMessage(id);
                    await this.delay(100); // Small delay between archive operations
                }
                catch (error) {
                    if (error.status === 429) {
                        logger_1.logger.debug('Rate limit hit during archiving, waiting 2s...');
                        await this.delay(2000);
                        // Retry the failed message
                        await this.archiveMessage(id);
                    }
                    else {
                        logger_1.logger.error(`Failed to archive message ${id}: ${error.message}`);
                    }
                }
            }
            logger_1.logger.debug(`Archived batch of ${batch.length} messages`);
        }
    }
    async deleteMessage(messageId) {
        await this.gmail.users.messages.delete({
            userId: 'me',
            id: messageId
        });
    }
    async isAuthenticated() {
        return await this.loadSavedTokens();
    }
    async getEmail(messageId) {
        try {
            const email = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full',
            });
            return email.data;
        }
        catch (error) {
            logger_1.logger.error(`Error getting email ${messageId}:`, error);
            throw error;
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.GmailService = GmailService;
