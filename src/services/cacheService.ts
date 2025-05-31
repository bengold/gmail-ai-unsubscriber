import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

interface CacheConfig {
  stdTTL: number; // Time to live in seconds
  checkperiod: number; // Check for expired keys every X seconds
  useClones: boolean; // Clone cached objects
  maxKeys?: number; // Maximum number of keys to store
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  flushes: number;
}

class AdvancedCacheService {
  private emailCache: NodeCache;
  private searchCache: NodeCache;
  private domainCache: NodeCache;
  private aiCache: NodeCache;
  private metrics: Map<string, CacheMetrics> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Different cache configurations for different data types
    const emailConfig: CacheConfig = {
      stdTTL: 3600, // 1 hour for email data
      checkperiod: 600, // Check every 10 minutes
      useClones: false,
      maxKeys: 1000 // Limit email cache size
    };

    const searchConfig: CacheConfig = {
      stdTTL: 1800, // 30 minutes for search results
      checkperiod: 300, // Check every 5 minutes
      useClones: false,
      maxKeys: 100 // Limit search cache size
    };

    const domainConfig: CacheConfig = {
      stdTTL: 7200, // 2 hours for domain analysis
      checkperiod: 600,
      useClones: false,
      maxKeys: 500 // Limit domain cache size
    };

    const aiConfig: CacheConfig = {
      stdTTL: 14400, // 4 hours for AI analysis results
      checkperiod: 1200,
      useClones: false,
      maxKeys: 200 // Limit AI cache size
    };

    this.emailCache = new NodeCache(emailConfig);
    this.searchCache = new NodeCache(searchConfig);
    this.domainCache = new NodeCache(domainConfig);
    this.aiCache = new NodeCache(aiConfig);

    // Initialize metrics
    this.initializeMetrics();

