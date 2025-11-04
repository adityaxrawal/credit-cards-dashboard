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

  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function (
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Record metrics
    metricsCollector.recordUsage({
      endpoint: req.path,
      method: req.method,
      statusCode,
      responseTime: duration,
      timestamp: Date.now(),
      userId: (req as any).user?.userId,
    });

    // Log request completion
    requestLogger.logRequest(req.method, req.path, statusCode, duration, {
      userId: (req as any).user?.userId,
    });

    // Call original end with proper typing
    if (typeof encoding === "function") {
      return originalEnd(chunk, encoding);
    }
    if (encoding !== undefined) {
      return originalEnd(chunk, encoding, cb);
    }
    return originalEnd(chunk);
  } as typeof res.end;

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
  const startTime = Date.now();

  // Capture original end
  const originalEnd2 = res.end.bind(res);

  res.end = function (
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    const duration = Date.now() - startTime;

    // Log performance
    logger.info(`Request completed: ${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration,
    });

    // Call original end with proper typing
    if (typeof encoding === "function") {
      return originalEnd2(chunk, encoding);
    }
    if (encoding !== undefined) {
      return originalEnd2(chunk, encoding, cb);
    }
    return originalEnd2(chunk);
  } as typeof res.end;

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
