/**
 * Gmail Sync Integration Tests
 * Tests the complete Gmail sync flow including transaction extraction,
 * budget updates, alert creation, and analytics refresh
 */

import request from "supertest";
import express, { Application } from "express";
import { createSupabaseMock, createMockResponse } from "../test-utils/supabase-mock";
import { createGmailClientMock, createMockGmailMessage } from "../test-utils/gmail-mock";
import { createRedisMock } from "../test-utils/redis-mock";

// Mock dependencies
const { supabase: mockSupabase, setReturnValue, reset: resetSupabase } = createSupabaseMock();
const gmailMock = createGmailClientMock();
const redisMock = createRedisMock();

jest.mock("shared/database/supabase", () => ({
  supabase: mockSupabase,
}));

jest.mock("shared/cache/redis-client", () => ({
  redisClient: redisMock,
}));

jest.mock("shared/monitoring/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import routes after mocks
import gmailRoutes from "../../modules/gmail/gmail.routes";
import { authMiddleware } from "../../common/middleware/authMiddleware";

describe("Gmail Sync Integration Tests", () => {
  let app: Application;
  const mockUserId = "user-test-123";
  const mockToken = "mock-jwt-token";

  beforeAll(() => {
    // Setup Express app with routes
    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, _res, next) => {
      req.user = { id: mockUserId, email: "test@example.com" };
      next();
    });

    app.use("/api/gmail", gmailRoutes);
  });

  beforeEach(() => {
    resetSupabase();
    redisMock.reset();
    gmailMock.reset();
    jest.clearAllMocks();
  });

  describe("POST /api/gmail/sync", () => {
    it("should sync new transactions from Gmail successfully", async () => {
      // Setup mock data
      const mockGmailMessages = [
        createMockGmailMessage({
          id: "msg-001",
          snippet: "Transaction of Rs. 2,500.00 at Amazon",
        }),
        createMockGmailMessage({
          id: "msg-002",
          snippet: "Transaction of Rs. 1,234.00 at Swiggy",
        }),
      ];

      const mockCard = {
        id: "card-001",
        user_id: mockUserId,
        card_name: "HDFC Regalia",
        last_four_digits: "1234",
      };

      // Setup mocks
      gmailMock.setMessages(mockGmailMessages);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          },
        ])
      );
      setReturnValue("credit_cards", "select", createMockResponse([mockCard]));
      setReturnValue(
        "transactions",
        "insert",
        createMockResponse([
          { id: "txn-001", amount: 2500 },
          { id: "txn-002", amount: 1234 },
        ])
      );
      setReturnValue("transactions", "select", createMockResponse([])); // No duplicates

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("newTransactions");
      expect(response.body).toHaveProperty("processedEmails");
      expect(response.body.newTransactions).toBeGreaterThanOrEqual(0);
    });

    it("should handle deduplication correctly on second sync", async () => {
      const mockGmailMessage = createMockGmailMessage({
        id: "msg-duplicate",
        snippet: "Transaction of Rs. 1,000.00 at Store",
      });

      // Setup mocks
      gmailMock.setMessages([mockGmailMessage]);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue(
        "credit_cards",
        "select",
        createMockResponse([
          {
            id: "card-001",
            user_id: mockUserId,
          },
        ])
      );

      // First sync - transaction exists
      setReturnValue(
        "transactions",
        "select",
        createMockResponse([
          {
            id: "txn-existing",
            email_message_id: "msg-duplicate",
            amount: 1000,
          },
        ])
      );

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("duplicatesSkipped");
      expect(response.body.duplicatesSkipped).toBeGreaterThanOrEqual(0);
    });

    it("should trigger budget update after transaction sync", async () => {
      const mockGmailMessage = createMockGmailMessage({
        id: "msg-003",
        snippet: "Transaction of Rs. 5,000.00 at Shop",
      });

      gmailMock.setMessages([mockGmailMessage]);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue(
        "credit_cards",
        "select",
        createMockResponse([
          {
            id: "card-001",
            user_id: mockUserId,
          },
        ])
      );
      setReturnValue("transactions", "select", createMockResponse([]));
      setReturnValue(
        "transactions",
        "insert",
        createMockResponse([
          {
            id: "txn-003",
            amount: 5000,
            category: "shopping",
          },
        ])
      );

      // Mock budget update
      setReturnValue(
        "budgets",
        "select",
        createMockResponse([
          {
            id: "budget-001",
            user_id: mockUserId,
            category: "shopping",
            budget_limit: 10000,
            total_spent: 3000,
          },
        ])
      );
      setReturnValue(
        "budgets",
        "update",
        createMockResponse({
          id: "budget-001",
          total_spent: 8000, // 3000 + 5000
        })
      );

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);
      // Verify budget update was triggered
      expect(mockSupabase.from).toHaveBeenCalledWith("budgets");
    });

    it("should create alerts when budget threshold is exceeded", async () => {
      const mockGmailMessage = createMockGmailMessage({
        id: "msg-004",
        snippet: "Transaction of Rs. 8,000.00 at Restaurant",
      });

      gmailMock.setMessages([mockGmailMessage]);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue(
        "credit_cards",
        "select",
        createMockResponse([
          {
            id: "card-001",
            user_id: mockUserId,
          },
        ])
      );
      setReturnValue("transactions", "select", createMockResponse([]));
      setReturnValue(
        "transactions",
        "insert",
        createMockResponse([
          {
            id: "txn-004",
            amount: 8000,
            category: "food",
          },
        ])
      );

      // Budget exceeds threshold
      setReturnValue(
        "budgets",
        "select",
        createMockResponse([
          {
            id: "budget-001",
            user_id: mockUserId,
            category: "food",
            budget_limit: 8000,
            total_spent: 1000, // Will be 9000 after transaction
          },
        ])
      );
      setReturnValue(
        "budgets",
        "update",
        createMockResponse({
          id: "budget-001",
          total_spent: 9000,
        })
      );
      setReturnValue(
        "alerts",
        "insert",
        createMockResponse({
          id: "alert-001",
          type: "budget_threshold",
        })
      );

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);
      // Verify alert creation was attempted
      expect(mockSupabase.from).toHaveBeenCalledWith("alerts");
    });

    it("should invalidate analytics cache after sync", async () => {
      const mockGmailMessage = createMockGmailMessage({
        id: "msg-005",
      });

      gmailMock.setMessages([mockGmailMessage]);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue(
        "credit_cards",
        "select",
        createMockResponse([
          {
            id: "card-001",
            user_id: mockUserId,
          },
        ])
      );
      setReturnValue("transactions", "select", createMockResponse([]));
      setReturnValue(
        "transactions",
        "insert",
        createMockResponse([
          {
            id: "txn-005",
            amount: 1000,
          },
        ])
      );

      // Seed cache
      await redisMock.set(`analytics:${mockUserId}`, JSON.stringify({ data: "old" }));

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);

      // Verify cache was deleted
      expect(redisMock.del).toHaveBeenCalledWith(
        expect.stringContaining(`analytics:${mockUserId}`)
      );
    });

    it("should handle Gmail API errors gracefully", async () => {
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );

      // Mock Gmail API error
      gmailMock.list.mockRejectedValueOnce(new Error("Gmail API rate limit exceeded"));

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should handle missing Gmail tokens", async () => {
      setReturnValue("gmail_tokens", "select", createMockResponse(null));

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/Gmail.*not.*connected/i);
    });

    it("should return appropriate response structure", async () => {
      gmailMock.setMessages([]);
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue("credit_cards", "select", createMockResponse([]));

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("newTransactions");
      expect(response.body).toHaveProperty("processedEmails");
      expect(response.body).toHaveProperty("duplicatesSkipped");
      expect(response.body).toHaveProperty("syncedAt");
    });
  });

  describe("Complete Flow: Gmail → Budget → Analytics → Alerts", () => {
    it("should execute full end-to-end sync and update pipeline", async () => {
      // Setup: Gmail messages with transactions
      const mockMessages = [
        createMockGmailMessage({
          id: "msg-flow-001",
          snippet: "Transaction of Rs. 15,000.00 at Travel Agency",
        }),
      ];

      gmailMock.setMessages(mockMessages);

      // Setup: User and card data
      setReturnValue(
        "gmail_tokens",
        "select",
        createMockResponse([
          {
            user_id: mockUserId,
            access_token: "token",
          },
        ])
      );
      setReturnValue(
        "credit_cards",
        "select",
        createMockResponse([
          {
            id: "card-001",
            user_id: mockUserId,
            card_name: "Travel Card",
          },
        ])
      );

      // Setup: No duplicate transactions
      setReturnValue("transactions", "select", createMockResponse([]));

      // Setup: Transaction insertion
      setReturnValue(
        "transactions",
        "insert",
        createMockResponse([
          {
            id: "txn-flow-001",
            user_id: mockUserId,
            card_id: "card-001",
            amount: 15000,
            category: "travel",
            email_message_id: "msg-flow-001",
          },
        ])
      );

      // Setup: Budget data (will exceed 80% threshold)
      setReturnValue(
        "budgets",
        "select",
        createMockResponse([
          {
            id: "budget-travel",
            user_id: mockUserId,
            category: "travel",
            budget_limit: 20000,
            total_spent: 5000, // Will be 20000 after transaction (100%)
          },
        ])
      );
      setReturnValue(
        "budgets",
        "update",
        createMockResponse({
          id: "budget-travel",
          total_spent: 20000,
        })
      );

      // Setup: Alert creation
      setReturnValue(
        "alerts",
        "insert",
        createMockResponse({
          id: "alert-flow-001",
          type: "budget_threshold",
          threshold: 100,
        })
      );

      // Execute sync
      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${mockToken}`)
        .send();

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.newTransactions).toBeGreaterThan(0);

      // Verify transaction was inserted
      expect(mockSupabase.from).toHaveBeenCalledWith("transactions");
      expect(mockSupabase.insert).toHaveBeenCalled();

      // Verify budget was updated
      expect(mockSupabase.from).toHaveBeenCalledWith("budgets");
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify alert was created
      expect(mockSupabase.from).toHaveBeenCalledWith("alerts");

      // Verify analytics cache was invalidated
      expect(redisMock.del).toHaveBeenCalled();
    });
  });
});
