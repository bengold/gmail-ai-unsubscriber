import { UnsubscribeInfo } from '../types';
import { GmailService } from './gmailService';
import { claudeService, UnsubscribeResult } from './claudeService';
import { logger } from '../utils/logger';

export class UnsubscribeService {
  async findUnsubscribeMethod(email: any): Promise<UnsubscribeInfo> {
    const headers = email.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    
    // Look for List-Unsubscribe header (RFC 2369)
    const listUnsubscribeHeader = headers.find((h: any) => 
      h.name.toLowerCase() === 'list-unsubscribe'
    )?.value || '';
    
    let unsubscribeUrl = '';
    let hasUnsubscribeLink = false;
    let method = 'none';
    
    logger.info(`Analyzing unsubscribe options for email from ${from}`);
    
    if (listUnsubscribeHeader) {
      logger.info(`Found List-Unsubscribe header: ${listUnsubscribeHeader}`);
      // Extract URL from List-Unsubscribe header
      // Format can be: <mailto:unsub@example.com>, <http://example.com/unsub>
      const urlMatch = listUnsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
      if (urlMatch) {
        unsubscribeUrl = urlMatch[1];
        hasUnsubscribeLink = true;
        method = 'list-unsubscribe-header';
        logger.info(`Extracted URL from header: ${unsubscribeUrl}`);
      } else {
        // Check for mailto unsubscribe
        const mailtoMatch = listUnsubscribeHeader.match(/<mailto:([^>]+)>/);
        if (mailtoMatch) {
          unsubscribeUrl = `mailto:${mailtoMatch[1]}`;
          hasUnsubscribeLink = true;
          method = 'list-unsubscribe-mailto';
          logger.info(`Extracted mailto from header: ${unsubscribeUrl}`);
        }
      }
    }
    
    // If no header found, try to extract from email body
    if (!hasUnsubscribeLink) {
      logger.info('No List-Unsubscribe header found, searching email body...');
      const body = this.extractEmailBody(email);
      const bodyUrl = this.extractUnsubscribeLinkFromBody(body);
      if (bodyUrl) {
        unsubscribeUrl = bodyUrl;
        hasUnsubscribeLink = true;
        method = 'body-link';
        logger.info(`Found unsubscribe link in body: ${unsubscribeUrl}`);
      } else {
        logger.warn(`No unsubscribe link found in email body for ${from}`);
      }
    }
    
    // Determine if it's a marketing email
    const isMarketingEmail = this.isMarketingEmail(from, subject, listUnsubscribeHeader);
    
    const result = {
      hasUnsubscribeLink,
      unsubscribeUrl,
      unsubscribeLinks: unsubscribeUrl ? [unsubscribeUrl] : [],
      isMarketingEmail,
      confidence: hasUnsubscribeLink ? 0.9 : 0.3,
      sender: from,
      subject,
      method
    };
    
    logger.info(`Unsubscribe analysis result: ${JSON.stringify(result)}`);
    return result;
  }

  private extractEmailBody(email: any): string {
    let body = '';
    
    try {
      if (email.payload.body?.data) {
        // Simple text body
        body = Buffer.from(email.payload.body.data, 'base64').toString();
        logger.info('Extracted body from simple text format');
      } else if (email.payload.parts) {
        // Multipart email - prioritize HTML content for better link detection
        let htmlBody = '';
        let textBody = '';
        
        for (const part of email.payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody += Buffer.from(part.body.data, 'base64').toString();
          } else if (part.mimeType === 'text/plain' && part.body?.data) {
            textBody += Buffer.from(part.body.data, 'base64').toString();
          } else if (part.parts) {
            // Nested parts (e.g., alternative content)
            for (const nestedPart of part.parts) {
              if (nestedPart.mimeType === 'text/html' && nestedPart.body?.data) {
                htmlBody += Buffer.from(nestedPart.body.data, 'base64').toString();
              } else if (nestedPart.mimeType === 'text/plain' && nestedPart.body?.data) {
                textBody += Buffer.from(nestedPart.body.data, 'base64').toString();
              }
            }
          }
        }
        
        // Prefer HTML body for better link detection, fall back to text
        body = htmlBody || textBody;
        logger.info(`Extracted body from multipart format: HTML=${htmlBody.length} chars, Text=${textBody.length} chars`);
      }
      
      if (!body) {
        logger.warn('No email body content found');
      } else {
        logger.info(`Total extracted body length: ${body.length} characters`);
      }
    } catch (error) {
      logger.error(`Error extracting email body: ${error}`);
    }
    
