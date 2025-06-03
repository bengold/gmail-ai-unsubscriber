"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailMetadataCache = exports.EmailCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
class EmailCache {
    static ensureCacheDir() {
        const cacheDir = path.dirname(this.CACHE_FILE);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }
    static generateEmailHash(email) {
        const headers = email.payload.headers;
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const snippet = email.snippet || '';
        // Create a simple hash based on key email properties
        return Buffer.from(`${from}:${subject}:${snippet.substring(0, 100)}`).toString('base64');
    }
    static getCachedAnalysis(email) {
        try {
            this.ensureCacheDir();
            if (!fs.existsSync(this.CACHE_FILE)) {
                return null;
            }
            const cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
            const emailHash = this.generateEmailHash(email);
            const cached = cacheData[emailHash];
            if (cached && (Date.now() - cached.cachedAt < this.CACHE_DURATION)) {
                logger_1.logger.debug(`Using cached analysis for email: ${cached.subject}`);
                return cached;
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error reading email cache:', error);
            return null;
        }
    }
    static cacheAnalysis(email, analysis, unsubscribeInfo) {
        try {
            this.ensureCacheDir();
            let cacheData = {};
            if (fs.existsSync(this.CACHE_FILE)) {
                cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
            }
            const headers = email.payload.headers;
            const emailHash = this.generateEmailHash(email);
            const cachedEmail = {
                id: email.id,
                from: headers.find((h) => h.name === 'From')?.value || '',
                subject: headers.find((h) => h.name === 'Subject')?.value || '',
                analysis,
                unsubscribeInfo,
                cachedAt: Date.now(),
                hash: emailHash
            };
            cacheData[emailHash] = cachedEmail;
            // Clean up old cache entries (older than cache duration)
            const cutoffTime = Date.now() - this.CACHE_DURATION;
            Object.keys(cacheData).forEach(key => {
                if (cacheData[key].cachedAt < cutoffTime) {
                    delete cacheData[key];
                }
            });
            fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cacheData, null, 2));
            logger_1.logger.debug(`Cached analysis for email: ${cachedEmail.subject}`);
        }
        catch (error) {
            logger_1.logger.error('Error writing email cache:', error);
        }
    }
    static clearCache() {
        try {
            if (fs.existsSync(this.CACHE_FILE)) {
                fs.unlinkSync(this.CACHE_FILE);
                logger_1.logger.info('Email cache cleared');
            }
        }
        catch (error) {
            logger_1.logger.error('Error clearing email cache:', error);
        }
    }
    static getCacheStats() {
        try {
            if (!fs.existsSync(this.CACHE_FILE)) {
                return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
            }
            const cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
            const entries = Object.values(cacheData);
            if (entries.length === 0) {
                return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
            }
            const timestamps = entries.map(e => e.cachedAt);
            return {
                totalEntries: entries.length,
                oldestEntry: Math.min(...timestamps),
                newestEntry: Math.max(...timestamps)
            };
        }
        catch (error) {
            return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
        }
    }
}
exports.EmailCache = EmailCache;
EmailCache.CACHE_FILE = path.join(process.cwd(), 'cache', 'data', 'email-analysis.json');
EmailCache.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
class EmailMetadataCache {
    static getCachedMetadata(emailId) {
        const cached = this.cache.get(emailId);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }
        return null;
    }
    static cacheMetadata(emailId, metadata) {
        this.cache.set(emailId, {
            data: metadata,
            timestamp: Date.now()
        });
    }
    static clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= this.cacheDuration) {
                this.cache.delete(key);
            }
        }
    }
    static getCacheStats() {
        return {
            size: this.cache.size,
            items: Array.from(this.cache.keys())
        };
    }
}
exports.EmailMetadataCache = EmailMetadataCache;
EmailMetadataCache.cache = new Map();
EmailMetadataCache.cacheDuration = 5 * 60 * 1000; // 5 minutes
