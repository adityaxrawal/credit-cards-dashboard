import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

// Import routes
import authRoutes from "./routes/auth.routes";
import cardRoutes from "./routes/card.routes";
import transactionRoutes from "./routes/transaction.routes";
import budgetRoutes from "./routes/budget.routes";
import alertRoutes from "./routes/alert.routes";
import analyticsRoutes from "./routes/analytics-enhanced.routes";
import gmailRoutes from "./routes/gmail.routes";
// jobsRoutes removed - zero-cost architecture has no background jobs
import billReminderRoutes from "./routes/bill-reminder.routes";
import aiInsightsRoutes from "./routes/ai-insights.routes";
import subscriptionRoutes from "./routes/subscriptions.routes";
import reportsRoutes from "./routes/reports.routes";
import rewardsRoutes from "./routes/rewards.routes";
import recurringTransactionsRoutes from "./routes/recurring-transactions.routes";
import servicesRoutes from "./routes/services.routes";
// BackgroundJobService removed - zero-cost architecture uses frontend-triggered services

dotenv.config();

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

// API Routes
app.use("/auth", authRoutes);
app.use("/cards", cardRoutes);
app.use("/transactions", transactionRoutes);
app.use("/budget", budgetRoutes);
app.use("/alerts", alertRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/gmail", gmailRoutes);
// app.use("/jobs", jobsRoutes); // Removed - no background jobs in zero-cost architecture
app.use("/bills", billReminderRoutes);
app.use("/ai-insights", aiInsightsRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/reports", reportsRoutes);
app.use("/rewards", rewardsRoutes);
app.use("/recurring-transactions", recurringTransactionsRoutes);
app.use("/services", servicesRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use(errorHandler);

// Start server
let server: any;
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
