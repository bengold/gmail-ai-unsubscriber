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
class GmailService {
    constructor() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
        // Set up automatic token refresh
        this.oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                console.log('🔄 New refresh token received, saving...');
                this.saveTokens(tokens);
            }
            else {
                // If no refresh token, merge with existing tokens
                console.log('🔄 Access token refreshed');
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
                console.log('✅ Loaded saved tokens successfully');
                // Test the tokens by trying to get profile info
                try {
                    await this.gmail.users.getProfile({ userId: 'me' });
                    console.log('✅ Tokens are valid and working');
                    return true;
                }
                catch (error) {
                    if (error.code === 401) {
                        console.log('🔄 Tokens expired, attempting refresh...');
                        // Try to refresh the token
                        try {
                            const { credentials } = await this.oauth2Client.refreshAccessToken();
                            this.oauth2Client.setCredentials(credentials);
                            this.saveTokens(credentials);
                            console.log('✅ Tokens refreshed successfully');
                            return true;
                        }
                        catch (refreshError) {
                            console.log('❌ Token refresh failed, need re-authentication');
                            return false;
                        }
                    }
                    throw error;
                }
            }
        }
        catch (error) {
            console.error('Error loading saved tokens:', error);
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
            console.error('Error loading tokens sync:', error);
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
    async searchEmails(query, maxResults = 100) {
        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults,
            });
            if (!response.data.messages) {
                return [];
            }
            const emails = await Promise.all(response.data.messages.map(async (message) => {
                const email = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full',
                });
                return email.data;
            }));
            return emails;
        }
        catch (error) {
            console.error('Error searching emails:', error);
            throw error;
        }
    }
    async getSubscriptionEmails() {
        const queries = [
            'in:inbox unsubscribe',
            'in:inbox from:noreply',
            'in:inbox from:newsletter',
            'in:inbox subject:newsletter',
            'in:inbox subject:promotional'
        ];
        const allEmails = [];
        for (const query of queries) {
            const emails = await this.searchEmails(query, 50);
            allEmails.push(...emails);
        }
        // Remove duplicates based on message ID
        const uniqueEmails = allEmails.filter((email, index, self) => index === self.findIndex(e => e.id === email.id));
        return uniqueEmails;
    }
    async getAllEmailsFromSender(senderEmail) {
        try {
            console.log(`🔍 Searching for ALL emails from ${senderEmail}...`);
            // Search for emails from this sender (not limited to inbox)
            const query = `from:${senderEmail}`;
            const emails = await this.searchEmails(query, 500); // Higher limit for complete collection
            console.log(`📧 Found ${emails.length} total emails from ${senderEmail}`);
            return emails;
        }
        catch (error) {
            console.error(`Error getting all emails from ${senderEmail}:`, error);
            return [];
        }
    }
    async getAllEmailsFromDomain(domain) {
        try {
            console.log(`🔍 Searching for ALL emails from domain ${domain}...`);
            // Search for emails from this domain
            const query = `from:@${domain}`;
            const emails = await this.searchEmails(query, 500); // Higher limit for complete collection
            console.log(`📧 Found ${emails.length} total emails from domain ${domain}`);
            return emails;
        }
        catch (error) {
            console.error(`Error getting all emails from domain ${domain}:`, error);
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
        // Archive messages in batches to avoid API limits
        const batchSize = 100;
        for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            await Promise.all(batch.map(id => this.archiveMessage(id)));
            console.log(`📦 Archived batch of ${batch.length} messages`);
        }
    }
    async deleteMessage(messageId) {
        await this.gmail.users.messages.delete({
            userId: 'me',
            id: messageId
        });
    }
}
exports.GmailService = GmailService;