    // Set up event listeners for metrics tracking
    this.setupEventListeners();

    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 300000); // Every 5 minutes

    logger.info('Advanced cache service initialized with memory management');
  }

  private initializeMetrics(): void {
    const cacheNames = ['email', 'search', 'domain', 'ai'];
    cacheNames.forEach(name => {
      this.metrics.set(name, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        flushes: 0
      });
    });
  }

  private setupEventListeners(): void {
    // Email cache events
    this.emailCache.on('set', () => this.incrementMetric('email', 'sets'));
    this.emailCache.on('del', () => this.incrementMetric('email', 'deletes'));
    this.emailCache.on('flush', () => this.incrementMetric('email', 'flushes'));

    // Search cache events
    this.searchCache.on('set', () => this.incrementMetric('search', 'sets'));
    this.searchCache.on('del', () => this.incrementMetric('search', 'deletes'));
    this.searchCache.on('flush', () => this.incrementMetric('search', 'flushes'));

    // Domain cache events
    this.domainCache.on('set', () => this.incrementMetric('domain', 'sets'));
    this.domainCache.on('del', () => this.incrementMetric('domain', 'deletes'));
    this.domainCache.on('flush', () => this.incrementMetric('domain', 'flushes'));

    // AI cache events
    this.aiCache.on('set', () => this.incrementMetric('ai', 'sets'));
    this.aiCache.on('del', () => this.incrementMetric('ai', 'deletes'));
    this.aiCache.on('flush', () => this.incrementMetric('ai', 'flushes'));
  }

  private incrementMetric(cacheName: string, metric: keyof CacheMetrics): void {
    const metrics = this.metrics.get(cacheName);
    if (metrics) {
      metrics[metric]++;
    }
  }

  private performMaintenance(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    // If memory usage is high, be more aggressive with cleanup
    if (heapUsedMB > 500) { // 500MB threshold
      logger.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB, performing aggressive cache cleanup`);
      
      // Reduce TTL temporarily and clear some entries
      this.emailCache.flushStats();
      this.searchCache.flushStats();
      
      // Clear least recently used entries
      this.clearLRUEntries();
    }

    // Log cache statistics periodically
    if (Math.random() < 0.1) { // 10% chance to log stats
      this.logCacheStatistics();
    }
  }

  private clearLRUEntries(): void {
    // Clear 25% of entries from each cache
    const clearPercentage = 0.25;
    
    [this.emailCache, this.searchCache, this.domainCache, this.aiCache].forEach(cache => {
      const keys = cache.keys();
      const keysToDelete = Math.floor(keys.length * clearPercentage);
      
      for (let i = 0; i < keysToDelete; i++) {
        cache.del(keys[i]);
      }
    });
  }

  private logCacheStatistics(): void {
    const stats = this.getStats();
    logger.info('Cache statistics', {
      email: stats.email,
      search: stats.search,
      domain: stats.domain,
      ai: stats.ai,
      metrics: Object.fromEntries(this.metrics)
    });
  }

  // Email caching with metrics
  cacheEmail(messageId: string, emailData: any): void {
    try {
      const key = `email:${messageId}`;
      this.emailCache.set(key, emailData);
      logger.debug(`Cached email: ${messageId}`);
    } catch (error) {
      logger.error('Error caching email', error as Error);
    }
  }

  getCachedEmail(messageId: string): any | null {
    try {
      const key = `email:${messageId}`;
      const result = this.emailCache.get(key);
      
      if (result) {
        this.incrementMetric('email', 'hits');
        logger.debug(`Cache hit for email: ${messageId}`);
        return result;
      } else {
        this.incrementMetric('email', 'misses');
        return null;
      }
    } catch (error) {
      logger.error('Error getting cached email', error as Error);
      this.incrementMetric('email', 'misses');
      return null;
    }
  }

  // Search result caching with compression for large results
  cacheSearchResults(query: string, results: any): void {
    try {
      const key = `search:${Buffer.from(query).toString('base64')}`;
      
      // Only cache if results are reasonable size
      const resultSize = JSON.stringify(results).length;
      if (resultSize > 1024 * 1024) { // 1MB limit
        logger.warn(`Search results too large to cache: ${resultSize} bytes for query: ${query}`);
        return;
      }
      
      this.searchCache.set(key, results);
      logger.debug(`Cached search results for query: ${query} (${results.length} results)`);
    } catch (error) {
      logger.error('Error caching search results', error as Error);
    }
  }

  getCachedSearchResults(query: string): any | null {
    try {
      const key = `search:${Buffer.from(query).toString('base64')}`;
      const result = this.searchCache.get(key);
      
      if (result) {
        this.incrementMetric('search', 'hits');
        logger.debug(`Cache hit for search: ${query}`);
        return result;
      } else {
        this.incrementMetric('search', 'misses');
        return null;
      }
    } catch (error) {
      logger.error('Error getting cached search results', error as Error);
      this.incrementMetric('search', 'misses');
      return null;
    }
  }

  // Domain analysis caching
  cacheDomainAnalysis(domain: string, analysis: any): void {
    try {
      const key = `domain:${domain}`;
      this.domainCache.set(key, analysis);
      logger.debug(`Cached domain analysis: ${domain}`);
    } catch (error) {
      logger.error('Error caching domain analysis', error as Error);
    }
  }

  getCachedDomainAnalysis(domain: string): any | null {
    try {
      const key = `domain:${domain}`;
      const result = this.domainCache.get(key);
      
      if (result) {
        this.incrementMetric('domain', 'hits');
        return result;
      } else {
        this.incrementMetric('domain', 'misses');
        return null;
      }
    } catch (error) {
      logger.error('Error getting cached domain analysis', error as Error);
      this.incrementMetric('domain', 'misses');
      return null;
    }
  }

  // AI analysis caching with intelligent key generation
  cacheAIAnalysis(emailBatch: string[], analysis: any): void {
    try {
      // Create a more efficient key for batch analysis
      const sortedBatch = [...emailBatch].sort();
      const key = `ai:${Buffer.from(sortedBatch.join(',')).toString('base64')}`;
      
      this.aiCache.set(key, analysis);
      logger.debug(`Cached AI analysis for batch of ${emailBatch.length} emails`);
    } catch (error) {
      logger.error('Error caching AI analysis', error as Error);
    }
  }

  getCachedAIAnalysis(emailBatch: string[]): any | null {
    try {
      const sortedBatch = [...emailBatch].sort();
      const key = `ai:${Buffer.from(sortedBatch.join(',')).toString('base64')}`;
      const result = this.aiCache.get(key);
      
      if (result) {
        this.incrementMetric('ai', 'hits');
        return result;
      } else {
        this.incrementMetric('ai', 'misses');
        return null;
      }
    } catch (error) {
      logger.error('Error getting cached AI analysis', error as Error);
      this.incrementMetric('ai', 'misses');
      return null;
    }
  }

  // Enhanced cache statistics with metrics
  getStats() {
    const baseStats = {
      email: this.emailCache.getStats(),
      search: this.searchCache.getStats(),
      domain: this.domainCache.getStats(),
      ai: this.aiCache.getStats()
    };

    // Add custom metrics
    const enhancedStats = {
      ...baseStats,
      metrics: Object.fromEntries(this.metrics),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      hitRates: {
        email: this.calculateHitRate('email'),
        search: this.calculateHitRate('search'),
        domain: this.calculateHitRate('domain'),
        ai: this.calculateHitRate('ai')
      }
    };

    return enhancedStats;
  }

  private calculateHitRate(cacheName: string): number {
    const metrics = this.metrics.get(cacheName);
    if (!metrics) return 0;
    
    const total = metrics.hits + metrics.misses;
    return total > 0 ? Math.round((metrics.hits / total) * 100) : 0;
  }

  // Clear specific caches with logging
  clearEmailCache(): void {
    const keyCount = this.emailCache.keys().length;
    this.emailCache.flushAll();
    this.incrementMetric('email', 'flushes');
    logger.info(`Cleared email cache (${keyCount} keys)`);
  }

  clearSearchCache(): void {
    const keyCount = this.searchCache.keys().length;
    this.searchCache.flushAll();
    this.incrementMetric('search', 'flushes');
    logger.info(`Cleared search cache (${keyCount} keys)`);
  }

  clearDomainCache(): void {
    const keyCount = this.domainCache.keys().length;
    this.domainCache.flushAll();
    this.incrementMetric('domain', 'flushes');
    logger.info(`Cleared domain cache (${keyCount} keys)`);
  }

  clearAICache(): void {
    const keyCount = this.aiCache.keys().length;
    this.aiCache.flushAll();
    this.incrementMetric('ai', 'flushes');
    logger.info(`Cleared AI cache (${keyCount} keys)`);
  }

  clearAllCaches(): void {
    const totalKeys = this.emailCache.keys().length +
                     this.searchCache.keys().length +
                     this.domainCache.keys().length +
                     this.aiCache.keys().length;

    this.emailCache.flushAll();
    this.searchCache.flushAll();
    this.domainCache.flushAll();
    this.aiCache.flushAll();

    // Reset metrics
    this.initializeMetrics();

    logger.info(`Cleared all caches (${totalKeys} total keys)`);
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAllCaches();
    logger.info('Cache service destroyed');
  }
}

export const cacheService = new AdvancedCacheService();
