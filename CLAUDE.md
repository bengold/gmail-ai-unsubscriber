# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Building and Running
```bash
# Install dependencies
npm install

# Build TypeScript and CSS
npm run build:all

# Build TypeScript only
npm run build

# Build CSS (Tailwind)
npm run build:css

# Start production server
npm start

# Development mode with hot reload
npm run dev

# Watch CSS changes
npm run build:css:watch
```

### Testing and Validation
```bash
# Run tests
npm test

# TypeScript type checking
npx tsc --noEmit

# Check for TypeScript errors before committing
npm run build
```

## Architecture Overview

### Service Architecture
The application uses a layered service architecture with clear separation of concerns:

1. **AI Service Layer**: Handles OpenAI/Claude API integration with rate limiting and caching
   - `src/services/aiService.ts` - Main AI service with configurable models
   - `src/services/unifiedAIService.ts` - Unified interface for multiple AI providers
   - `src/services/claudeService.ts` - Claude-specific implementation

2. **Gmail Integration**: OAuth2-based Gmail API access with batch processing
   - `src/services/gmailService.ts` - Core Gmail operations with rate limiting
   - Automatic token refresh and credential management
   - Batch request processing to optimize API usage

3. **Caching System**: Multi-layer caching to reduce API costs
   - `src/services/cacheService.ts` - In-memory cache with TTL
   - `src/utils/emailCache.ts` - Persistent file-based email analysis cache
   - Domain-level and sender-level caching strategies

4. **Unsubscribe Automation**: Browser automation for unsubscribe actions
   - `src/services/unsubscribeService.ts` - Main unsubscribe logic
   - Puppeteer integration for handling web-based unsubscribe flows

### Key Design Patterns

1. **Rate Limiting**: Both AI and Gmail services implement sophisticated rate limiting
   - Exponential backoff for retries
   - Request queuing and batch processing
   - Configurable limits per service

2. **Error Handling**: Comprehensive error handling with graceful degradation
   - Service-specific error recovery
   - User-friendly error messages
   - Fallback to cached data when services unavailable

3. **Performance Optimization**:
   - Email preprocessing to reduce AI calls by 60-80%
   - Gzip compression for API responses
   - Efficient DOM updates in frontend
   - Smart batching of Gmail API requests

### Configuration

The app uses environment-based configuration:
- `src/config/env.ts` - Centralized environment config with validation
- `src/config/serviceConfig.ts` - Service-specific configurations
- Supports multiple AI providers (OpenAI, Claude) via environment variables

### Frontend Architecture

Modern responsive UI built with:
- Tailwind CSS 4.x with custom components
- Vanilla JavaScript with ES6+ features
- Dark mode support with system preference detection
- Real-time progress tracking and animations

## Important Notes

1. **OAuth Setup**: Gmail OAuth requires proper configuration in Google Cloud Console with correct redirect URIs
2. **API Keys**: Store in `.env` file, never commit to repository
3. **Caching**: Email analysis results cached for 7 days to minimize API costs
4. **Rate Limits**: Respect Gmail API quotas (default: 10 requests/second)
5. **Skip Lists**: User preferences stored in `cache/skip-list.json`