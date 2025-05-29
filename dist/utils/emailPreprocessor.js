"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailPreprocessor = void 0;
class EmailPreprocessor {
    static preprocess(email) {
        const headers = email.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const snippet = email.snippet || '';
        // Extract sender domain
        const senderDomain = this.extractDomain(from);
        // Check for obvious junk patterns
        const junkScore = this.calculateJunkScore(subject, from, snippet, senderDomain);
        // Check for legitimate patterns
        const legitimateScore = this.calculateLegitimateScore(subject, from, snippet);
        // Decision logic
        if (junkScore >= 3) {
            return {
                needsAI: false,
                confidence: Math.min(0.7 + (junkScore - 3) * 0.1, 0.95),
                category: 'marketing',
                reasoning: 'High junk score based on sender/subject patterns'
            };
        }
        if (legitimateScore >= 2) {
            return {
                needsAI: false,
                confidence: Math.min(0.6 + legitimateScore * 0.1, 0.9),
                category: 'legitimate',
                reasoning: 'High legitimate score based on sender patterns'
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
    static calculateJunkScore(subject, from, snippet, domain) {
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
        const promoCount = promoWords.filter(word => subject.toLowerCase().includes(word) || snippet.toLowerCase().includes(word)).length;
        score += Math.min(promoCount, 2);
        return score;
    }
    static calculateLegitimateScore(subject, from, snippet) {
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
    static extractDomain(fromHeader) {
        const match = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
        if (match) {
            const email = match[1] || match[0];
            const domain = email.split('@')[1];
            return domain || 'unknown';
        }
        return 'unknown';
    }
}
exports.EmailPreprocessor = EmailPreprocessor;
EmailPreprocessor.OBVIOUS_JUNK_PATTERNS = [
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
EmailPreprocessor.LEGITIMATE_PATTERNS = [
    // Personal/work emails
    /@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i,
    // Known legitimate services
    /@(amazon|apple|google|microsoft|paypal|bank|creditcard)\.com$/i,
    // Security/account notifications
    /security alert|password|account|verification/i,
];
EmailPreprocessor.MARKETING_DOMAINS = [
    'mailchimp.com',
    'constantcontact.com',
    'sendgrid.net',
    'mailgun.org',
    'amazonses.com',
    'sparkpostmail.com',
    'mandrill.com',
];
