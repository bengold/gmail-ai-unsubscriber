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
exports.SkipList = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SkipList {
    static ensureCacheDir() {
        const cacheDir = path.dirname(this.SKIP_FILE);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }
    static addToSkipList(domain, senderName, reason) {
        try {
            this.ensureCacheDir();
            let skipData = {};
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
        }
        catch (error) {
            console.error('Error adding to skip list:', error);
        }
    }
    static isSkipped(domain) {
        try {
            if (!fs.existsSync(this.SKIP_FILE)) {
                return false;
            }
            const skipData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
            return domain in skipData;
        }
        catch (error) {
            console.error('Error checking skip list:', error);
            return false;
        }
    }
    static removeFromSkipList(domain) {
        try {
            if (!fs.existsSync(this.SKIP_FILE)) {
                return;
            }
            const skipData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
            delete skipData[domain];
            fs.writeFileSync(this.SKIP_FILE, JSON.stringify(skipData, null, 2));
            console.log(`✅ Removed ${domain} from skip list`);
        }
        catch (error) {
            console.error('Error removing from skip list:', error);
        }
    }
    static getSkippedSenders() {
        try {
            if (!fs.existsSync(this.SKIP_FILE)) {
                return [];
            }
            const skipData = JSON.parse(fs.readFileSync(this.SKIP_FILE, 'utf8'));
            return Object.values(skipData);
        }
        catch (error) {
            console.error('Error getting skip list:', error);
            return [];
        }
    }
    static clearSkipList() {
        try {
            if (fs.existsSync(this.SKIP_FILE)) {
                fs.unlinkSync(this.SKIP_FILE);
                console.log('🗑️ Skip list cleared');
            }
        }
        catch (error) {
            console.error('Error clearing skip list:', error);
        }
    }
}
exports.SkipList = SkipList;
SkipList.SKIP_FILE = path.join(process.cwd(), 'cache', 'data', 'skip-list.json');
