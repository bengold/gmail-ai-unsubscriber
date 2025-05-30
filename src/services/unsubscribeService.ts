import { UnsubscribeInfo } from '../types';
import { GmailService } from './gmailService';

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
    
    if (listUnsubscribeHeader) {
      // Extract URL from List-Unsubscribe header
      // Format can be: <mailto:unsub@example.com>, <http://example.com/unsub>
      const urlMatch = listUnsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
      if (urlMatch) {
        unsubscribeUrl = urlMatch[1];
        hasUnsubscribeLink = true;
      } else {
        // Check for mailto unsubscribe
        const mailtoMatch = listUnsubscribeHeader.match(/<mailto:([^>]+)>/);
        if (mailtoMatch) {
          unsubscribeUrl = `mailto:${mailtoMatch[1]}`;
          hasUnsubscribeLink = true;
        }
      }
    }
    
    // If no header found, try to extract from email body
    if (!hasUnsubscribeLink) {
      const body = this.extractEmailBody(email);
      const bodyUrl = this.extractUnsubscribeLinkFromBody(body);
      if (bodyUrl) {
        unsubscribeUrl = bodyUrl;
        hasUnsubscribeLink = true;
      }
    }
    
    // Determine if it's a marketing email
    const isMarketingEmail = this.isMarketingEmail(from, subject, listUnsubscribeHeader);
    
    return {
      hasUnsubscribeLink,
      unsubscribeUrl,
      isMarketingEmail,
      confidence: hasUnsubscribeLink ? 0.9 : 0.3,
      sender: from,
      subject
    };
  }

  private extractEmailBody(email: any): string {
    let body = '';
    
    if (email.payload.body?.data) {
      // Simple text body
      body = Buffer.from(email.payload.body.data, 'base64').toString();
    } else if (email.payload.parts) {
      // Multipart email
      for (const part of email.payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }
    }
    
    return body;
  }

  private extractUnsubscribeLinkFromBody(body: string): string | null {
    // Common unsubscribe link patterns
    const patterns = [
      /https?:\/\/[^\s<>"']+unsubscribe[^\s<>"']*/i,
      /https?:\/\/[^\s<>"']+unsub[^\s<>"']*/i,
      /https?:\/\/[^\s<>"']+opt-out[^\s<>"']*/i,
      /https?:\/\/[^\s<>"']+optout[^\s<>"']*/i,
      /href=["']([^"']+unsubscribe[^"']*)/i,
      /href=["']([^"']+unsub[^"']*)/i
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
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
    console.log(`Simulating unsubscribe from: ${unsubscribeInfo.sender}`);
    return true; // Simulated success
  }

  async performBulkUnsubscribe(emailIds: string[], senderDomain: string, gmailService?: GmailService): Promise<{
    success: boolean;
    method: string;
    details?: string;
    archived?: boolean;
  }> {
    console.log(`🚫 Performing bulk unsubscribe from ${senderDomain} for ${emailIds.length} emails`);
    
    if (!gmailService) {
      return { success: false, method: 'none', details: 'Gmail service not available' };
    }

    let unsubscribeInfo: UnsubscribeInfo | null = null;
    let method = 'archive-only';
    let success = false;
    let details = '';

    // Get unsubscribe info from the first email to determine method
    if (emailIds.length > 0) {
      try {
        // Fetch the first email to get unsubscribe information
        const firstEmail = await gmailService.getEmail(emailIds[0]);
        unsubscribeInfo = await this.findUnsubscribeMethod(firstEmail);
        
        if (unsubscribeInfo.hasUnsubscribeLink && unsubscribeInfo.unsubscribeUrl) {
          if (unsubscribeInfo.unsubscribeUrl.startsWith('http')) {
            method = 'link';
            details = `Unsubscribe link: ${unsubscribeInfo.unsubscribeUrl}`;
            // Note: We don't automatically open the link for security reasons
            // The user can manually click it if they want
            success = true;
          } else if (unsubscribeInfo.unsubscribeUrl.startsWith('mailto:')) {
            method = 'email';
            details = `Send unsubscribe email to: ${unsubscribeInfo.unsubscribeUrl.replace('mailto:', '')}`;
            success = true;
          }
        } else {
          method = 'archive-only';
          details = 'No unsubscribe link found. Emails will be archived to reduce clutter.';
          success = true;
        }
      } catch (error) {
        console.error(`Error getting unsubscribe info for ${senderDomain}:`, error);
        method = 'archive-only';
        details = 'Could not determine unsubscribe method. Emails will be archived.';
        success = true;
      }
    }
    
    let archived = false;
    
    // Always archive the emails to reduce inbox clutter
    if (success && gmailService && emailIds.length > 0) {
      try {
        console.log(`📦 Archiving ${emailIds.length} emails from ${senderDomain}...`);
        await gmailService.archiveMessages(emailIds);
        archived = true;
        console.log(`✅ Successfully archived ${emailIds.length} emails from ${senderDomain}`);
      } catch (error) {
        console.error(`❌ Failed to archive emails from ${senderDomain}:`, error);
        details += ' (Note: Failed to archive emails)';
      }
    }

    return {
      success,
      method,
      details,
      archived
    };
  }
}