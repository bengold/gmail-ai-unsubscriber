"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables as early as possible
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
exports.config = {
    // Gmail API
    gmail: {
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        redirectUri: process.env.GMAIL_REDIRECT_URI,
    },
    // AI Services
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    },
    // AI Analysis Options
    ai: {
        useClaudeForAnalysis: process.env.USE_CLAUDE_FOR_ANALYSIS === 'true',
        preferredProvider: process.env.AI_PROVIDER || 'openai', // 'openai' | 'claude' | 'custom'
    },
    // App
    app: {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
    }
};
