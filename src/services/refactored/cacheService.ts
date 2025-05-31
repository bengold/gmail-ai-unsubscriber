/**
 * Refactored Cache Service with provider abstraction and improved memory management
 */

import NodeCache from 'node-cache';
import { ICacheService, CacheStats } from '../../interfaces/services';
import { CacheConfig } from '../../config/serviceConfig';
import { logger } from '../../utils/logger';

/**
 * Cache provider interface for different cache implementations
 */
interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
  getStats(): CacheStats;
  close(): void;
}

/**
 * In-memory cache provider using NodeCache
 */
class MemoryCacheProvider implements ICacheProvider {
  private cache: NodeCache;
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  constructor(private config: CacheConfig) {
    this.cache = new NodeCache({
      stdTTL: config.stdTTL,
      checkperiod: config.checkperiod,
      useClones: config.useClones,
      deleteOnExpire: config.deleteOnExpire,
      maxKeys: config.maxKeys
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.cache.on('set', () => this.metrics.sets++);
    this.cache.on('del', () => this.metrics.deletes++);
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache key expired: ${key}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        this.metrics.hits++;
        return value;
      }
      this.metrics.misses++;
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, error as Error);
      this.metrics.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const success = ttl 
        ? this.cache.set(key, value, ttl)
        : this.cache.set(key, value);
      
      if (!success) {
        throw new Error(`Failed to set cache key: ${key}`);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, error as Error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, error as Error);
      throw error;
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const keys = this.cache.keys();
        const regex = new RegExp(pattern);
        const matchingKeys = keys.filter(key => regex.test(key));
        
        if (matchingKeys.length > 0) {
          this.cache.del(matchingKeys);
          logger.info(`Cleared ${matchingKeys.length} cache keys matching pattern: ${pattern}`);
        }
      } else {
        this.cache.flushAll();
        logger.info('Cleared all cache entries');
      }
    } catch (error) {
      logger.error('Cache clear error', error as Error);
      throw error;
    }
  }

  getStats(): CacheStats {
    const stats = this.cache.getStats();
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) : 0;
    
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      keys: stats.keys,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
  }

  close(): void {
    this.cache.close();
  }
}

/**
 * Cache key generator with namespace support
 */
class CacheKeyGenerator {
  constructor(private namespace: string) {}

  generate(parts: string[]): string {
    const key = `${this.namespace}:${parts.join(':')}`;
    // Ensure key is valid and not too long
    return key.substring(0, 250).replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  parseNamespace(key: string): string | null {
    const match = key.match(/^([^:]+):/);
    return match ? match[1] : null;
  }
}

/**
 * Refactored cache service with multiple cache instances
 */
export class RefactoredCacheService implements ICacheService {
  private caches: Map<string, ICacheProvider> = new Map();
  private keyGenerators: Map<string, CacheKeyGenerator> = new Map();
  private memoryMonitorInterval?: NodeJS.Timeout;
  private readonly memoryThreshold = 500; // MB

  constructor(private configs: {
    email: CacheConfig;
    search: CacheConfig;
    domain: CacheConfig;
    ai: CacheConfig;
  }) {
    this.initializeCaches();
    this.startMemoryMonitoring();
  }

