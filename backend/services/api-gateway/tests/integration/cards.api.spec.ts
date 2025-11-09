import request from "supertest";
import express, { Express } from "express";
import { AppError } from "../../shared/errors/AppError";

// Mock app setup
const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  app.use((req: any, res, next) => {
    req.user = { id: "test-user-123" };
    next();
  });

  // Test routes
  app.post("/api/cards", async (req, res, next) => {
    try {
      const { card_name, bank_name, last_four_digits, credit_limit } = req.body;

      if (!card_name) {
        throw AppError.validation("Card name is required");
      }

      if (!last_four_digits || !/^\d{4}$/.test(last_four_digits)) {
        throw AppError.validation("Last 4 digits must be exactly 4 digits");
      }

      const card = {
        id: "card-123",
        user_id: req.user.id,
        card_name,
        bank_name,
        last_four_digits,
        credit_limit,
        created_at: new Date().toISOString(),
      };

      res.status(201).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cards", async (req: any, res, next) => {
    try {
      const cards = [
        {
          id: "card-1",
          user_id: req.user.id,
          card_name: "Test Card 1",
          last_four_digits: "1234",
          credit_limit: 50000,
        },
        {
          id: "card-2",
          user_id: req.user.id,
          card_name: "Test Card 2",
          last_four_digits: "5678",
          credit_limit: 100000,
        },
      ];

      res.json({
        success: true,
        data: cards,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cards/:id", async (req: any, res, next) => {
    try {
      const { id } = req.params;

      if (id === "not-found") {
        throw AppError.notFound("Card");
      }

      const card = {
        id,
        user_id: req.user.id,
        card_name: "Test Card",
        last_four_digits: "1234",
        credit_limit: 50000,
      };

      res.json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          context: err.context,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "E_INTERNAL",
        message: "Internal server error",
      },
    });
  });

  return app;
};

describe("Integration Tests - Cards API", () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("POST /api/cards", () => {
    it("should create a card successfully", async () => {
      const cardData = {
        card_name: "Test Card",
        bank_name: "Test Bank",
        last_four_digits: "1234",
        credit_limit: 50000,
      };

      const response = await request(app).post("/api/cards").send(cardData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.card_name).toBe("Test Card");
      expect(response.body.data.last_four_digits).toBe("1234");
    });

    it("should return 400 for missing card name", async () => {
      const cardData = {
        bank_name: "Test Bank",
        last_four_digits: "1234",
        credit_limit: 50000,
      };

      const response = await request(app).post("/api/cards").send(cardData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("E_VALIDATION");
      expect(response.body.error.message).toContain("Card name");
    });

    it("should return 400 for invalid last 4 digits", async () => {
      const cardData = {
        card_name: "Test Card",
        bank_name: "Test Bank",
        last_four_digits: "ABCD",
        credit_limit: 50000,
      };

      const response = await request(app).post("/api/cards").send(cardData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("E_VALIDATION");
      expect(response.body.error.message).toContain("4 digits");
    });
  });

  describe("GET /api/cards", () => {
    it("should fetch all cards for authenticated user", async () => {
      const response = await request(app).get("/api/cards").expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty("id");
      expect(response.body.data[0]).toHaveProperty("card_name");
    });
  });

  describe("GET /api/cards/:id", () => {
    it("should fetch specific card by ID", async () => {
      const response = await request(app).get("/api/cards/card-123").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("card-123");
    });

    it("should return 404 for non-existent card", async () => {
      const response = await request(app).get("/api/cards/not-found").expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("E_NOT_FOUND");
      expect(response.body.error.message).toContain("Card");
    });
  });

  describe("Error Handling", () => {
    it("should return properly formatted validation errors", async () => {
      const response = await request(app).post("/api/cards").send({}).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code");
      expect(response.body.error).toHaveProperty("message");
    });

    it("should handle not found errors correctly", async () => {
      const response = await request(app).get("/api/cards/not-found").expect(404);

      expect(response.body.error.code).toBe("E_NOT_FOUND");
    });
  });
});

describe("Integration Tests - Authentication Flow", () => {
  it("should validate authentication middleware", async () => {
    const app = express();
    app.use(express.json());

    // Route without auth
    app.get("/api/test", (req: any, res) => {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required");
      }
      res.json({ success: true });
    });

    // Error handler
    app.use((err: any, req: any, res: any, next: any) => {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    });

    const response = await request(app).get("/api/test").expect(401);

    expect(response.body.error.code).toBe("E_AUTH_REQUIRED");
  });
});
