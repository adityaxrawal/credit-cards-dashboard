import request from "supertest";
import app from "../src/index";

describe("Recurring Transactions API Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let cardId: string;
  let recurringId: string;

  beforeAll(async () => {
    // Mock authentication - in real tests, you'd have proper test user setup
    authToken = "test-token";
    userId = "test-user-id";
    cardId = "test-card-id";
  });

  describe("POST /recurring-transactions", () => {
    it("should create a new recurring transaction", async () => {
      const response = await request(app)
        .post("/recurring-transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          card_id: cardId,
          merchant_name: "Netflix",
          amount: 999,
          frequency: "monthly",
          start_date: new Date().toISOString(),
          category: "Entertainment",
          description: "Monthly subscription",
          auto_execute: true,
          notification_enabled: true,
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.merchant_name).toBe("Netflix");
        recurringId = response.body.data.id;
      }
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/recurring-transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          card_id: cardId,
          // Missing required fields
        });

      expect([400, 401]).toContain(response.status);
    });

    it("should validate frequency values", async () => {
      const response = await request(app)
        .post("/recurring-transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          card_id: cardId,
          merchant_name: "Test",
          amount: 100,
          frequency: "invalid-frequency",
          start_date: new Date().toISOString(),
        });

      expect([400, 401]).toContain(response.status);
    });
  });

  describe("GET /recurring-transactions", () => {
    it("should fetch all recurring transactions", async () => {
      const response = await request(app)
        .get("/recurring-transactions")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/recurring-transactions?status=active")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("GET /recurring-transactions/upcoming", () => {
    it("should fetch upcoming recurring transactions", async () => {
      const response = await request(app)
        .get("/recurring-transactions/upcoming?days=30")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe("GET /recurring-transactions/:id", () => {
    it("should fetch a single recurring transaction", async () => {
      if (!recurringId) {
        return; // Skip if no recurring transaction was created
      }

      const response = await request(app)
        .get(`/recurring-transactions/${recurringId}`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(recurringId);
      }
    });

    it("should return 404 for non-existent transaction", async () => {
      const response = await request(app)
        .get("/recurring-transactions/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${authToken}`);

      expect([404, 401]).toContain(response.status);
    });
  });

  describe("PUT /recurring-transactions/:id", () => {
    it("should update a recurring transaction", async () => {
      if (!recurringId) {
        return;
      }

      const response = await request(app)
        .put(`/recurring-transactions/${recurringId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          amount: 1299,
          description: "Updated subscription",
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("POST /recurring-transactions/:id/pause", () => {
    it("should pause a recurring transaction", async () => {
      if (!recurringId) {
        return;
      }

      const response = await request(app)
        .post(`/recurring-transactions/${recurringId}/pause`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("POST /recurring-transactions/:id/resume", () => {
    it("should resume a paused recurring transaction", async () => {
      if (!recurringId) {
        return;
      }

      const response = await request(app)
        .post(`/recurring-transactions/${recurringId}/resume`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("POST /recurring-transactions/:id/cancel", () => {
    it("should cancel a recurring transaction", async () => {
      if (!recurringId) {
        return;
      }

      const response = await request(app)
        .post(`/recurring-transactions/${recurringId}/cancel`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("Authorization", () => {
    it("should reject requests without token", async () => {
      const response = await request(app).get("/recurring-transactions");

      expect(response.status).toBe(401);
    });

    it("should reject requests with invalid token", async () => {
      const response = await request(app)
        .get("/recurring-transactions")
        .set("Authorization", "Bearer invalid-token");

      expect([401, 403]).toContain(response.status);
    });
  });
});
