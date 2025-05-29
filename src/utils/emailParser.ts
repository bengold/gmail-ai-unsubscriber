export function parseEmailContent(emailBody: string): { subject: string; sender: string; body: string } {
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

export function isJunkEmail(email: { subject: string; sender: string }): boolean {
    const junkKeywords = ['unsubscribe', 'spam', 'promotion', 'offer', 'deal'];
    const lowerCaseSubject = email.subject.toLowerCase();
    
    return junkKeywords.some(keyword => lowerCaseSubject.includes(keyword));
}