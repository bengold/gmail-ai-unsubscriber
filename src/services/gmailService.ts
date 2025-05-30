// Load environment variables first
import '../config/env';

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set up automatic token refresh
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        console.log('🔄 New refresh token received, saving...');
        this.saveTokens(tokens);
      } else {
        // If no refresh token, merge with existing tokens
        console.log('🔄 Access token refreshed');
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
        console.log('✅ Loaded saved tokens successfully');
        
        // Test the tokens by trying to get profile info
        try {
          await this.gmail.users.getProfile({ userId: 'me' });
          console.log('✅ Tokens are valid and working');
          return true;
        } catch (error: any) {
          if (error.code === 401) {
            console.log('🔄 Tokens expired, attempting refresh...');
            // Try to refresh the token
            try {
              const { credentials } = await this.oauth2Client.refreshAccessToken();
              this.oauth2Client.setCredentials(credentials);
              this.saveTokens(credentials);
              console.log('✅ Tokens refreshed successfully');
              return true;
            } catch (refreshError) {
              console.log('❌ Token refresh failed, need re-authentication');
              return false;
            }
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Error loading saved tokens:', error);
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
      console.error('Error loading tokens sync:', error);
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

  async searchEmails(query: string, maxResults: number = 100): Promise<any[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      if (!response.data.messages) {
        return [];
      }

      // Process emails sequentially to avoid rate limiting
      const emails: any[] = [];
      for (const message of response.data.messages) {
        try {
          const email = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });
          emails.push(email.data);
          
          // Reduced delay for inbox-only searches (faster and less API load)
          await new Promise(resolve => setTimeout(resolve, 25));
        } catch (error: any) {
          if (error.status === 429 || error.status === 403) {
            console.log('⏱️ Rate limit hit, waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Retry the request
            try {
              const email = await this.gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full',
              });
              emails.push(email.data);
            } catch (retryError) {
              console.error(`Failed to get email ${message.id} after retry:`, retryError);
            }
          } else {
            console.error(`Error getting email ${message.id}:`, error);
          }
        }
      }

      return emails;
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  async getSubscriptionEmails(): Promise<any[]> {
    const queries = [
      'in:inbox unsubscribe',
      'in:inbox from:noreply',
      'in:inbox from:newsletter', 
      'in:inbox subject:newsletter',
      'in:inbox subject:promotional'
    ];

    const allEmails: any[] = [];
    
    for (const query of queries) {
      const emails = await this.searchEmails(query, 50);
      allEmails.push(...emails);
    }

    // Remove duplicates based on message ID
    const uniqueEmails = allEmails.filter((email, index, self) =>
      index === self.findIndex(e => e.id === email.id)
    );

    return uniqueEmails;
  }

  async getAllEmailsFromSender(senderEmail: string): Promise<any[]> {
    try {
      console.log(`🔍 Searching for inbox emails from ${senderEmail}...`);
      
      // Search for emails from this sender in inbox only (faster and more relevant)
      const query = `in:inbox from:${senderEmail}`;
      const emails = await this.searchEmails(query, 500); // Higher limit for complete collection
      
      console.log(`📧 Found ${emails.length} inbox emails from ${senderEmail}`);
      return emails;
    } catch (error) {
      console.error(`Error getting emails from ${senderEmail}:`, error);
      return [];
    }
  }

  async getAllEmailsFromDomain(domain: string): Promise<any[]> {
    try {
      console.log(`🔍 Searching for inbox emails from domain ${domain}...`);
      
      // Search for emails from this domain in inbox only (faster and more relevant)
      const query = `in:inbox from:@${domain}`;
      const emails = await this.searchEmails(query, 500); // Higher limit for complete collection
      
      console.log(`📧 Found ${emails.length} inbox emails from domain ${domain}`);
      return emails;
    } catch (error) {
      console.error(`Error getting emails from domain ${domain}:`, error);
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
    // Archive messages in batches to avoid API limits
    const batchSize = 100;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      await Promise.all(batch.map(id => this.archiveMessage(id)));
      console.log(`📦 Archived batch of ${batch.length} messages`);
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
      console.error(`Error getting email ${messageId}:`, error);
      throw error;
    }
  }
}