  private initializeCaches(): void {
    // Initialize cache providers for different data types
    Object.entries(this.configs).forEach(([name, config]) => {
      this.caches.set(name, new MemoryCacheProvider(config));
      this.keyGenerators.set(name, new CacheKeyGenerator(name));
      logger.info(`Initialized ${name} cache with TTL: ${config.stdTTL}s`);
    });
  }

  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      this.performMemoryCheck();
    }, 60000); // Check every minute
  }

  private performMemoryCheck(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > this.memoryThreshold) {
      logger.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
      this.performMemoryCleanup();
    }
  }

  private performMemoryCleanup(): void {
    // Clear least important caches first
    const cleanupOrder = ['search', 'email', 'domain', 'ai'];
    
    for (const cacheName of cleanupOrder) {
      const cache = this.caches.get(cacheName);
      if (cache) {
        const stats = cache.getStats();
        if (stats.keys > 100) {
          // Clear 25% of entries
          const keysToRemove = Math.floor(stats.keys * 0.25);
          logger.info(`Clearing ${keysToRemove} entries from ${cacheName} cache`);
          // In a real implementation, we'd remove LRU entries
          // For now, we'll clear by pattern
          cache.clear(`${cacheName}:*`);
        }
      }
      
      // Check if memory is now acceptable
      const currentUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (currentUsage < this.memoryThreshold * 0.8) {
        break;
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const namespace = this.parseNamespace(key);
    const cache = this.getCache(namespace);
    return cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const namespace = this.parseNamespace(key);
    const cache = this.getCache(namespace);
    await cache.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    const namespace = this.parseNamespace(key);
    const cache = this.getCache(namespace);
    await cache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      // Clear specific pattern across all caches
      for (const [name, cache] of this.caches) {
        await cache.clear(pattern);
      }
    } else {
      // Clear all caches
      for (const [name, cache] of this.caches) {
        await cache.clear();
      }
    }
  }

  async getStats(): Promise<CacheStats> {
    const allStats: CacheStats[] = [];
    
    for (const [name, cache] of this.caches) {
      const stats = cache.getStats();
      allStats.push(stats);
    }
    
    // Aggregate stats
    const aggregated: CacheStats = {
      hits: allStats.reduce((sum, s) => sum + s.hits, 0),
      misses: allStats.reduce((sum, s) => sum + s.misses, 0),
      keys: allStats.reduce((sum, s) => sum + s.keys, 0),
      hitRate: 0,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
    
    const total = aggregated.hits + aggregated.misses;
    aggregated.hitRate = total > 0 ? Math.round((aggregated.hits / total) * 100) / 100 : 0;
    
    return aggregated;
  }

  /**
   * Get stats for a specific cache
   */
  async getCacheStats(cacheName: string): Promise<CacheStats | null> {
    const cache = this.caches.get(cacheName);
    return cache ? cache.getStats() : null;
  }

  /**
   * Cache-specific methods for backward compatibility
   */
  async cacheEmail(messageId: string, emailData: any): Promise<void> {
    const key = this.keyGenerators.get('email')!.generate([messageId]);
    await this.set(key, emailData);
  }

  async getCachedEmail(messageId: string): Promise<any | null> {
    const key = this.keyGenerators.get('email')!.generate([messageId]);
    return this.get(key);
  }

  async cacheSearchResults(query: string, results: any): Promise<void> {
    const key = this.keyGenerators.get('search')!.generate([
      Buffer.from(query).toString('base64')
    ]);
    await this.set(key, results);
  }

  async getCachedSearchResults(query: string): Promise<any | null> {
    const key = this.keyGenerators.get('search')!.generate([
      Buffer.from(query).toString('base64')
    ]);
    return this.get(key);
  }

  async cacheDomainAnalysis(domain: string, analysis: any): Promise<void> {
    const key = this.keyGenerators.get('domain')!.generate([domain]);
    await this.set(key, analysis);
  }

  async getCachedDomainAnalysis(domain: string): Promise<any | null> {
    const key = this.keyGenerators.get('domain')!.generate([domain]);
    return this.get(key);
  }

  async cacheAIAnalysis(emailBatch: string[], analysis: any): Promise<void> {
    const sortedBatch = [...emailBatch].sort();
    const key = this.keyGenerators.get('ai')!.generate([
      Buffer.from(sortedBatch.join(',')).toString('base64')
    ]);
    await this.set(key, analysis);
  }

  async getCachedAIAnalysis(emailBatch: string[]): Promise<any | null> {
    const sortedBatch = [...emailBatch].sort();
    const key = this.keyGenerators.get('ai')!.generate([
      Buffer.from(sortedBatch.join(',')).toString('base64')
    ]);
    return this.get(key);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    for (const [name, cache] of this.caches) {
      cache.close();
    }
    
    this.caches.clear();
    logger.info('Cache service destroyed');
  }

  private parseNamespace(key: string): string {
    const match = key.match(/^([^:]+):/);
    return match ? match[1] : 'default';
  }

  private getCache(namespace: string): ICacheProvider {
    const cache = this.caches.get(namespace);
    if (!cache) {
      // Fallback to email cache as default
      return this.caches.get('email')!;
    }
    return cache;
  }
}