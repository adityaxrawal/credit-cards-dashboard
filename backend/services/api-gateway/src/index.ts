// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

// Register path aliases for runtime resolution
import "tsconfig-paths/register";

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { logger } from "./utils/logger";
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
import { billsRoutes } from "@modules/bills";
import { aiInsightsRoutes } from "@modules/ai-insights";
import { subscriptionsRoutes } from "@modules/subscriptions";
import { reportsRoutes } from "@modules/reports";
import { rewardsRoutes } from "@modules/rewards";
import servicesRoutes from "./routes/services.routes"; // Health check routes

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
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

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes - Modular Architecture
app.use("/auth", authRoutes);
app.use("/cards", cardsRoutes);
app.use("/transactions", transactionsRoutes);
app.use("/budget", budgetsRoutes);
app.use("/alerts", alertsRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/gmail", gmailRoutes); // TODO: Migrate gmail service to module
app.use("/bills", billsRoutes);
app.use("/ai-insights", aiInsightsRoutes);
app.use("/subscriptions", subscriptionsRoutes);
app.use("/reports", reportsRoutes);
app.use("/rewards", rewardsRoutes);
app.use("/services", servicesRoutes); // Health check and status routes

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use(errorHandler);

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
