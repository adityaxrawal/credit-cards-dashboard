/**
 * Gmail API Mock
 * Provides mock Gmail API responses for testing
 */

export interface MockGmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: {
      data?: string;
      size: number;
    };
    parts?: Array<{
      mimeType: string;
      body: {
        data?: string;
        size: number;
      };
    }>;
  };
  internalDate: string;
}

export interface MockGmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Create a mock Gmail message with transaction data
 */
export const createMockGmailMessage = (overrides?: Partial<MockGmailMessage>): MockGmailMessage => {
  const defaultMessage: MockGmailMessage = {
    id: "msg-" + Math.random().toString(36).substr(2, 9),
    threadId: "thread-" + Math.random().toString(36).substr(2, 9),
    labelIds: ["INBOX"],
    snippet: "Transaction alert: Purchase of ₹1,234.00 at TEST MERCHANT",
    payload: {
      headers: [
        { name: "From", value: "alerts@example.com" },
        { name: "Subject", value: "Credit Card Transaction Alert" },
        { name: "Date", value: new Date().toISOString() },
      ],
      body: {
        data: Buffer.from("Transaction of ₹1,234.00 at TEST MERCHANT on 01/01/2024").toString(
          "base64"
        ),
        size: 100,
      },
    },
    internalDate: Date.now().toString(),
  };

  return { ...defaultMessage, ...overrides };
};

/**
 * Create a mock Gmail list response
 */
export const createMockGmailListResponse = (
  messageIds: string[],
  nextPageToken?: string
): MockGmailListResponse => {
  return {
    messages: messageIds.map((id) => ({
      id,
      threadId: "thread-" + id,
    })),
    nextPageToken,
    resultSizeEstimate: messageIds.length,
  };
};

/**
 * Gmail client mock
 */
export class GmailClientMock {
  private messages: Map<string, MockGmailMessage> = new Map();
  private listResponse: MockGmailListResponse | null = null;

  /**
   * Set mock messages
   */
  setMessages(messages: MockGmailMessage[]): void {
    messages.forEach((msg) => {
      this.messages.set(msg.id, msg);
    });
  }

  /**
   * Set mock list response
   */
  setListResponse(response: MockGmailListResponse): void {
    this.listResponse = response;
  }

  /**
   * Mock gmail.users.messages.list
   */
  list = jest.fn(async (params: any) => {
    if (this.listResponse) {
      return { data: this.listResponse };
    }

    const messageIds = Array.from(this.messages.keys());
    return {
      data: createMockGmailListResponse(messageIds),
    };
  });

  /**
   * Mock gmail.users.messages.get
   */
  get = jest.fn(async (params: { id: string }) => {
    const message = this.messages.get(params.id);
    if (!message) {
      throw new Error("Message not found");
    }
    return { data: message };
  });

  /**
   * Mock gmail.users.messages.batchGet
   */
  batchGet = jest.fn(async (params: { ids: string[] }) => {
    const messages = params.ids
      .map((id) => this.messages.get(id))
      .filter((msg): msg is MockGmailMessage => msg !== undefined);

    return { data: { messages } };
  });

  /**
   * Reset the mock
   */
  reset(): void {
    this.messages.clear();
    this.listResponse = null;
    jest.clearAllMocks();
  }
}

/**
 * Create Gmail client mock
 */
export const createGmailClientMock = (): GmailClientMock => {
  return new GmailClientMock();
};

/**
 * Sample transaction email templates
 */
export const TRANSACTION_EMAIL_TEMPLATES = {
  hdfc: {
    subject: "Alert: Transaction on your HDFC Bank Credit Card",
    body: "Your HDFC Bank Credit Card ending 1234 has been used for a transaction of Rs. 2,500.00 at Amazon on 15-Jan-2024 at 10:30 AM.",
  },
  sbi: {
    subject: "SBI Card Transaction Alert",
    body: "Dear Customer, Your SBI Credit Card XX1234 has been used for INR 1,234.00 at SWIGGY BANGALORE on 15/01/2024 14:25:30.",
  },
  icici: {
    subject: "Transaction alert on your ICICI Bank Credit Card",
    body: "Your ICICI Bank Credit Card ending 5678 has been used for Rs 3,456.00 at ZOMATO on 15-Jan-24 19:45.",
  },
};
