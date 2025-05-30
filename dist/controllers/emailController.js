"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailController = void 0;
const gmailService_1 = require("../services/gmailService");
const aiService_1 = require("../services/aiService");
const unsubscribeService_1 = require("../services/unsubscribeService");
const emailPreprocessor_1 = require("../utils/emailPreprocessor");
const emailCache_1 = require("../utils/emailCache");
const skipList_1 = require("../utils/skipList");
class EmailController {
    constructor() {
        this.currentProgress = null;
        this.gmailService = new gmailService_1.GmailService();
        this.aiService = new aiService_1.AIService();
        this.unsubscribeService = new unsubscribeService_1.UnsubscribeService();
    }
    async getAuthUrl(req, res) {
        try {
            const authUrl = this.gmailService.getAuthUrl();
            res.json({ authUrl });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to generate auth URL' });
        }
    }
    async handleCallback(req, res) {
        try {
            const { code } = req.query;
            if (!code || typeof code !== 'string') {
                res.status(400).send('Missing authorization code');
                return;
            }
            await this.gmailService.handleAuthCallback(code);
            // Redirect to the main page with success message
            res.redirect('/?auth=success');
        }
        catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/?auth=error');
        }
    }
    async authenticate(req, res) {
        try {
            const { code } = req.body;
            await this.gmailService.authenticate(code);
            res.json({ message: 'Authentication successful' });
        }
        catch (error) {
            res.status(500).json({ error: 'Authentication failed' });
        }
    }
    async getProgress(req, res) {
        res.json(this.currentProgress || {
            status: 'idle',
            processed: 0,
            total: 0,
            currentBatch: 0,
            totalBatches: 0,
            aiCalls: 0,
            preprocessed: 0
        });
    }
    async scanJunkEmails(req, res) {
        try {
            // Reset progress state at the start of each scan
            this.currentProgress = {
                status: 'starting',
                processed: 0,
                total: 0,
                currentBatch: 0,
                totalBatches: 0,
                aiCalls: 0,
                preprocessed: 0,
                startTime: Date.now()
            };
            // Try to load saved tokens first
            const hasTokens = await this.gmailService.loadSavedTokens();
            if (!hasTokens) {
                this.currentProgress = { status: 'error', error: 'Not authenticated' };
                res.status(401).json({ error: 'Not authenticated. Please authenticate first.' });
                return;
            }
            const emails = await this.gmailService.getSubscriptionEmails();
            console.log(`📧 Found ${emails.length} potential subscription emails`);
            // Update progress with initial totals
            this.currentProgress = {
                ...this.currentProgress,
                status: 'preprocessing',
                total: emails.length
            };
            console.log(`🔍 Checking cache and preprocessing ${emails.length} emails...`);
            // Step 1: Check cache and preprocess emails
            const preprocessResults = [];
            const needsProcessing = [];
            let cacheHits = 0;
            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                // Check cache first
                const cachedAnalysis = emailCache_1.EmailCache.getCachedAnalysis(email);
                if (cachedAnalysis) {
                    preprocessResults.push({
                        id: cachedAnalysis.id,
                        subject: cachedAnalysis.subject,
                        from: cachedAnalysis.from,
                        analysis: cachedAnalysis.analysis,
                        unsubscribeInfo: cachedAnalysis.unsubscribeInfo
                    });
                    cacheHits++;
                    this.currentProgress.preprocessed = i + 1;
                    continue;
                }
                // Not in cache, add to processing queue
                needsProcessing.push({ email, index: i });
                this.currentProgress.preprocessed = i + 1;
            }
            console.log(`📋 Cache check complete: ${cacheHits} from cache, ${needsProcessing.length} need processing`);
            // Now limit only the emails that need processing (not cached ones)
            const maxNewEmails = 100;
            const emailsToProcess = needsProcessing.slice(0, Math.min(needsProcessing.length, maxNewEmails));
            if (needsProcessing.length > maxNewEmails) {
                console.log(`⚠️ Limited processing to ${maxNewEmails} new emails (${needsProcessing.length - maxNewEmails} skipped this time)`);
            }
            console.log(`🔄 Processing ${emailsToProcess.length} new emails (${cacheHits} already cached)`);
            // Step 2: Process uncached emails with preprocessing and AI
            const needsAI = [];
            for (const { email, index } of emailsToProcess) {
                // Not in cache, check if we can preprocess it
                const preprocessResult = emailPreprocessor_1.EmailPreprocessor.preprocess(email);
                if (preprocessResult.needsAI) {
                    needsAI.push({ email, index });
                }
                else {
                    // Email classified by preprocessing
                    const unsubscribeInfo = await this.unsubscribeService.findUnsubscribeMethod(email);
                    const analysis = {
                        isJunk: preprocessResult.category === 'marketing',
                        confidence: preprocessResult.confidence,
                        category: preprocessResult.category,
                        reasoning: preprocessResult.reasoning
                    };
                    preprocessResults.push({
                        id: email.id,
                        subject: this.getHeader(email, 'Subject'),
                        from: this.getHeader(email, 'From'),
                        analysis,
                        unsubscribeInfo
                    });
                    // Cache the preprocessed result
                    emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                }
            }
            console.log(`✅ Preprocessing complete: ${cacheHits} from cache, ${preprocessResults.length - cacheHits} classified, ${needsAI.length} need AI analysis`);
            // Step 2: Process emails that need AI analysis in batches
            this.currentProgress.status = 'ai-analysis';
            const batchSize = 10; // Increased batch size for better throughput
            const aiAnalyzed = [];
            if (needsAI.length > 0) {
                this.currentProgress.totalBatches = Math.ceil(needsAI.length / batchSize);
                for (let i = 0; i < needsAI.length; i += batchSize) {
                    const batch = needsAI.slice(i, i + batchSize);
                    const batchNum = Math.floor(i / batchSize) + 1;
                    this.currentProgress.currentBatch = batchNum;
                    console.log(`🤖 AI analyzing batch ${batchNum}/${this.currentProgress.totalBatches} (${batch.length} emails)...`);
                    // Process emails in batch with parallel unsubscribe info fetching
                    const batchPromises = batch.map(async ({ email, index }) => {
                        try {
                            const [analysis, unsubscribeInfo] = await Promise.all([
                                this.aiService.analyzeEmail(email),
                                this.unsubscribeService.findUnsubscribeMethod(email)
                            ]);
                            const result = {
                                id: email.id,
                                subject: this.getHeader(email, 'Subject'),
                                from: this.getHeader(email, 'From'),
                                analysis,
                                unsubscribeInfo
                            };
                            // Cache the AI analysis result
                            emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                            return result;
                        }
                        catch (error) {
                            console.error(`Error processing email ${email.id}:`, error);
                            return null;
                        }
                    });
                    const batchResults = await Promise.all(batchPromises);
                    const successfulResults = batchResults.filter(result => result !== null);
                    aiAnalyzed.push(...successfulResults);
                    this.currentProgress.aiCalls += batch.length;
                    this.currentProgress.processed = preprocessResults.length + aiAnalyzed.length;
                    // Add shorter delay between AI batches (faster processing)
                    if (batchNum < this.currentProgress.totalBatches) {
                        console.log(`⏱️  Waiting 1 second before next AI batch...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            else {
                // No AI analysis needed
                this.currentProgress.processed = preprocessResults.length;
            }
            // Combine preprocessed and AI-analyzed results
            const analyzed = [...preprocessResults, ...aiAnalyzed];
            const junkEmails = analyzed.filter(email => email.analysis.isJunk);
            console.log(`🔍 Found ${junkEmails.length} junk emails, expanding to find ALL emails from these senders...`);
            // For each junk sender, gather ALL their emails - now in parallel for speed
            this.currentProgress.status = 'expanding';
            this.currentProgress.expandingDomains = 0;
            // Get unique domains to process
            const domainsToProcess = [...new Set(junkEmails.map(email => this.extractDomain(email.from)))];
            this.currentProgress.totalDomains = domainsToProcess.length;
            const expandedEmails = new Map();
            console.log(`🔍 Expanding emails from ${domainsToProcess.length} domains in parallel...`);
            // Process domains in parallel with controlled concurrency
            const concurrency = 3; // Process 3 domains at a time
            const results = [];
            for (let i = 0; i < domainsToProcess.length; i += concurrency) {
                const batch = domainsToProcess.slice(i, i + concurrency);
                const batchPromises = batch.map(async (domain) => {
                    console.log(`📧 Expanding emails from domain: ${domain}`);
                    try {
                        const allEmailsFromDomain = await this.gmailService.getAllEmailsFromDomain(domain);
                        // Get unsubscribe info from the first email of this domain (representative)
                        let sampleUnsubscribeInfo = null;
                        if (allEmailsFromDomain.length > 0) {
                            try {
                                sampleUnsubscribeInfo = await this.unsubscribeService.findUnsubscribeMethod(allEmailsFromDomain[0]);
                            }
                            catch (error) {
                                console.error(`Error getting unsubscribe info for ${domain}:`, error);
                            }
                        }
                        const domainEmails = allEmailsFromDomain.map(fullEmail => ({
                            id: fullEmail.id,
                            from: this.getHeader(fullEmail, 'From'),
                            subject: this.getHeader(fullEmail, 'Subject'),
                            analysis: {
                                isJunk: true,
                                confidence: 0.9,
                                category: 'marketing',
                                reasoning: 'Expanded from confirmed junk sender'
                            },
                            unsubscribeInfo: sampleUnsubscribeInfo // Use the sample for all emails from this domain
                        }));
                        return { domain, emails: domainEmails };
                    }
                    catch (error) {
                        console.error(`Error expanding emails from ${domain}:`, error);
                        return { domain, emails: [] };
                    }
                });
                const batchResults = await Promise.all(batchPromises);
                // Add results to expandedEmails map
                for (const { domain, emails } of batchResults) {
                    for (const emailData of emails) {
                        expandedEmails.set(emailData.id, emailData);
                    }
                    this.currentProgress.expandingDomains++;
                    this.currentProgress.expandedEmails = expandedEmails.size;
                }
                console.log(`✅ Processed ${this.currentProgress.expandingDomains}/${domainsToProcess.length} domains, found ${expandedEmails.size} emails total`);
            }
            console.log(`📈 Expanded to ${expandedEmails.size} total emails from junk senders`);
            // Group the expanded emails by sender domain
            const groupedEmails = this.groupEmailsBySender(Array.from(expandedEmails.values()));
            // Update progress to complete
            this.currentProgress = {
                ...this.currentProgress,
                status: 'complete',
                processed: analyzed.length,
                endTime: Date.now()
            };
            console.log(`✅ Scan complete: ${analyzed.length} initially processed, ${expandedEmails.size} total emails found from junk senders`);
            console.log(`📊 Stats: ${preprocessResults.length} preprocessed, ${this.currentProgress.aiCalls} AI calls made`);
            res.json({
                total: emails.length,
                processed: analyzed.length,
                junkEmails: junkEmails.length,
                expandedEmails: expandedEmails.size,
                groups: groupedEmails,
                stats: {
                    preprocessed: preprocessResults.length,
                    aiAnalyzed: aiAnalyzed.length,
                    expandedTotal: expandedEmails.size,
                    totalAICalls: this.currentProgress.aiCalls,
                    processingTime: this.currentProgress.endTime - this.currentProgress.startTime
                }
            });
        }
        catch (error) {
            console.error('Error scanning emails:', error);
            this.currentProgress = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            res.status(500).json({ error: 'Failed to scan emails' });
        }
    }
    async unsubscribeFromSender(req, res) {
        try {
            const { senderDomain, emailIds } = req.body;
            if (!senderDomain || !emailIds || !Array.isArray(emailIds)) {
                res.status(400).json({ error: 'Missing required fields: senderDomain and emailIds' });
                return;
            }
            // Try to load saved tokens first
            const hasTokens = await this.gmailService.loadSavedTokens();
            if (!hasTokens) {
                res.status(401).json({ error: 'Not authenticated. Please authenticate first.' });
                return;
            }
            // Perform bulk unsubscribe once for the entire sender domain
            try {
                const result = await this.unsubscribeService.performBulkUnsubscribe(emailIds, senderDomain, this.gmailService);
                res.json({
                    senderDomain,
                    success: result.success,
                    method: result.method,
                    details: result.details,
                    archived: result.archived,
                    emailCount: emailIds.length,
                    message: result.success
                        ? `Successfully unsubscribed from ${senderDomain} (affects ${emailIds.length} emails)${result.archived ? ' and archived emails' : ''}`
                        : `Failed to unsubscribe from ${senderDomain}`
                });
            }
            catch (error) {
                res.json({
                    senderDomain,
                    success: false,
                    error: 'Failed to unsubscribe',
                    emailCount: emailIds.length
                });
            }
        }
        catch (error) {
            console.error('Error unsubscribing:', error);
            res.status(500).json({ error: 'Failed to process unsubscribe request' });
        }
    }
    async skipSender(req, res) {
        try {
            const { senderDomain, senderName, reason } = req.body;
            if (!senderDomain) {
                res.status(400).json({ error: 'Sender domain is required' });
                return;
            }
            // Add to skip list
            skipList_1.SkipList.addToSkipList(senderDomain, senderName || senderDomain, reason);
            res.json({
                success: true,
                message: `${senderDomain} added to skip list`,
                senderDomain
            });
        }
        catch (error) {
            console.error('Error skipping sender:', error);
            res.status(500).json({ error: 'Failed to skip sender' });
        }
    }
    async getSkippedSenders(req, res) {
        try {
            const skippedSenders = skipList_1.SkipList.getSkippedSenders();
            res.json({ skippedSenders });
        }
        catch (error) {
            console.error('Error getting skipped senders:', error);
            res.status(500).json({ error: 'Failed to get skipped senders' });
        }
    }
    async removeFromSkipList(req, res) {
        try {
            const { senderDomain } = req.body;
            if (!senderDomain) {
                res.status(400).json({ error: 'Sender domain is required' });
                return;
            }
            skipList_1.SkipList.removeFromSkipList(senderDomain);
            res.json({
                success: true,
                message: `${senderDomain} removed from skip list`,
                senderDomain
            });
        }
        catch (error) {
            console.error('Error removing from skip list:', error);
            res.status(500).json({ error: 'Failed to remove from skip list' });
        }
    }
    async checkAuthStatus(req, res) {
        try {
            const isAuthenticated = await this.gmailService.isAuthenticated();
            res.json({
                isAuthenticated,
                message: isAuthenticated ? 'Gmail account already connected' : 'Gmail authentication required'
            });
        }
        catch (error) {
            console.error('Error checking auth status:', error);
            res.json({
                isAuthenticated: false,
                message: 'Gmail authentication required'
            });
        }
    }
    getHeader(email, headerName) {
        const header = email.payload.headers.find((h) => h.name === headerName);
        return header ? header.value : '';
    }
    groupEmailsBySender(emails) {
        const groups = new Map();
        emails.forEach(email => {
            const fromHeader = email.from || '';
            const domain = this.extractDomain(fromHeader);
            const senderName = this.extractSenderName(fromHeader);
            // Skip emails from senders in the skip list
            if (skipList_1.SkipList.isSkipped(domain)) {
                console.log(`⏭️ Skipping emails from ${domain} (in skip list)`);
                return;
            }
            if (!groups.has(domain)) {
                groups.set(domain, {
                    domain,
                    senderName,
                    count: 0,
                    emails: [],
                    totalConfidence: 0,
                    hasUnsubscribe: false
                });
            }
            const group = groups.get(domain);
            group.count++;
            group.emails.push(email);
            group.totalConfidence += email.analysis.confidence || 0;
            if (email.unsubscribeInfo && email.unsubscribeInfo.hasUnsubscribeLink) {
                group.hasUnsubscribe = true;
            }
        });
        // Convert to array and calculate average confidence
        return Array.from(groups.values()).map(group => ({
            ...group,
            averageConfidence: Math.round((group.totalConfidence / group.count) * 100),
            emailIds: group.emails.map((e) => e.id)
        })).sort((a, b) => b.count - a.count); // Sort by count descending
    }
    extractDomain(fromHeader) {
        const match = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
        if (match) {
            const email = match[1] || match[0];
            const domain = email.split('@')[1];
            return domain || 'unknown';
        }
        return 'unknown';
    }
    extractSenderName(fromHeader) {
        const match = fromHeader.match(/^([^<]+)</);
        if (match) {
            return match[1].trim().replace(/"/g, '');
        }
        // If no name found, try to extract from email
        const emailMatch = fromHeader.match(/([^@]+)@/);
        if (emailMatch) {
            return emailMatch[1].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        return 'Unknown Sender';
    }
}
exports.EmailController = EmailController;
