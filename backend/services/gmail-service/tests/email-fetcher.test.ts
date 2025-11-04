import { EmailFetcher } from '../src/email-fetcher';
import { GmailClient } from '../src/gmail-client';
import { TokenManager } from '../src/token-manager';

jest.mock('../src/gmail-client');
jest.mock('../src/token-manager');

describe('EmailFetcher', () => {
  let emailFetcher: EmailFetcher;
  let mockGmailClient: jest.Mocked<GmailClient>;
  let mockTokenManager: jest.Mocked<TokenManager>;

  const mockUserId = 'test-user-123';
  const mockTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expiry_date: Date.now() + 3600000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTokenManager = {
      getUserTokens: jest.fn().mockResolvedValue(mockTokens),
    } as any;

    mockGmailClient = {
      getClient: jest.fn().mockResolvedValue({
        users: {
          messages: {
            list: jest.fn(),
            get: jest.fn(),
          },
        },
      }),
    } as any;

    emailFetcher = new EmailFetcher(mockGmailClient, mockTokenManager);
  });

  describe('fetchEmailsSince', () => {
    it('should fetch emails since a specific date', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: [
            { id: 'msg-1' },
            { id: 'msg-2' },
            { id: 'msg-3' },
          ],
        },
      };

      const mockFullMessage = {
        data: {
          id: 'msg-1',
          payload: {
            headers: [
              { name: 'From', value: 'alerts@hdfcbank.com' },
              { name: 'Subject', value: 'Transaction Alert' },
              { name: 'Date', value: '2025-11-02' },
            ],
            body: { data: 'base64encodeddata' },
          },
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue(mockFullMessage);

      const result = await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      expect(mockTokenManager.getUserTokens).toHaveBeenCalledWith(mockUserId);
      expect(gmailClient.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          q: expect.stringContaining('after:2025-11-01'),
          maxResults: 100,
        })
      );
      expect(result).toHaveLength(3);
    });

    it('should handle first sync (no since date)', async () => {
      const mockMessagesList = {
        data: {
          messages: [{ id: 'msg-1' }],
        },
      };

      const mockFullMessage = {
        data: { id: 'msg-1', payload: {} },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue(mockFullMessage);

      const result = await emailFetcher.fetchEmailsSince(mockUserId, null);

      expect(gmailClient.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.not.stringContaining('after:'),
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should filter emails from specific banks', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: [{ id: 'msg-1' }],
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { id: 'msg-1', payload: {} },
      });

      await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      const callQuery = (gmailClient.users.messages.list as jest.Mock).mock.calls[0][0].q;
      expect(callQuery).toContain('alerts@hdfcbank.com');
      expect(callQuery).toContain('alert@icicibank.com');
      expect(callQuery).toContain('sbi.cards@sbi.co.in');
    });

    it('should handle empty message list', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: [],
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);

      const result = await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      expect(result).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      const sinceDate = new Date('2025-11-01');
      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockRejectedValue(
        new Error('Gmail API rate limit exceeded')
      );

      await expect(
        emailFetcher.fetchEmailsSince(mockUserId, sinceDate)
      ).rejects.toThrow('Gmail API rate limit exceeded');
    });

    it('should limit results to prevent timeout', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: Array.from({ length: 150 }, (_, i) => ({ id: `msg-${i}` })),
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { id: 'msg-1', payload: {} },
      });

      await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      expect(gmailClient.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 100, // Should not exceed 100
        })
      );
    });

    it('should handle malformed email responses', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: [{ id: 'msg-1' }],
        },
      };

      const malformedMessage = {
        data: {
          id: 'msg-1',
          payload: null, // Malformed
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue(malformedMessage);

      const result = await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      expect(result).toHaveLength(1);
      expect(result[0].payload).toBeNull();
    });

    it('should handle token refresh on expiry', async () => {
      const sinceDate = new Date('2025-11-01');
      
      // First call fails with 401
      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock)
        .mockRejectedValueOnce({ code: 401, message: 'Unauthorized' })
        .mockResolvedValueOnce({
          data: { messages: [{ id: 'msg-1' }] },
        });

      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { id: 'msg-1', payload: {} },
      });

      // Mock token refresh
      mockTokenManager.getUserTokens.mockResolvedValueOnce({
        ...mockTokens,
        access_token: 'new-access-token',
      });

      const result = await emailFetcher.fetchEmailsSince(mockUserId, sinceDate);

      expect(mockTokenManager.getUserTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchEmailById', () => {
    it('should fetch a single email by ID', async () => {
      const messageId = 'msg-123';
      const mockFullMessage = {
        data: {
          id: messageId,
          payload: {
            headers: [
              { name: 'Subject', value: 'Transaction Alert' },
            ],
            body: { data: 'base64data' },
          },
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue(mockFullMessage);

      const result = await emailFetcher.fetchEmailById(mockUserId, messageId);

      expect(gmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      expect(result.id).toBe(messageId);
    });

    it('should handle email not found', async () => {
      const messageId = 'invalid-id';
      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.get as jest.Mock).mockRejectedValue(
        new Error('Message not found')
      );

      await expect(
        emailFetcher.fetchEmailById(mockUserId, messageId)
      ).rejects.toThrow('Message not found');
    });
  });

  describe('edge cases', () => {
    it('should handle very old sync dates', async () => {
      const veryOldDate = new Date('2020-01-01');
      const mockMessagesList = {
        data: {
          messages: [{ id: 'msg-1' }],
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { id: 'msg-1', payload: {} },
      });

      const result = await emailFetcher.fetchEmailsSince(mockUserId, veryOldDate);

      expect(result).toBeDefined();
      expect(gmailClient.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining('after:2020-01-01'),
        })
      );
    });

    it('should handle concurrent fetch requests', async () => {
      const sinceDate = new Date('2025-11-01');
      const mockMessagesList = {
        data: {
          messages: [{ id: 'msg-1' }],
        },
      };

      const gmailClient = await mockGmailClient.getClient(mockTokens);
      (gmailClient.users.messages.list as jest.Mock).mockResolvedValue(mockMessagesList);
      (gmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { id: 'msg-1', payload: {} },
      });

      const [result1, result2] = await Promise.all([
        emailFetcher.fetchEmailsSince(mockUserId, sinceDate),
        emailFetcher.fetchEmailsSince(mockUserId, sinceDate),
      ]);

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
    });
  });
});
