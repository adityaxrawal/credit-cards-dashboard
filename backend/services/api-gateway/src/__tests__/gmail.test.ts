import request from "supertest";
import app from "../index";
import jwt from "jsonwebtoken";
import { gmailService } from "../modules/gmail/gmail.service";

jest.mock("../src/modules/gmail/gmail.service");

const generateTestToken = (userId: string = "test-user-123") => {
  return jwt.sign({ userId, email: "test@example.com" }, process.env.JWT_SECRET || "test-secret", {
    expiresIn: "1h",
  });
};

describe("Gmail API", () => {
  let authToken: string;

  beforeAll(() => {
    authToken = generateTestToken();
  });

  describe("POST /api/gmail/authorize", () => {
    it("should return authorization URL", async () => {
      const mockAuthUrl = "https://accounts.google.com/o/oauth2/auth?...";
      (gmailService.getAuthUrl as jest.Mock).mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .post("/api/gmail/authorize")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("url");
      expect(response.body.url).toBe(mockAuthUrl);
    });
  });

  describe("POST /api/gmail/sync", () => {
    it("should return 401 without auth token", async () => {
      await request(app).post("/api/gmail/sync").expect(401);
    });

    it("should sync emails and return summary", async () => {
      const mockSyncResult = {
        processed: 50,
        inserted: 35,
        skipped: 10,
        errors: 5,
      };

      (gmailService.syncUserInbox as jest.Mock).mockResolvedValue(mockSyncResult);

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("processed");
      expect(response.body).toHaveProperty("inserted");
      expect(response.body).toHaveProperty("skipped");
      expect(response.body).toHaveProperty("errors");
    });

    it("should handle sync errors gracefully", async () => {
      (gmailService.syncUserInbox as jest.Mock).mockRejectedValue(
        new Error("Gmail API quota exceeded")
      );

      const response = await request(app)
        .post("/api/gmail/sync")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message");
    });
  });

  describe("GET /api/gmail/status", () => {
    it("should return Gmail connection status", async () => {
      const mockStatus = {
        connected: true,
        historyId: "12345",
        lastSync: "2024-11-01T12:00:00Z",
      };

      (gmailService.getStatus as jest.Mock).mockResolvedValue(mockStatus);

      const response = await request(app)
        .get("/api/gmail/status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("status");
      expect(response.body.status).toHaveProperty("connected");
    });
  });

  describe("POST /api/gmail/revoke", () => {
    it("should revoke Gmail access", async () => {
      (gmailService.revoke as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/gmail/revoke")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(gmailService.revoke).toHaveBeenCalledWith("test-user-123");
    });

    it("should handle revoke errors", async () => {
      (gmailService.revoke as jest.Mock).mockRejectedValue(new Error("Failed to revoke access"));

      const response = await request(app)
        .post("/api/gmail/revoke")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
    });
  });
});