    return body;
  }

  private extractUnsubscribeLinkFromBody(body: string): string | null {
    if (!body || body.trim().length === 0) {
      logger.warn('Email body is empty or null');
      return null;
    }
    
    logger.info(`Searching for unsubscribe links in body (${body.length} characters)`);
    
    // Enhanced unsubscribe link patterns with more comprehensive detection
    const patterns = [
      // URL patterns in href attributes
      /href=["']([^"']*unsubscribe[^"']*)/ig,
      /href=["']([^"']*unsub[^"']*)/ig,
      /href=["']([^"']*opt-out[^"']*)/ig,
      /href=["']([^"']*optout[^"']*)/ig,
      /href=["']([^"']*remove[^"']*)/ig,
      /href=["']([^"']*preference[^"']*)/ig,
      
      // Direct URL patterns
      /https?:\/\/[^\s<>"']*unsubscribe[^\s<>"']*/ig,
      /https?:\/\/[^\s<>"']*unsub[^\s<>"']*/ig,
      /https?:\/\/[^\s<>"']*opt-out[^\s<>"']*/ig,
      /https?:\/\/[^\s<>"']*optout[^\s<>"']*/ig,
      /https?:\/\/[^\s<>"']*remove[^\s<>"']*/ig,
      /https?:\/\/[^\s<>"']*preference[^\s<>"']*/ig,
      
      // Special pattern for Gmail's encoded URLs
      /https?:\/\/[^\s<>"']*u\/\d+\/[^\s<>"']*/ig,
      
      // Mailto patterns
      /mailto:[^\s<>"']*unsubscribe[^\s<>"']*/ig
    ];
    
    let foundUrls: string[] = [];
    
    for (const pattern of patterns) {
      const matches = body.match(pattern);
      if (matches) {
        for (const match of matches) {
          let url = match;
          
          // Clean up href matches
          if (url.startsWith('href=')) {
            url = url.replace(/href=["']/, '').replace(/["']$/, '');
          }
          
          // Validate URL format
          if (url.startsWith('http') || url.startsWith('mailto:')) {
            foundUrls.push(url);
            logger.info(`Found potential unsubscribe URL: ${url}`);
          }
        }
      }
    }
    
    // Remove duplicates and prioritize
    foundUrls = [...new Set(foundUrls)];
    
    if (foundUrls.length === 0) {
      logger.warn('No unsubscribe links found in email body');
      return null;
    }
    
    // Prioritize URLs (prefer unsubscribe over unsub, etc.)
    const prioritizedUrl = foundUrls.find(url => url.toLowerCase().includes('unsubscribe')) ||
                          foundUrls.find(url => url.toLowerCase().includes('opt-out')) ||
                          foundUrls.find(url => url.toLowerCase().includes('remove')) ||
                          foundUrls[0];
    
    logger.info(`Selected unsubscribe URL: ${prioritizedUrl}`);
    return prioritizedUrl;
  }

  private isMarketingEmail(from: string, subject: string, listUnsubscribe: string): boolean {
    const marketingIndicators = [
      'noreply', 'no-reply', 'newsletter', 'marketing', 'promo', 'deals',
      'offer', 'sale', 'discount', 'update', 'news'
    ];
    
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();
    
    const hasMarketingKeywords = marketingIndicators.some(indicator => 
      fromLower.includes(indicator) || subjectLower.includes(indicator)
    );
    
    const hasUnsubscribeHeader = !!listUnsubscribe;
    
    return hasMarketingKeywords || hasUnsubscribeHeader;
  }

  async performUnsubscribe(unsubscribeInfo: UnsubscribeInfo): Promise<boolean> {
    logger.debug(`Simulating unsubscribe from: ${unsubscribeInfo.sender}`);
    return true; // Simulated success
  }

  /**
   * Enhanced unsubscribe using Claude AI for better reliability
   */
  async performEnhancedUnsubscribe(emailId: string, gmailService: GmailService): Promise<UnsubscribeResult> {
    try {
      logger.info(`Starting enhanced unsubscribe for email ${emailId}`);
      
      // Get the email details
      const email = await gmailService.getEmail(emailId);
      const headers = email.payload.headers;
      const emailContent = this.extractEmailBody(email);
      
      // Convert headers to object for easier access
      const headerObj: Record<string, string> = {};
      headers.forEach((header: any) => {
        headerObj[header.name.toLowerCase()] = header.value;
      });
      
      // Use Claude to analyze unsubscribe options
      const analysis = await claudeService.analyzeUnsubscribeOptions(emailContent, headerObj);
      
      logger.info(`Unsubscribe analysis for ${emailId}: ${analysis.complexity} complexity, ${analysis.unsubscribeLinks.length} links found`);
      
      // Attempt unsubscribe using the best method
      const result = await claudeService.attemptUnsubscribe(emailId, analysis);
      
      if (result.success) {
        logger.info(`Successfully unsubscribed from email ${emailId} using method: ${result.method}`);
      } else {
        logger.warn(`Failed to unsubscribe from email ${emailId}: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in enhanced unsubscribe for email ${emailId}: ${error}`);
      return {
        success: false,
        method: 'manual-fallback',
        message: 'Error during enhanced unsubscribe process',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async performBulkUnsubscribe(emailIds: string[], senderDomain: string, gmailService?: GmailService): Promise<{
    success: boolean;
    method: string;
    details?: string;
    archived?: boolean;
    enhancedResults?: UnsubscribeResult[];
  }> {
    logger.info(`Performing bulk unsubscribe from ${senderDomain} for ${emailIds.length} emails`);
    
    if (!gmailService) {
      return { success: false, method: 'none', details: 'Gmail service not available' };
    }

    let unsubscribeInfo: UnsubscribeInfo | null = null;
    let method = 'archive-only';
    let success = false;
    let details = '';
    const enhancedResults: UnsubscribeResult[] = [];

    // Get unsubscribe info from the first email to determine method
    if (emailIds.length > 0) {
      try {
        // Try enhanced unsubscribe on the first email as a test
        const enhancedResult = await this.performEnhancedUnsubscribe(emailIds[0], gmailService);
        enhancedResults.push(enhancedResult);
        
        if (enhancedResult.success) {
          method = enhancedResult.method;
          success = true;
          details = enhancedResult.message;
          
          // If the first email was successful with an automated method, 
          // we can assume similar emails from the same sender will work the same way
          if (enhancedResult.method === 'list-unsubscribe-header' && emailIds.length > 1) {
            details += ` (Processed ${emailIds.length} emails from ${senderDomain})`;
          }
        } else {
          // Fallback to the original method
          const firstEmail = await gmailService.getEmail(emailIds[0]);
          unsubscribeInfo = await this.findUnsubscribeMethod(firstEmail);
          
          if (unsubscribeInfo.hasUnsubscribeLink && unsubscribeInfo.unsubscribeUrl) {
            if (unsubscribeInfo.unsubscribeUrl.startsWith('http')) {
              method = 'link';
              details = `Enhanced unsubscribe failed. Manual unsubscribe link: ${unsubscribeInfo.unsubscribeUrl}`;
              success = true;
            } else if (unsubscribeInfo.unsubscribeUrl.startsWith('mailto:')) {
              method = 'email';
              details = `Enhanced unsubscribe failed. Send unsubscribe email to: ${unsubscribeInfo.unsubscribeUrl.replace('mailto:', '')}`;
              success = true;
            }
          } else {
            method = 'archive-only';
            details = enhancedResult.message + ' No unsubscribe link found. Emails will be archived to reduce clutter.';
            success = true;
          }
        }
      } catch (error) {
        logger.error(`Error getting unsubscribe info for ${senderDomain}:`, error as Error);
        method = 'archive-only';
        details = 'Could not determine unsubscribe method. Emails will be archived.';
        success = true;
      }
    }
    
    let archived = false;
    
    // Always archive the emails to reduce inbox clutter
    if (success && gmailService && emailIds.length > 0) {
      try {
        logger.info(`Archiving ${emailIds.length} emails from ${senderDomain}...`);
        await gmailService.archiveMessages(emailIds);
        archived = true;
        logger.info(`Successfully archived ${emailIds.length} emails from ${senderDomain}`);
      } catch (error) {
        logger.error(`Failed to archive emails from ${senderDomain}:`, error as Error);
        details += ' (Note: Failed to archive emails)';
      }
    }

    return {
      success,
      method,
      details,
      archived,
      enhancedResults: enhancedResults.length > 0 ? enhancedResults : undefined
    };
  }
}