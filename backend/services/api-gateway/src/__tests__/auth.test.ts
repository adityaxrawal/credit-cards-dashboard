import request from "supertest";
import app from "../index";
import { authService } from "../modules/auth/auth.service";

jest.mock("../src/modules/auth/auth.service");

describe("Auth API", () => {
  describe("POST /api/auth/google", () => {
    it("should return 400 if code is missing", async () => {
      const response = await request(app).post("/api/auth/google").send({}).expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.message).toContain("code");
    });

    it("should return tokens on successful OAuth", async () => {
      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };

      (authService.googleOAuth as jest.Mock).mockResolvedValue(mockTokens);

      const response = await request(app)
        .post("/api/auth/google")
        .send({ code: "valid-auth-code" })
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body).toHaveProperty("user");
    });

    it("should return 401 on OAuth failure", async () => {
      (authService.googleOAuth as jest.Mock).mockRejectedValue(
        new Error("Invalid authorization code")
      );

      const response = await request(app)
        .post("/api/auth/google")
        .send({ code: "invalid-code" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should return 400 if refreshToken is missing", async () => {
      const response = await request(app).post("/api/auth/refresh").send({}).expect(400);

      expect(response.body.message).toContain("refresh token");
    });

    it("should return new tokens on successful refresh", async () => {
      const mockTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      (authService.refreshAccessToken as jest.Mock).mockResolvedValue(mockTokens);

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "valid-refresh-token" })
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("should return 401 on expired refresh token", async () => {
      (authService.refreshAccessToken as jest.Mock).mockRejectedValue(
        new Error("Refresh token expired")
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "expired-token" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });
});
