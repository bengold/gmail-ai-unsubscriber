import * as fs from 'fs';
import * as path from 'path';

interface CachedEmail {
  id: string;
  from: string;
  subject: string;
  analysis: any;
  unsubscribeInfo: any;
  cachedAt: number;
  hash: string;
}

interface CacheData {
  [key: string]: CachedEmail;
}

export class EmailCache {
  private static readonly CACHE_FILE = path.join(process.cwd(), 'cache', 'email-analysis.json');
  private static readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  private static ensureCacheDir(): void {
    const cacheDir = path.dirname(this.CACHE_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  private static generateEmailHash(email: any): string {
    const headers = email.payload.headers;
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const snippet = email.snippet || '';
    
    // Create a simple hash based on key email properties
    return Buffer.from(`${from}:${subject}:${snippet.substring(0, 100)}`).toString('base64');
  }

  static getCachedAnalysis(email: any): CachedEmail | null {
    try {
      this.ensureCacheDir();
      
      if (!fs.existsSync(this.CACHE_FILE)) {
        return null;
      }

      const cacheData: CacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
      const emailHash = this.generateEmailHash(email);
      const cached = cacheData[emailHash];

      if (cached && (Date.now() - cached.cachedAt < this.CACHE_DURATION)) {
        console.log(`📋 Using cached analysis for email: ${cached.subject}`);
        return cached;
      }

      return null;
    } catch (error) {
      console.error('Error reading email cache:', error);
      return null;
    }
  }

  static cacheAnalysis(email: any, analysis: any, unsubscribeInfo: any): void {
    try {
      this.ensureCacheDir();
      
      let cacheData: CacheData = {};
      if (fs.existsSync(this.CACHE_FILE)) {
        cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
      }

      const headers = email.payload.headers;
      const emailHash = this.generateEmailHash(email);
      
      const cachedEmail: CachedEmail = {
        id: email.id,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
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
      console.log(`💾 Cached analysis for email: ${cachedEmail.subject}`);
    } catch (error) {
      console.error('Error writing email cache:', error);
    }
  }

  static clearCache(): void {
    try {
      if (fs.existsSync(this.CACHE_FILE)) {
        fs.unlinkSync(this.CACHE_FILE);
        console.log('🗑️ Email cache cleared');
      }
    } catch (error) {
      console.error('Error clearing email cache:', error);
    }
  }

  static getCacheStats(): { totalEntries: number; oldestEntry: number; newestEntry: number } {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
      }

      const cacheData = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf8'));
      const entries = Object.values(cacheData) as CachedEmail[];
      
      if (entries.length === 0) {
        return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
      }

      const timestamps = entries.map(e => e.cachedAt);
      
      return {
        totalEntries: entries.length,
        oldestEntry: Math.min(...timestamps),
        newestEntry: Math.max(...timestamps)
      };
    } catch (error) {
      return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
    }
  }
}

export class EmailMetadataCache {
  private static cache = new Map<string, any>();
  private static cacheDuration = 5 * 60 * 1000; // 5 minutes
  
  static getCachedMetadata(emailId: string): any | null {
    const cached = this.cache.get(emailId);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    return null;
  }
  
  static cacheMetadata(emailId: string, metadata: any): void {
    this.cache.set(emailId, {
      data: metadata,
      timestamp: Date.now()
    });
  }
  
  static clearExpiredCache(): void {
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
