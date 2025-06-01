"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = __importDefault(require("openai"));
const cacheService_1 = require("./cacheService");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
class AIService {
    constructor() {
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.rateLimitDelay = 1000; // Start with 1 second delay
        if (env_1.config.openai.apiKey && env_1.config.openai.apiKey !== 'your_openai_api_key_here') {
            this.openai = new openai_1.default({
                apiKey: env_1.config.openai.apiKey,
                baseURL: env_1.config.openai.baseURL,
            });
            this.model = env_1.config.openai.model;
            logger_1.logger.info(`AI Service initialized with model: ${this.model} at ${env_1.config.openai.baseURL}`);
        }
        else {
            logger_1.logger.warn('OpenAI API key not provided. AI analysis will use mock data.');
            this.openai = null;
            this.model = 'mock';
        }
    }
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            logger_1.logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
    async handleRateLimitError(error, retryCount = 0) {
        if (error.code === 'rate_limit_exceeded' && retryCount < 3) {
            // Exponential backoff: 2s, 4s, 8s
            const backoffDelay = Math.pow(2, retryCount + 1) * 1000;
            logger_1.logger.warn(`Rate limit hit. Retrying in ${backoffDelay / 1000}s... (attempt ${retryCount + 1}/3)`);
            // Increase the global rate limit delay
            this.rateLimitDelay = Math.min(this.rateLimitDelay * 1.5, 5000);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return null; // Signal to retry
        }
        logger_1.logger.warn(`Rate limit exceeded. Falling back to mock analysis after ${retryCount} retries.`);
        return null; // Will trigger fallback to mock
    }
    async analyzeEmail(email) {
        // Create cache key from email content
        const headers = email.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const cacheKey = `${from}-${subject}`.substring(0, 100); // Limit key length
        // Check cache first
        const cachedResult = cacheService_1.cacheService.getCachedAIAnalysis([cacheKey]);
        if (cachedResult) {
            logger_1.logger.debug(`Cache hit for AI analysis: ${from}`);
            return cachedResult;
        }
        if (!this.openai) {
            // Return mock analysis when OpenAI is not available
            const mockResult = this.getMockAnalysis(email);
            cacheService_1.cacheService.cacheAIAnalysis([cacheKey], mockResult);
            return mockResult;
        }
        // Rate limiting
        await this.waitForRateLimit();
        this.requestCount++;
        for (let retryCount = 0; retryCount < 3; retryCount++) {
            try {
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
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 300 // Reduced token count
                });
                const result = JSON.parse(response.choices[0].message.content || '{}');
                // Success! Reduce rate limit delay gradually
                this.rateLimitDelay = Math.max(this.rateLimitDelay * 0.9, 500);
                const analysisResult = {
                    isJunk: Boolean(result.isJunk),
                    confidence: Number(result.confidence) || 0,
                    category: result.category || 'legitimate',
                    unsubscribeMethod: result.unsubscribeMethod || 'none',
                    reasoning: result.reasoning || 'No reasoning provided'
                };
                // Cache the successful result
                cacheService_1.cacheService.cacheAIAnalysis([cacheKey], analysisResult);
                logger_1.logger.debug(`Cached AI analysis for: ${from}`);
                return analysisResult;
            }
            catch (error) {
                logger_1.logger.error(`Error analyzing email (attempt ${retryCount + 1}):`, error);
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
        logger_1.logger.info(`Falling back to mock analysis for email from: ${this.getHeader(email, 'From')}`);
        return this.getMockAnalysis(email);
    }
    getHeader(email, headerName) {
        const headers = email.payload.headers;
        const header = headers.find((h) => h.name === headerName);
        return header ? header.value : '';
    }
    getMockAnalysis(email) {
        const headers = email.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
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
exports.AIService = AIService;
