import * as fs from 'fs';
import * as path from 'path';

interface SkippedSender {
  domain: string;
  senderName: string;
  skippedAt: number;
  reason?: string;
}

interface SkipListData {
  [domain: string]: SkippedSender;
}

export class SkipList {
  private static readonly SKIP_FILE = path.join(process.cwd(), 'cache', 'skip-list.json');
  
  private static ensureCacheDir(): void {
    const cacheDir = path.dirname(this.SKIP_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  static addToSkipList(domain: string, senderName: string, reason?: string): void {
    try {
      this.ensureCacheDir();
      
      let skipData: SkipListData = {};
      if (fs.existsSync(this.SKIP_FILE)) {
        skipData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
      }

      skipData[domain] = {
        domain,
        senderName,
        skippedAt: Date.now(),
        reason
      };

      fs.writeFileSync(this.SKIP_FILE, JSON.stringify(skipData, null, 2));
      console.log(`⏭️ Added ${domain} to skip list`);
    } catch (error) {
      console.error('Error adding to skip list:', error);
    }
  }

  static isSkipped(domain: string): boolean {
    try {
      if (!fs.existsSync(this.SKIP_FILE)) {
        return false;
      }

      const skipData: SkipListData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
      return domain in skipData;
    } catch (error) {
      console.error('Error checking skip list:', error);
      return false;
    }
  }

  static removeFromSkipList(domain: string): void {
    try {
      if (!fs.existsSync(this.SKIP_FILE)) {
        return;
      }

      const skipData: SkipListData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
      delete skipData[domain];

      fs.writeFileSync(this.SKIP_FILE, JSON.stringify(skipData, null, 2));
      console.log(`✅ Removed ${domain} from skip list`);
    } catch (error) {
      console.error('Error removing from skip list:', error);
    }
  }

  static getSkippedSenders(): SkippedSender[] {
    try {
      if (!fs.existsSync(this.SKIP_FILE)) {
        return [];
      }

      const skipData: SkipListData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
      return Object.values(skipData);
    } catch (error) {
      console.error('Error getting skip list:', error);
      return [];
    }
  }

  static clearSkipList(): void {
    try {
      if (fs.existsSync(this.SKIP_FILE)) {
        fs.unlinkSync(this.SKIP_FILE);
        console.log('🗑️ Skip list cleared');
      }
    } catch (error) {
      console.error('Error clearing skip list:', error);
    }
  }
}
