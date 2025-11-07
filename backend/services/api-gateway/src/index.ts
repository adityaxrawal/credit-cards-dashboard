// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

// Register path aliases for runtime resolution
import "tsconfig-paths/register";

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { logger } from "shared/monitoring/logger";
import { initializeErrorTracking, Sentry } from "shared/monitoring/sentry-config";
import rateLimit from "express-rate-limit";
import { requestId } from "./common/middleware/requestId";
import { validateEnv } from "./config/env";
import { errorHandler } from "./common/middleware/errorHandler";
import { requestLogger } from "./common/middleware/requestLogger";

// Import modular routes
import { authRoutes } from "@modules/auth";
import { cardsRoutes } from "@modules/cards";
import { transactionsRoutes } from "@modules/transactions";
import { budgetsRoutes } from "@modules/budgets";
import { alertsRoutes } from "@modules/alerts";
import { analyticsRoutes } from "@modules/analytics";
import gmailRoutes from "./modules/gmail/gmail.routes"; // Complex legacy routes
import { gmailLimiter, authLimiter } from "./config/rate-limit";
import { billsRoutes } from "@modules/bills";
import { aiInsightsRoutes } from "@modules/ai-insights";
import { subscriptionsRoutes } from "@modules/subscriptions";
import { reportsRoutes } from "@modules/reports";
import { rewardsRoutes } from "@modules/rewards";
import servicesRoutes from "./routes/services.routes"; // Health check routes

// Validate environment early
const env = validateEnv();
initializeErrorTracking("api-gateway");

const app: Application = express();
const PORT = env.PORT || 3001;

// Middleware
// Attach Sentry request/trace handlers early
if (process.env.SENTRY_ENABLED === "true" || process.env.GLITCHTIP_ENABLED === "true") {
  // New SDK provides request/metrics auto instrumentation via integrations, but include request handler for extra context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).use(
    (Sentry as any).setupRequestHandler?.() ||
      ((_req: Request, _res: Response, next: Function) => next())
  );
}
app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Deprecated legacy health path (redirect)
app.get("/health", (_req: Request, res: Response) => {
  res.redirect(301, "/api/monitoring/health");
});

// API Routes - Modular Architecture
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/budget", budgetsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gmail", gmailLimiter, gmailRoutes);
app.use("/api/bills", billsRoutes);
app.use("/api/ai-insights", aiInsightsRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/services", servicesRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use(errorHandler);
// Attach Sentry error handler last (after our errorHandler) so unhandled errors are captured too
if (process.env.SENTRY_ENABLED === "true" || process.env.GLITCHTIP_ENABLED === "true") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).use(
    (Sentry as any).setupExpressErrorHandler?.() ||
      ((_err: any, _req: Request, _res: Response, next: Function) => next())
  );
}

// Start server
import { Server } from "http";

let server: Server | undefined;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info("Zero-cost architecture: Services triggered from frontend");
  });

  // Graceful shutdown handler to prevent memory leaks
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    if (server) {
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    }

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export default app;
