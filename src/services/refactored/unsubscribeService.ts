/**
 * Refactored Unsubscribe Service with strategy pattern
 */

import { IUnsubscribeService, UnsubscribeMethod, UnsubscribeResult, BulkUnsubscribeResult, IEmailService } from '../../interfaces/services';
import { EmailData, UnsubscribeInfo } from '../../types';
import { UnsubscribeServiceConfig } from '../../config/serviceConfig';
import { logger } from '../../utils/logger';

/**
 * Email parser for extracting unsubscribe information
 */
class EmailParser {
  /**
   * Extract email body from various formats
   */
  static extractBody(email: EmailData): string {
    let body = '';
    
    try {
      if (email.payload.body?.data) {
        // Simple text body
        body = Buffer.from(email.payload.body.data, 'base64').toString();
      } else if (email.payload.parts) {
        // Multipart email
        body = this.extractMultipartBody(email.payload.parts);
      }
    } catch (error) {
      logger.error('Error extracting email body', error as Error);
    }
    
    return body;
  }

  private static extractMultipartBody(parts: any[]): string {
    let htmlBody = '';
    let textBody = '';
    
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody += Buffer.from(part.body.data, 'base64').toString();
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody += Buffer.from(part.body.data, 'base64').toString();
      } else if (part.parts) {
        // Nested parts
        const nested = this.extractMultipartBody(part.parts);
        if (nested) {
          htmlBody += nested;
        }
      }
    }
    
    // Prefer HTML for better link detection
    return htmlBody || textBody;
  }

  /**
   * Extract header value by name
   */
  static getHeader(email: EmailData, headerName: string): string {
    const header = email.payload.headers.find(
      h => h.name.toLowerCase() === headerName.toLowerCase()
    );
    return header?.value || '';
  }

  /**
   * Extract unsubscribe URLs from email content
   */
  static extractUnsubscribeUrls(content: string): string[] {
    const patterns = [
      // URL patterns in href attributes
      /href=["']([^"']*(?:unsubscribe|unsub|opt-out|optout|remove|preference)[^"']*)/gi,
      // Direct URL patterns
      /https?:\/\/[^\s<>"']*(?:unsubscribe|unsub|opt-out|optout|remove|preference)[^\s<>"']*/gi,
      // Special patterns
      /https?:\/\/[^\s<>"']*\/u\/\d+\/[^\s<>"']*/gi,
      // Mailto patterns
      /mailto:[^\s<>"']*unsubscribe[^\s<>"']*/gi
    ];
    
    const urls = new Set<string>();
    
    for (const pattern of patterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        let url = match;
        
        // Clean up href matches
        if (url.startsWith('href=')) {
          url = url.replace(/href=["']/, '').replace(/["']$/, '');
        }
        
        // Validate URL
        if (url.startsWith('http') || url.startsWith('mailto:')) {
          urls.add(url);
        }
      }
    }
    
    return Array.from(urls);
  }
}

/**
 * Unsubscribe strategy interface
 */
interface IUnsubscribeStrategy {
  canHandle(email: EmailData, info: UnsubscribeInfo): boolean;
  execute(email: EmailData, info: UnsubscribeInfo): Promise<UnsubscribeResult>;
  getPriority(): number;
}

/**
 * List-Unsubscribe header strategy
 */
class ListUnsubscribeStrategy implements IUnsubscribeStrategy {
  canHandle(email: EmailData, info: UnsubscribeInfo): boolean {
    const header = EmailParser.getHeader(email, 'list-unsubscribe');
    return !!header;
  }

  getPriority(): number {
    return 100; // Highest priority
  }

  async execute(email: EmailData, info: UnsubscribeInfo): Promise<UnsubscribeResult> {
    const header = EmailParser.getHeader(email, 'list-unsubscribe');
    const postHeader = EmailParser.getHeader(email, 'list-unsubscribe-post');
    
    // Extract URL from header
    const urlMatch = header.match(/<(https?:\/\/[^>]+)>/);
    if (!urlMatch) {
      return {
        success: false,
        method: UnsubscribeMethod.LIST_UNSUBSCRIBE_HEADER,
        message: 'No valid URL found in List-Unsubscribe header',
        error: 'Invalid header format'
      };
    }
    
    const url = urlMatch[1];
    const method = postHeader ? 'POST' : 'GET';
    
    try {
      const options: RequestInit = {
        method,
        headers: {
          'User-Agent': 'Gmail AI Unsubscriber/1.0',
        },
        signal: AbortSignal.timeout(30000),
      };
      
      if (postHeader && method === 'POST') {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        options.body = postHeader;
      }
      
      const response = await fetch(url, options);
      
      if (response.ok) {
        return {
          success: true,
          method: UnsubscribeMethod.LIST_UNSUBSCRIBE_HEADER,
          message: 'Successfully unsubscribed via List-Unsubscribe header',
          url
        };
      } else {
        return {
          success: false,
          method: UnsubscribeMethod.LIST_UNSUBSCRIBE_HEADER,
          message: `Failed with status: ${response.status}`,
          url,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      logger.error('List-Unsubscribe strategy error', error as Error);
      return {
        success: false,
        method: UnsubscribeMethod.LIST_UNSUBSCRIBE_HEADER,
        message: 'Error executing unsubscribe request',
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Simple link click strategy
 */
class SimpleLinkStrategy implements IUnsubscribeStrategy {
  canHandle(email: EmailData, info: UnsubscribeInfo): boolean {
    return (info.unsubscribeLinks?.length || 0) > 0 && info.complexity === 'simple';
  }

  getPriority(): number {
    return 80;
  }

  async execute(email: EmailData, info: UnsubscribeInfo): Promise<UnsubscribeResult> {
    const url = info.unsubscribeLinks?.[0];
    
    if (!url) {
      return {
        success: false,
        method: UnsubscribeMethod.FORM_AUTOMATION,
        message: 'No unsubscribe link available for simple link strategy',
        error: 'Missing unsubscribe URL'
      };
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Gmail AI Unsubscriber/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });
      
      if (response.ok) {
        return {
          success: true,
          method: UnsubscribeMethod.FORM_AUTOMATION,
          message: 'Successfully accessed unsubscribe link',
          url
        };
      } else {
        return {
          success: false,
          method: UnsubscribeMethod.FORM_AUTOMATION,
          message: `Failed with status: ${response.status}`,
          url,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        method: UnsubscribeMethod.FORM_AUTOMATION,
        message: 'Error accessing unsubscribe link',
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Manual fallback strategy
 */
class ManualFallbackStrategy implements IUnsubscribeStrategy {
  canHandle(): boolean {
    return true; // Always can handle as last resort
  }

  getPriority(): number {
    return 0; // Lowest priority
  }

  async execute(email: EmailData, info: UnsubscribeInfo): Promise<UnsubscribeResult> {
    const from = EmailParser.getHeader(email, 'from');
    
    if ((info.unsubscribeLinks?.length || 0) > 0 && info.unsubscribeLinks?.[0]) {
      return {
        success: false,
        method: UnsubscribeMethod.MANUAL_FALLBACK,
        message: `Manual unsubscribe required. Visit: ${info.unsubscribeLinks[0]}`,
        url: info.unsubscribeLinks[0],
        error: 'Automated unsubscribe not available'
      };
    }
    
    return {
      success: false,
      method: UnsubscribeMethod.MANUAL_FALLBACK,
      message: `No unsubscribe method found for emails from ${from}`,
      error: 'No unsubscribe options detected'
    };
  }
}

/**
 * Refactored Unsubscribe Service
 */
export class RefactoredUnsubscribeService implements IUnsubscribeService {
  private strategies: IUnsubscribeStrategy[] = [];

  constructor(
    private config: UnsubscribeServiceConfig,
    private emailService?: IEmailService
  ) {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Add strategies in order of preference
    this.strategies = [
      new ListUnsubscribeStrategy(),
      new SimpleLinkStrategy(),
      new ManualFallbackStrategy()
    ];
    
    // Sort by priority
    this.strategies.sort((a, b) => b.getPriority() - a.getPriority());
  }

  async analyzeUnsubscribeOptions(email: EmailData): Promise<UnsubscribeInfo> {
    const from = EmailParser.getHeader(email, 'from');
    const subject = EmailParser.getHeader(email, 'subject');
    const listUnsubscribe = EmailParser.getHeader(email, 'list-unsubscribe');
    
    // Extract body and find unsubscribe links
    const body = EmailParser.extractBody(email);
    const unsubscribeLinks = EmailParser.extractUnsubscribeUrls(body);
    
    // Determine complexity
    let complexity: 'simple' | 'medium' | 'complex' = 'complex';
    if (listUnsubscribe) {
      complexity = 'simple';
    } else if (unsubscribeLinks.length === 1) {
      complexity = 'simple';
    } else if (unsubscribeLinks.length > 1) {
      complexity = 'medium';
    }
    
    // Check if it's a marketing email
    const isMarketingEmail = this.isMarketingEmail(from, subject, body);
    
    // Determine best method
    let method = 'none';
    if (listUnsubscribe) {
      method = 'list-unsubscribe-header';
    } else if (unsubscribeLinks.length > 0) {
      method = 'body-link';
    }
    
    return {
      hasUnsubscribeLink: !!listUnsubscribe || unsubscribeLinks.length > 0,
      unsubscribeUrl: unsubscribeLinks[0],
      unsubscribeLinks,
      isMarketingEmail,
      confidence: this.calculateConfidence(!!listUnsubscribe, unsubscribeLinks, isMarketingEmail),
      sender: from,
      subject,
      method,
      complexity
    };
  }

  async performUnsubscribe(
    email: EmailData, 
    method: UnsubscribeMethod
  ): Promise<UnsubscribeResult> {
    const info = await this.analyzeUnsubscribeOptions(email);
    
    // Find appropriate strategy
    for (const strategy of this.strategies) {
      if (strategy.canHandle(email, info)) {
        logger.info(`Using ${strategy.constructor.name} for unsubscribe`);
        return strategy.execute(email, info);
      }
    }
    
    // Should never reach here due to fallback strategy
    return {
      success: false,
      method: UnsubscribeMethod.MANUAL_FALLBACK,
      message: 'No suitable unsubscribe strategy found',
      error: 'Strategy selection failed'
    };
  }

  async performBulkUnsubscribe(
    emailIds: string[], 
    senderDomain: string
  ): Promise<BulkUnsubscribeResult> {
    if (!this.emailService) {
      return {
        success: false,
        method: 'none',
        details: 'Email service not available'
      };
    }
    
    logger.info(`Starting bulk unsubscribe for ${emailIds.length} emails from ${senderDomain}`);
    
    const enhancedResults: UnsubscribeResult[] = [];
    let overallSuccess = false;
    let method = 'archive-only';
    let details = '';
    
    // Try unsubscribe on first email
    if (emailIds.length > 0) {
      try {
        const firstEmail = await this.emailService.getEmail(emailIds[0]);
        const result = await this.performUnsubscribe(firstEmail, UnsubscribeMethod.LIST_UNSUBSCRIBE_HEADER);
        enhancedResults.push(result);
        
        if (result.success) {
          overallSuccess = true;
          method = result.method;
          details = result.message;
        } else {
          // Try to provide manual unsubscribe info
          const info = await this.analyzeUnsubscribeOptions(firstEmail);
          if ((info.unsubscribeLinks?.length || 0) > 0 && info.unsubscribeLinks?.[0]) {
            details = `Manual unsubscribe required: ${info.unsubscribeLinks[0]}`;
          } else {
            details = 'No unsubscribe method found. Emails will be archived.';
          }
        }
      } catch (error) {
        logger.error(`Error processing unsubscribe for ${senderDomain}`, error as Error);
        details = 'Error during unsubscribe attempt';
      }
    }
    
    // Archive emails regardless of unsubscribe success
    let archived = false;
    try {
      await this.emailService.archiveEmails(emailIds);
      archived = true;
      logger.info(`Archived ${emailIds.length} emails from ${senderDomain}`);
    } catch (error) {
      logger.error(`Failed to archive emails from ${senderDomain}`, error as Error);
    }
    
    return {
      success: overallSuccess || archived,
      method,
      details,
      archived,
      enhancedResults: enhancedResults.length > 0 ? enhancedResults : undefined
    };
  }

  private isMarketingEmail(from: string, subject: string, body: string): boolean {
    const indicators = [
      'noreply', 'no-reply', 'newsletter', 'marketing', 
      'promo', 'deals', 'offer', 'sale', 'discount', 
      'update', 'news', 'unsubscribe'
    ];
    
    const combinedText = `${from} ${subject} ${body}`.toLowerCase();
    
    return indicators.some(indicator => combinedText.includes(indicator));
  }

  private calculateConfidence(
    hasListUnsubscribe: boolean,
    unsubscribeLinks: string[],
    isMarketingEmail: boolean
  ): number {
    let confidence = 0.3;
    
    if (hasListUnsubscribe) confidence += 0.4;
    if (unsubscribeLinks.length > 0) confidence += 0.2;
    if (isMarketingEmail) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }
}