import dotenv from 'dotenv';
import path from 'path';

// Load environment variables as early as possible
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Gmail API
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    redirectUri: process.env.GMAIL_REDIRECT_URI!,
  },
  
  // AI Services
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  },
  
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
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
