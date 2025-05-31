export interface Email {
    id: string;
    subject: string;
    sender: string;
    date: Date;
    isJunk: boolean;
    body?: string;
}

export interface UnsubscribeRequest {
    emailId: string;
    confirmation: boolean;
}

export interface EmailData {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      data?: string;
    };
    parts?: Array<{
      body: {
        data?: string;
      };
      mimeType: string;
    }>;
  };
}

export interface UnsubscribeInfo {
  hasUnsubscribeLink: boolean;
  unsubscribeUrl?: string;
  unsubscribeLinks: string[];
  listUnsubscribeHeader?: string;
  isMarketingEmail: boolean;
  confidence: number;
  sender: string;
  subject: string;
  method?: string;
  complexity?: 'simple' | 'medium' | 'complex';
}

export interface AIAnalysisResult {
  isJunk: boolean;
  confidence: number;
  category: 'marketing' | 'newsletter' | 'promotional' | 'spam' | 'legitimate';
  unsubscribeMethod: 'link' | 'header' | 'reply' | 'none';
  reasoning: string;
}