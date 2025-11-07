import request from "supertest";
import app from "../index";

describe("Health Check API", () => {
  describe("GET /api/monitoring/health", () => {
    it("should return 200 and health status", async () => {
      const response = await request(app)
        .get("/api/monitoring/health")
        .expect("Content-Type", /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).toContain(response.body.status);
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("services");
    });

    it("should include service health details", async () => {
      const response = await request(app).get("/api/monitoring/health").expect(200);

      expect(response.body.services).toHaveProperty("database");
      expect(response.body.services).toHaveProperty("redis");
    });
  });

  describe("GET /api/monitoring/liveness", () => {
    it("should return 200 for liveness probe", async () => {
      const response = await request(app).get("/api/monitoring/liveness").expect(200);

      expect(response.body).toEqual({ alive: true });
    });
  });

  describe("GET /api/monitoring/readiness", () => {
    it("should return readiness status", async () => {
      const response = await request(app).get("/api/monitoring/readiness");

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty("ready");
    });
  });

  describe("Deprecated /health endpoint", () => {
    it("should redirect to /api/monitoring/health", async () => {
      const response = await request(app).get("/health").expect(301);

      expect(response.headers.location).toBe("/api/monitoring/health");
    });
  });
});
