"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailController = void 0;
const gmailService_1 = require("../services/gmailService");
const aiService_1 = require("../services/aiService");
const unifiedAIService_1 = require("../services/unifiedAIService");
const unsubscribeService_1 = require("../services/unsubscribeService");
const claudeService_1 = require("../services/claudeService");
const emailPreprocessor_1 = require("../utils/emailPreprocessor");
const emailCache_1 = require("../utils/emailCache");
const skipList_1 = require("../utils/skipList");
const logger_1 = require("../utils/logger");
class EmailController {
    constructor() {
        this.currentProgress = null;
        this.gmailService = new gmailService_1.GmailService();
        this.aiService = new aiService_1.AIService();
        this.unifiedAIService = new unifiedAIService_1.UnifiedAIService();
        this.unsubscribeService = new unsubscribeService_1.UnsubscribeService();
        this.claudeService = new claudeService_1.ClaudeService();
        // Log AI configuration on startup
        const aiConfig = this.unifiedAIService.getConfigInfo();
        logger_1.logger.info(`Using AI Provider: ${aiConfig.provider} with model: ${aiConfig.model}`);
        if (aiConfig.baseURL) {
            logger_1.logger.info(`API Base URL: ${aiConfig.baseURL}`);
        }
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
            logger_1.logger.error('OAuth callback error:', error);
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
            logger_1.logger.info(`Found ${emails.length} potential subscription emails`);
            // Update progress with initial totals
            this.currentProgress = {
                ...this.currentProgress,
                status: 'preprocessing',
                total: emails.length
            };
            logger_1.logger.info(`Checking cache and preprocessing ${emails.length} emails...`);
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
            logger_1.logger.info(`Cache check complete: ${cacheHits} from cache, ${needsProcessing.length} need processing`);
            // Now limit only the emails that need processing (not cached ones)
            const maxNewEmails = 100;
            const emailsToProcess = needsProcessing.slice(0, Math.min(needsProcessing.length, maxNewEmails));
            if (needsProcessing.length > maxNewEmails) {
                logger_1.logger.warn(`Limited processing to ${maxNewEmails} new emails (${needsProcessing.length - maxNewEmails} skipped this time)`);
            }
            logger_1.logger.info(`Processing ${emailsToProcess.length} new emails (${cacheHits} already cached)`);
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
                        date: new Date(parseInt(email.internalDate)).toISOString(),
                        internalDate: email.internalDate,
                        analysis,
                        unsubscribeInfo
                    });
                    // Cache the preprocessed result
                    emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                }
            }
            logger_1.logger.info(`Preprocessing complete: ${cacheHits} from cache, ${preprocessResults.length - cacheHits} classified, ${needsAI.length} need AI analysis`);
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
                    logger_1.logger.progress(`AI analyzing batch ${batchNum}/${this.currentProgress.totalBatches} (${batch.length} emails)`);
                    // Process emails in batch with parallel unsubscribe info fetching
                    const batchPromises = batch.map(async ({ email, index }) => {
                        try {
                            const [analysis, unsubscribeInfo] = await Promise.all([
                                this.unifiedAIService.analyzeEmail(email),
                                this.unsubscribeService.findUnsubscribeMethod(email)
                            ]);
                            const result = {
                                id: email.id,
                                subject: this.getHeader(email, 'Subject'),
                                from: this.getHeader(email, 'From'),
                                date: new Date(parseInt(email.internalDate)).toISOString(),
                                internalDate: email.internalDate,
                                analysis,
                                unsubscribeInfo
                            };
                            // Cache the AI analysis result
                            emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                            return result;
                        }
                        catch (error) {
                            logger_1.logger.error(`Error processing email ${email.id}:`, error);
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
                        logger_1.logger.debug(`Waiting 1 second before next AI batch...`);
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
            logger_1.logger.info(`Found ${junkEmails.length} junk emails, expanding to find ALL emails from these senders`);
            // For each junk sender, gather ALL their emails - now in parallel for speed
            this.currentProgress.status = 'expanding';
            this.currentProgress.expandingDomains = 0;
            // Get unique domains to process
            const domainsToProcess = [...new Set(junkEmails.map(email => this.extractDomain(email.from)))];
            this.currentProgress.totalDomains = domainsToProcess.length;
            const expandedEmails = new Map();
            logger_1.logger.info(`Expanding emails from ${domainsToProcess.length} domains in parallel...`);
            // Process domains in parallel with controlled concurrency
            const concurrency = 3; // Process 3 domains at a time
            const results = [];
            for (let i = 0; i < domainsToProcess.length; i += concurrency) {
                const batch = domainsToProcess.slice(i, i + concurrency);
                const batchPromises = batch.map(async (domain) => {
                    logger_1.logger.debug(`Expanding emails from domain: ${domain}`);
                    try {
                        const allEmailsFromDomain = await this.gmailService.getAllEmailsFromDomain(domain);
                        // Get unsubscribe info from the first email of this domain (representative)
                        let sampleUnsubscribeInfo = null;
                        if (allEmailsFromDomain.length > 0) {
                            try {
                                sampleUnsubscribeInfo = await this.unsubscribeService.findUnsubscribeMethod(allEmailsFromDomain[0]);
                            }
                            catch (error) {
                                logger_1.logger.error(`Error getting unsubscribe info for ${domain}:`, error);
                            }
                        }
                        const domainEmails = allEmailsFromDomain.map(fullEmail => {
                            const confidence = emailPreprocessor_1.EmailPreprocessor.calculateConfidenceScore(fullEmail, allEmailsFromDomain.length, sampleUnsubscribeInfo?.hasUnsubscribeLink || false);
                            return {
                                id: fullEmail.id,
                                from: this.getHeader(fullEmail, 'From'),
                                subject: this.getHeader(fullEmail, 'Subject'),
                                date: new Date(parseInt(fullEmail.internalDate)).toISOString(),
                                internalDate: fullEmail.internalDate,
                                analysis: {
                                    isJunk: true,
                                    confidence: confidence,
                                    category: 'marketing',
                                    reasoning: `Expanded from confirmed junk sender (${Math.round(confidence * 100)}% confidence)`
                                },
                                unsubscribeInfo: sampleUnsubscribeInfo // Use the sample for all emails from this domain
                            };
                        });
                        return { domain, emails: domainEmails };
                    }
                    catch (error) {
                        logger_1.logger.error(`Error expanding emails from ${domain}:`, error);
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
                logger_1.logger.progress(`Processed ${this.currentProgress.expandingDomains}/${domainsToProcess.length} domains, found ${expandedEmails.size} emails total`);
            }
            logger_1.logger.info(`Expanded to ${expandedEmails.size} total emails from junk senders`);
            // Group the expanded emails by sender domain
            const groupedEmails = this.groupEmailsBySender(Array.from(expandedEmails.values()));
            // Debug: Log the first group structure
            if (groupedEmails.length > 0) {
                logger_1.logger.info(`First group structure:`, {
                    domain: groupedEmails[0].domain,
                    emailCount: groupedEmails[0].emails?.length || 0,
                    hasEmails: !!groupedEmails[0].emails,
                    firstEmail: groupedEmails[0].emails?.[0]
                });
            }
            // Update progress to complete
            this.currentProgress = {
                ...this.currentProgress,
                status: 'complete',
                processed: analyzed.length,
                endTime: Date.now()
            };
            logger_1.logger.info(`Scan complete: ${analyzed.length} initially processed, ${expandedEmails.size} total emails found from junk senders`);
            logger_1.logger.info(`Stats: ${preprocessResults.length} preprocessed, ${this.currentProgress.aiCalls} AI calls made`);
            res.json({
                total: emails.length,
                processed: analyzed.length,
                junkEmails: junkEmails.length,
                expandedEmails: expandedEmails.size,
                groups: groupedEmails,
                stats: {
                    totalEmails: emails.length,
                    processedEmails: analyzed.length,
                    unsubscribedEmails: 0,
                    cacheHits: preprocessResults.length,
                    preprocessed: preprocessResults.length,
                    aiAnalyzed: aiAnalyzed.length,
                    expandedTotal: expandedEmails.size,
                    totalAICalls: this.currentProgress.aiCalls,
                    processingTime: this.currentProgress.endTime - this.currentProgress.startTime
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error scanning emails:', error);
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
            logger_1.logger.error('Error unsubscribing:', error);
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
            logger_1.logger.error('Error skipping sender:', error);
            res.status(500).json({ error: 'Failed to skip sender' });
        }
    }
    async getSkippedSenders(req, res) {
        try {
            const skippedSenders = skipList_1.SkipList.getSkippedSenders();
            res.json({ skippedSenders });
        }
        catch (error) {
            logger_1.logger.error('Error getting skipped senders:', error);
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
            logger_1.logger.error('Error removing from skip list:', error);
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
            logger_1.logger.error('Error checking auth status:', error);
            res.json({
                isAuthenticated: false,
                message: 'Gmail authentication required'
            });
        }
    }
    async enhancedUnsubscribe(req, res) {
        try {
            const { emailId, senderDomain } = req.body;
            if (!emailId) {
                res.status(400).json({ error: 'Missing required field: emailId' });
                return;
            }
            // Try to load saved tokens first
            const hasTokens = await this.gmailService.loadSavedTokens();
            if (!hasTokens) {
                res.status(401).json({ error: 'Not authenticated. Please authenticate first.' });
                return;
            }
            try {
                const result = await this.unsubscribeService.performEnhancedUnsubscribe(emailId, this.gmailService);
                res.json({
                    emailId,
                    senderDomain: senderDomain || 'unknown',
                    success: result.success,
                    method: result.method,
                    message: result.message,
                    url: result.url,
                    error: result.error,
                    enhanced: true
                });
            }
            catch (error) {
                res.json({
                    emailId,
                    senderDomain: senderDomain || 'unknown',
                    success: false,
                    method: 'manual-fallback',
                    message: 'Enhanced unsubscribe failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    enhanced: true
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in enhanced unsubscribe:', error);
            res.status(500).json({ error: 'Failed to process enhanced unsubscribe request' });
        }
    }
    async enhancedBulkUnsubscribe(req, res) {
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
            // Process only the first email for now with enhanced unsubscribe
            // In the future, this could be extended to handle more complex scenarios
            if (emailIds.length > 0) {
                try {
                    const result = await this.unsubscribeService.performEnhancedUnsubscribe(emailIds[0], this.gmailService);
                    // Archive all emails regardless of unsubscribe success
                    try {
                        await this.gmailService.archiveMessages(emailIds);
                    }
                    catch (archiveError) {
                        logger_1.logger.error(`Error archiving emails from ${senderDomain}:`, archiveError);
                    }
                    res.json({
                        senderDomain,
                        success: result.success,
                        method: result.method,
                        message: result.message,
                        url: result.url,
                        error: result.error,
                        emailCount: emailIds.length,
                        enhanced: true
                    });
                }
                catch (error) {
                    res.json({
                        senderDomain,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        emailCount: emailIds.length,
                        enhanced: true
                    });
                }
            }
            else {
                res.json({
                    senderDomain,
                    success: false,
                    error: 'No emails provided',
                    emailCount: 0,
                    enhanced: true
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in enhanced bulk unsubscribe:', error);
            res.status(500).json({ error: 'Failed to process enhanced bulk unsubscribe request' });
        }
    }
    async testComputerUse(req, res) {
        try {
            const { url } = req.body;
            if (!url) {
                res.status(400).json({ error: 'URL is required for computer use test' });
                return;
            }
            // Create a mock analysis result for testing
            const mockAnalysis = {
                unsubscribeLinks: [url],
                complexity: 'complex',
                recommendation: 'Computer use automation recommended'
            };
            const result = await this.claudeService.attemptUnsubscribe('test-email-id', mockAnalysis);
            res.json({
                success: result.success,
                method: result.method,
                message: result.message,
                url: result.url,
                steps: result.steps,
                error: result.error
            });
        }
        catch (error) {
            logger_1.logger.error('Error testing computer use:', error);
            res.status(500).json({ error: 'Failed to test computer use functionality' });
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
                logger_1.logger.debug(`Skipping emails from ${domain} (in skip list)`);
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
        // Convert to array and calculate average confidence with group size boost
        return Array.from(groups.values()).map(group => {
            const baseConfidence = group.totalConfidence / group.count;
            // Apply group size boost - more emails from same sender = higher confidence it's promotional
            const groupSizeBoost = Math.min((group.count - 1) * 0.02, 0.1); // Up to 10% boost for large groups
            const adjustedConfidence = Math.min(baseConfidence + groupSizeBoost, 0.95);
            // Log the first group to debug
            if (groups.size > 0 && group === groups.values().next().value) {
                logger_1.logger.debug(`First email group has ${group.emails.length} emails with subjects:`, group.emails.slice(0, 3).map((e) => e.subject));
            }
            return {
                ...group,
                averageConfidence: Math.round(adjustedConfidence * 100),
                emailIds: group.emails.map((e) => e.id)
            };
        }).sort((a, b) => b.count - a.count); // Sort by count descending
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
    async scanMoreEmails(req, res) {
        try {
            // Check if user is authenticated
            const hasTokens = await this.gmailService.loadSavedTokens();
            if (!hasTokens) {
                res.status(401).json({ error: 'Not authenticated. Please authenticate first.' });
                return;
            }
            // Get additional emails - for now, just get all and filter
            const { skipProcessed = true } = req.body;
            logger_1.logger.info(`Scanning for more emails...`);
            const emails = await this.gmailService.getSubscriptionEmails();
            logger_1.logger.info(`Found ${emails.length} total emails`);
            if (emails.length === 0) {
                res.json({
                    hasMore: false,
                    groups: [],
                    stats: {
                        processed: 0,
                        junkEmails: 0,
                        expandedEmails: 0
                    }
                });
                return;
            }
            // Process emails with preprocessing and AI analysis
            const preprocessResults = [];
            const needsAI = [];
            let cacheHits = 0;
            // Check cache and preprocess
            for (const email of emails) {
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
                    continue;
                }
                const preprocessResult = emailPreprocessor_1.EmailPreprocessor.preprocess(email);
                if (preprocessResult.needsAI) {
                    needsAI.push(email);
                }
                else {
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
                        date: new Date(parseInt(email.internalDate)).toISOString(),
                        internalDate: email.internalDate,
                        analysis,
                        unsubscribeInfo
                    });
                    emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                }
            }
            // Process emails that need AI analysis
            const aiAnalyzed = [];
            const batchSize = 5; // Smaller batch for continuous scanning
            if (needsAI.length > 0) {
                for (let i = 0; i < needsAI.length; i += batchSize) {
                    const batch = needsAI.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (email) => {
                        try {
                            const [analysis, unsubscribeInfo] = await Promise.all([
                                this.unifiedAIService.analyzeEmail(email),
                                this.unsubscribeService.findUnsubscribeMethod(email)
                            ]);
                            const result = {
                                id: email.id,
                                subject: this.getHeader(email, 'Subject'),
                                from: this.getHeader(email, 'From'),
                                date: new Date(parseInt(email.internalDate)).toISOString(),
                                internalDate: email.internalDate,
                                analysis,
                                unsubscribeInfo
                            };
                            emailCache_1.EmailCache.cacheAnalysis(email, analysis, unsubscribeInfo);
                            return result;
                        }
                        catch (error) {
                            logger_1.logger.error(`Error processing email ${email.id}:`, error);
                            return null;
                        }
                    });
                    const batchResults = await Promise.all(batchPromises);
                    const successfulResults = batchResults.filter(result => result !== null);
                    aiAnalyzed.push(...successfulResults);
                    // Small delay between batches
                    if (i + batchSize < needsAI.length) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            // Combine results
            const analyzed = [...preprocessResults, ...aiAnalyzed];
            const junkEmails = analyzed.filter(email => email.analysis.isJunk);
            logger_1.logger.info(`Found ${junkEmails.length} additional junk emails`);
            // For junk emails, expand to get all emails from same senders
            const expandedEmails = new Map();
            if (junkEmails.length > 0) {
                const domainsToProcess = [...new Set(junkEmails.map(email => this.extractDomain(email.from)))];
                // Process domains with limited concurrency
                for (const domain of domainsToProcess) {
                    try {
                        const allEmailsFromDomain = await this.gmailService.getAllEmailsFromDomain(domain);
                        let sampleUnsubscribeInfo = null;
                        if (allEmailsFromDomain.length > 0) {
                            try {
                                sampleUnsubscribeInfo = await this.unsubscribeService.findUnsubscribeMethod(allEmailsFromDomain[0]);
                            }
                            catch (error) {
                                logger_1.logger.error(`Error getting unsubscribe info for ${domain}:`, error);
                            }
                        }
                        const domainEmails = allEmailsFromDomain.map(fullEmail => {
                            const confidence = emailPreprocessor_1.EmailPreprocessor.calculateConfidenceScore(fullEmail, allEmailsFromDomain.length, sampleUnsubscribeInfo?.hasUnsubscribeLink || false);
                            return {
                                id: fullEmail.id,
                                from: this.getHeader(fullEmail, 'From'),
                                subject: this.getHeader(fullEmail, 'Subject'),
                                date: new Date(parseInt(fullEmail.internalDate)).toISOString(),
                                internalDate: fullEmail.internalDate,
                                analysis: {
                                    isJunk: true,
                                    confidence: confidence,
                                    category: 'marketing',
                                    reasoning: `Expanded from confirmed junk sender (${Math.round(confidence * 100)}% confidence)`
                                },
                                unsubscribeInfo: sampleUnsubscribeInfo
                            };
                        });
                        for (const emailData of domainEmails) {
                            expandedEmails.set(emailData.id, emailData);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Error expanding emails from ${domain}:`, error);
                    }
                }
            }
            // Group the emails by sender domain
            const groupedEmails = this.groupEmailsBySender(Array.from(expandedEmails.values()));
            logger_1.logger.info(`Continuous scan complete: ${analyzed.length} processed, ${expandedEmails.size} total emails found`);
            res.json({
                hasMore: false, // For now, always false since we process all available emails
                processed: analyzed.length,
                junkEmails: junkEmails.length,
                expandedEmails: expandedEmails.size,
                groups: groupedEmails,
                stats: {
                    preprocessed: preprocessResults.length,
                    aiAnalyzed: aiAnalyzed.length,
                    expandedTotal: expandedEmails.size,
                    cacheHits
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error scanning more emails:', error);
            res.status(500).json({ error: 'Failed to scan more emails' });
        }
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
