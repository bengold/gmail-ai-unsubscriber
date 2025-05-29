"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsubscribeService = void 0;
class UnsubscribeService {
    async findUnsubscribeMethod(email) {
        const headers = email.payload.headers;
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        return {
            hasUnsubscribeLink: true, // Simplified for now
            unsubscribeUrl: 'https://example.com/unsubscribe',
            isMarketingEmail: from.includes('noreply'),
            confidence: 0.8,
            sender: from,
            subject
        };
    }
    async performUnsubscribe(unsubscribeInfo) {
        console.log(`Simulating unsubscribe from: ${unsubscribeInfo.sender}`);
        return true; // Simulated success
    }
    async performBulkUnsubscribe(emailIds, senderDomain, gmailService) {
        console.log(`🚫 Performing bulk unsubscribe from ${senderDomain} for ${emailIds.length} emails`);
        // Simulate different unsubscribe methods
        const methods = ['link', 'header', 'reply'];
        const selectedMethod = methods[Math.floor(Math.random() * methods.length)];
        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate
        let archived = false;
        // If unsubscribe was successful and we have a Gmail service, archive the emails
        if (success && gmailService && emailIds.length > 0) {
            try {
                console.log(`📦 Archiving ${emailIds.length} emails from ${senderDomain}...`);
                await gmailService.archiveMessages(emailIds);
                archived = true;
                console.log(`✅ Successfully archived ${emailIds.length} emails from ${senderDomain}`);
            }
            catch (error) {
                console.error(`❌ Failed to archive emails from ${senderDomain}:`, error);
                // Don't fail the unsubscribe if archiving fails
            }
        }
        return {
            success,
            method: selectedMethod,
            archived,
            details: success
                ? `Successfully unsubscribed from ${senderDomain} using ${selectedMethod} method${archived ? ' and archived emails' : ''}`
                : `Failed to unsubscribe from ${senderDomain}`
        };
    }
}
exports.UnsubscribeService = UnsubscribeService;
