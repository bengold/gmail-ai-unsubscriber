export interface PreprocessResult {
  needsAI: boolean;
  confidence: number;
  category: string;
  reasoning: string;
}

export class EmailPreprocessor {
  private static readonly OBVIOUS_JUNK_PATTERNS = [
    // Sender patterns
    /noreply@/i,
    /no-reply@/i,
    /donotreply@/i,
    /newsletter@/i,
    /marketing@/i,
    /promo@/i,
    /notification@/i,
    /updates@/i,
    /info@/i,
    /support@.*\.(shopify|mailchimp|constantcontact|sendgrid)/i,
    
    // Subject patterns
    /unsubscribe/i,
    /promotional/i,
    /newsletter/i,
    /sale|deal|discount|offer|coupon/i,
    /limited time|act now|urgent|expires/i,
    /free|save \$|% off/i,
    /click here|learn more/i,
  ];

  private static readonly LEGITIMATE_PATTERNS = [
    // Personal/work emails
    /@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i,
    // Known legitimate services
    /@(amazon|apple|google|microsoft|paypal|bank|creditcard)\.com$/i,
    // Security/account notifications
    /security alert|password|account|verification/i,
  ];

  private static readonly MARKETING_DOMAINS = [
    'mailchimp.com',
    'constantcontact.com',
    'sendgrid.net',
    'mailgun.org',
    'amazonses.com',
    'sparkpostmail.com',
    'mandrill.com',
  ];

  static preprocess(email: any): PreprocessResult {
    const headers = email.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const snippet = email.snippet || '';
    
    // Extract sender domain
    const senderDomain = this.extractDomain(from);
    
    // Check for obvious junk patterns
    const junkScore = this.calculateJunkScore(subject, from, snippet, senderDomain);
    
    // Check for legitimate patterns
    const legitimateScore = this.calculateLegitimateScore(subject, from, snippet);
    
    // Decision logic
    if (junkScore >= 3) {
      const confidence = this.calculateConfidenceScore(email, 1, snippet.toLowerCase().includes('unsubscribe'));
      return {
        needsAI: false,
        confidence: confidence,
        category: 'marketing',
        reasoning: `High junk score (${junkScore}) based on sender/subject patterns`
      };
    }
    
    if (legitimateScore >= 2) {
      return {
        needsAI: false,
        confidence: Math.min(0.6 + legitimateScore * 0.1, 0.9),
        category: 'legitimate',
        reasoning: `High legitimate score (${legitimateScore}) based on sender patterns`
      };
    }
    
    // Ambiguous - needs AI analysis
    return {
      needsAI: true,
      confidence: 0,
      category: 'unknown',
      reasoning: 'Requires AI analysis for accurate classification'
    };
  }

  static calculateConfidenceScore(email: any, groupSize: number = 1, hasUnsubscribeLink: boolean = false): number {
    const headers = email.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const snippet = email.snippet || '';
    
    // Extract sender domain
    const senderDomain = this.extractDomain(from);
    
    // Base confidence starts at 50%
    let confidence = 0.5;
    
    // Factor 1: Sender patterns (0-30% boost)
    const junkScore = this.calculateJunkScore(subject, from, snippet, senderDomain);
    confidence += Math.min(junkScore * 0.08, 0.3);
    
    // Factor 2: Group size - more emails from same sender = higher confidence (0-20% boost)
    if (groupSize > 1) {
      const groupBonus = Math.min((groupSize - 1) * 0.05, 0.2);
      confidence += groupBonus;
    }
    
    // Factor 3: Unsubscribe link presence (10% boost)
    if (hasUnsubscribeLink) {
      confidence += 0.1;
    }
    
    // Factor 4: Marketing domain boost (15% boost)
    if (this.MARKETING_DOMAINS.some(d => senderDomain.includes(d))) {
      confidence += 0.15;
    }
    
    // Factor 5: Email age - older promotional emails are more likely to be junk (0-10% boost)
    try {
      const emailDate = new Date(parseInt(email.internalDate));
      const daysSinceEmail = (Date.now() - emailDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEmail > 30) {
        confidence += Math.min(daysSinceEmail / 365 * 0.1, 0.1);
      }
    } catch (error) {
      // Ignore date parsing errors
    }
    
    // Factor 6: Promotional language in subject/snippet (0-15% boost)
    const promoWords = ['sale', 'deal', 'offer', 'discount', 'free', 'limited time', 'act now', 'expires'];
    const promoCount = promoWords.filter(word => 
      subject.toLowerCase().includes(word) || snippet.toLowerCase().includes(word)
    ).length;
    confidence += Math.min(promoCount * 0.03, 0.15);
    
    // Factor 7: Newsletter/automation patterns (10% boost)
    const automationPatterns = ['newsletter', 'automated', 'no-reply', 'noreply', 'donotreply'];
    const hasAutomationPattern = automationPatterns.some(pattern => 
      from.toLowerCase().includes(pattern) || subject.toLowerCase().includes(pattern)
    );
    if (hasAutomationPattern) {
      confidence += 0.1;
    }
    
    // Cap confidence between 0.3 and 0.95
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private static calculateJunkScore(subject: string, from: string, snippet: string, domain: string): number {
    let score = 0;
    
    // Check sender patterns
    for (const pattern of this.OBVIOUS_JUNK_PATTERNS) {
      if (pattern.test(from) || pattern.test(subject)) {
        score++;
      }
    }
    
    // Check marketing domains
    if (this.MARKETING_DOMAINS.some(d => domain.includes(d))) {
      score += 2;
    }
    
    // Check for unsubscribe links in snippet
    if (snippet.toLowerCase().includes('unsubscribe')) {
      score++;
    }
    
    // Check for promotional language
    const promoWords = ['sale', 'deal', 'offer', 'discount', 'free', 'limited time'];
    const promoCount = promoWords.filter(word => 
      subject.toLowerCase().includes(word) || snippet.toLowerCase().includes(word)
    ).length;
    score += Math.min(promoCount, 2);
    
    return score;
  }

  private static calculateLegitimateScore(subject: string, from: string, snippet: string): number {
    let score = 0;
    
    // Check legitimate patterns
    for (const pattern of this.LEGITIMATE_PATTERNS) {
      if (pattern.test(from) || pattern.test(subject)) {
        score++;
      }
    }
    
    // Personal-looking emails (not automated)
    if (!from.includes('noreply') && !from.includes('no-reply')) {
      score++;
    }
    
    return score;
  }

  private static extractDomain(fromHeader: string): string {
    const match = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
    if (match) {
      const email = match[1] || match[0];
      const domain = email.split('@')[1];
      return domain || 'unknown';
    }
    return 'unknown';
  }
}
