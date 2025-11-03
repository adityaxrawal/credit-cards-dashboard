/**
 * Monitoring Middleware for Express
 * Phase 6: Post-Launch & Optimization
 */

import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { metricsCollector } from "../../../../shared/monitoring/metrics-collector";
import { logger } from "../../../../shared/monitoring/logger";

/**
 * Request tracking middleware
 */
export function requestTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId =
    (req.headers["x-request-id"] as string) ||
    `req-${Date.now()}-${Math.random()}`;

  // Add request ID to response headers
  res.setHeader("X-Request-Id", requestId);

  // Create request logger
  const requestLogger = logger.child({ requestId });

  // Log request start
  requestLogger.info(`Incoming request`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to capture metrics
  res.end = function (this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Record metrics
    metricsCollector.recordUsage({
      userId: (req as any).user?.userId,
      endpoint: req.path,
      method: req.method,
      statusCode,
      responseTime: duration,
      timestamp: Date.now(),
    });

    // Log request completion
    requestLogger.logRequest(req.method, req.path, statusCode, duration, {
      userId: (req as any).user?.userId,
    });

    // Call original end
    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Error tracking middleware
 */
export function errorTrackingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = res.getHeader("X-Request-Id") as string;

  // Log error
  logger.error("Request error", err, {
    requestId,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.userId,
  });

  // Send to Sentry with request context
  Sentry.withScope((scope: any) => {
    scope.setTag("request_id", requestId);
    scope.setContext("request", {
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query,
      body: req.body,
    });

    if ((req as any).user) {
      scope.setUser({
        id: (req as any).user.userId,
        email: (req as any).user.email,
      });
    }

    Sentry.captureException(err);
  });

  // Send error response
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const transaction = Sentry.startTransaction({
    op: "http.server",
    name: `${req.method} ${req.path}`,
  });

  // Add transaction to request
  (req as any).sentryTransaction = transaction;

  // Capture original end
  const originalEnd = res.end;

  res.end = function (this: Response, ...args: any[]): Response {
    transaction.setHttpStatus(res.statusCode);
    transaction.finish();
    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Rate limiting metrics middleware
 */
export async function rateLimitMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.userId;
  const endpoint = req.path;

  if (userId) {
    await metricsCollector.incrementCounter("rate_limit_check", {
      userId,
      endpoint,
    });
  }

  next();
}
