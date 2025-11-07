import request from "supertest";
import app from "../index";
import jwt from "jsonwebtoken";

const generateTestToken = (userId: string = "test-user-123") => {
  return jwt.sign({ userId, email: "test@example.com" }, process.env.JWT_SECRET || "test-secret", {
    expiresIn: "1h",
  });
};

describe("Transactions API", () => {
  let authToken: string;

  beforeAll(() => {
    authToken = generateTestToken();
  });

  describe("GET /api/transactions", () => {
    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/api/transactions").expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("should return transactions list with auth", async () => {
      const response = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/transactions?page=1&limit=10")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("pagination");
    });

    it("should support filtering by date range", async () => {
      const startDate = "2024-01-01T00:00:00Z";
      const endDate = "2024-12-31T23:59:59Z";

      const response = await request(app)
        .get(`/api/transactions?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });

    it("should filter by transaction type", async () => {
      const response = await request(app)
        .get("/api/transactions?transaction_type=debit")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });
  });

  describe("POST /api/transactions", () => {
    it("should return 401 without auth token", async () => {
      await request(app)
        .post("/api/transactions")
        .send({
          merchant_name: "Test Merchant",
          amount: 100,
          transaction_date: new Date().toISOString(),
        })
        .expect(401);
    });

    it("should create transaction with valid data", async () => {
      const newTransaction = {
        merchant_name: "Test Merchant",
        amount: 150.5,
        transaction_date: new Date().toISOString(),
        transaction_type: "debit",
        merchant_category: "Shopping",
      };

      const response = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(newTransaction)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.merchant_name).toBe(newTransaction.merchant_name);
    });

    it("should return 400 with invalid data", async () => {
      const invalidTransaction = {
        merchant_name: "", // Invalid: empty string
        amount: -10, // Invalid: negative amount
      };

      const response = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidTransaction)
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });
  });

  describe("GET /api/transactions/:id", () => {
    it("should return 404 for non-existent transaction", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app)
        .get(`/api/transactions/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("DELETE /api/transactions/:id", () => {
    it("should return 401 without auth token", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app).delete(`/api/transactions/${fakeId}`).expect(401);
    });
  });
});
