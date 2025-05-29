import OpenAI from 'openai';
import { AIAnalysisResult } from '../types';

export class AIService {
  private openai: OpenAI | null;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private rateLimitDelay: number = 1000; // Start with 1 second delay

  constructor() {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      console.warn('OpenAI API key not provided. AI analysis will use mock data.');
      this.openai = null;
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async handleRateLimitError(error: any, retryCount: number = 0): Promise<AIAnalysisResult | null> {
    if (error.code === 'rate_limit_exceeded' && retryCount < 3) {
      // Exponential backoff: 2s, 4s, 8s
      const backoffDelay = Math.pow(2, retryCount + 1) * 1000;
      console.log(`🚫 Rate limit hit. Retrying in ${backoffDelay/1000}s... (attempt ${retryCount + 1}/3)`);
      
      // Increase the global rate limit delay
      this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 5000);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return null; // Signal to retry
    }
    
    console.log(`❌ Rate limit exceeded. Falling back to mock analysis after ${retryCount} retries.`);
    return null; // Will trigger fallback to mock
  }

  async analyzeEmail(email: any): Promise<AIAnalysisResult> {
    if (!this.openai) {
      // Return mock analysis when OpenAI is not available
      return this.getMockAnalysis(email);
    }

    // Rate limiting
    await this.waitForRateLimit();
    this.requestCount++;

    for (let retryCount = 0; retryCount < 3; retryCount++) {
      try {
        const headers = email.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const snippet = email.snippet || '';

        const prompt = `
Analyze this email and determine if it's junk/promotional:

Subject: ${subject}
From: ${from}
Snippet: ${snippet}

Respond with JSON:
{
  "isJunk": boolean,
  "confidence": number (0-1),
  "category": "marketing" | "newsletter" | "promotional" | "spam" | "legitimate",
  "unsubscribeMethod": "link" | "header" | "reply" | "none",
  "reasoning": "brief explanation"
}
`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo', // Use cheaper model to reduce costs and rate limits
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 300 // Reduced token count
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        
        // Success! Reduce rate limit delay gradually
        this.rateLimitDelay = Math.max(this.rateLimitDelay * 0.9, 500);
        
        return {
          isJunk: Boolean(result.isJunk),
          confidence: Number(result.confidence) || 0,
          category: result.category || 'legitimate',
          unsubscribeMethod: result.unsubscribeMethod || 'none',
          reasoning: result.reasoning || 'No reasoning provided'
        };
      } catch (error: any) {
        console.error(`Error analyzing email (attempt ${retryCount + 1}):`, error.message);
        
        if (error.code === 'rate_limit_exceeded') {
          const shouldRetry = await this.handleRateLimitError(error, retryCount);
          if (shouldRetry === null && retryCount < 2) {
            continue; // Retry
          }
        }
        
        // For other errors or after max retries, fall back to mock
        break;
      }
    }

    console.log(`🔄 Falling back to mock analysis for email from: ${this.getHeader(email, 'From')}`);
    return this.getMockAnalysis(email);
  }

  private getHeader(email: any, headerName: string): string {
    const headers = email.payload.headers;
    const header = headers.find((h: any) => h.name === headerName);
    return header ? header.value : '';
  }

  private getMockAnalysis(email: any): AIAnalysisResult {
    const headers = email.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    
    // Simple heuristic-based analysis
    const isJunk = from.toLowerCase().includes('noreply') || 
                   from.toLowerCase().includes('newsletter') ||
                   subject.toLowerCase().includes('unsubscribe') ||
                   subject.toLowerCase().includes('promotional');

    return {
      isJunk,
      confidence: isJunk ? 0.7 : 0.3,
      category: isJunk ? 'marketing' : 'legitimate',
      unsubscribeMethod: isJunk ? 'link' : 'none',
      reasoning: isJunk ? 'Mock analysis based on sender/subject patterns' : 'Appears to be legitimate email'
    };
  }
}