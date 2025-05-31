// Load environment variables first
import './config/env';

import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import { authRoutes } from './routes/authRoutes';
import { emailRoutes } from './routes/emailRoutes';
import { cacheService } from './services/cacheService';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Enable Gzip compression (must be first)
app.use(compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Compression level (1-9, 6 is good balance)
  filter: (req, res) => {
    // Don't compress if request includes a no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Compress based on content type
    return compression.filter(req, res);
  }
}));

// Enhanced JSON parsing with size limits
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res: Response, buf: Buffer) => {
    req.rawBody = buf;
  }
}));

app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  credentials: true
}));

// Rate limiting middleware for API routes
const rateLimit = (windowMs: number, max: number) => {
  const requests = new Map();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
    
    if (userRequests.length >= max) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(ip, userRequests);
    next();
  };
};

// Apply rate limiting to API routes
app.use('/api', rateLimit(60000, 100)); // 100 requests per minute
app.use('/api/emails/scan', rateLimit(300000, 5)); // 5 scans per 5 minutes

app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Performance monitoring endpoint
app.get('/api/performance/stats', (req, res) => {
  const stats = cacheService.getStats();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    cache: stats,
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024) // MB
    },
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    cache: cacheService.getStats()
  };
  res.json(healthCheck);
});

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${error.message}`, error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, cleaning up...');
  
  // Clear caches
  cacheService.clearAllCaches();
  
  // Close server
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📧 Gmail AI Unsubscriber is ready!`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;