"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables first
require("./config/env");
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_1 = require("./routes/authRoutes");
const emailRoutes_1 = require("./routes/emailRoutes");
const cacheService_1 = require("./services/cacheService");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_1.logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});
// Enable Gzip compression (must be first)
app.use((0, compression_1.default)({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Compression level (1-9, 6 is good balance)
    filter: (req, res) => {
        // Don't compress if request includes a no-transform directive
        if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
            return false;
        }
        // Compress based on content type
        return compression_1.default.filter(req, res);
    }
}));
// Enhanced JSON parsing with size limits
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public'), {
    maxAge: '1d', // Cache static files for 1 day
    etag: true
}));
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
    credentials: true
}));
// Rate limiting middleware for API routes
const rateLimit = (windowMs, max) => {
    const requests = new Map();
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;
        if (!requests.has(ip)) {
            requests.set(ip, []);
        }
        const userRequests = requests.get(ip).filter((time) => time > windowStart);
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
app.use('/api/auth', authRoutes_1.authRoutes);
app.use('/api/emails', emailRoutes_1.emailRoutes);
// Performance monitoring endpoint
app.get('/api/performance/stats', (req, res) => {
    const stats = cacheService_1.cacheService.getStats();
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
app.get('/health', (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        cache: cacheService_1.cacheService.getStats()
    };
    res.json(healthCheck);
});
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Global error handler
app.use((error, req, res, next) => {
    logger_1.logger.error(`Unhandled error: ${error.message}`, error);
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
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});
// Graceful shutdown handling
const gracefulShutdown = () => {
    logger_1.logger.info('Received shutdown signal, cleaning up...');
    // Clear caches
    cacheService_1.cacheService.clearAllCaches();
    // Close server
    process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger_1.logger.info(`📧 Gmail AI Unsubscriber is ready!`);
    logger_1.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
