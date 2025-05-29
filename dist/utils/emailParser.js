"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEmailContent = parseEmailContent;
exports.isJunkEmail = isJunkEmail;
function parseEmailContent(emailBody) {
    const subjectMatch = emailBody.match(/Subject: (.*)/);
    const senderMatch = emailBody.match(/From: (.*)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : '';
    const sender = senderMatch ? senderMatch[1].trim() : '';
    return {
        subject,
        sender,
        body: emailBody
    };
}
function isJunkEmail(email) {
    const junkKeywords = ['unsubscribe', 'spam', 'promotion', 'offer', 'deal'];
    const lowerCaseSubject = email.subject.toLowerCase();
    return junkKeywords.some(keyword => lowerCaseSubject.includes(keyword));
}
