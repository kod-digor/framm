export type JmapSession = {
  apiUrl: string;
  uploadUrl?: string;
  downloadUrl?: string;
  primaryAccounts?: Record<string, string>;
  accounts?: Record<string, { name?: string }>;
};

export type JmapMailbox = {
  id: string;
  name: string;
  role?: string | null;
  unreadEmails?: number;
  totalEmails?: number;
};

export type JmapEmailAddress = {
  name?: string;
  email: string;
};

export type JmapEmailListItem = {
  id: string;
  threadId?: string;
  subject?: string | null;
  from?: JmapEmailAddress[] | null;
  receivedAt?: string;
  preview?: string | null;
  keywords?: Record<string, boolean>;
  hasAttachment?: boolean;
};

export type JmapEmailDetail = JmapEmailListItem & {
  to?: JmapEmailAddress[] | null;
  cc?: JmapEmailAddress[] | null;
  textBody?: Array<{ partId: string; type: string }>;
  htmlBody?: Array<{ partId: string; type: string }>;
  bodyValues?: Record<string, { value: string; isEncodingProblem?: boolean }>;
};

export type JmapRequestBody = {
  using: string[];
  methodCalls: [string, Record<string, unknown>, string][];
};

export type JmapResponseBody = {
  methodResponses: [string, Record<string, unknown>, string][];
};
