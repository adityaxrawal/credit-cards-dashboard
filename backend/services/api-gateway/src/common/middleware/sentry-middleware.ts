/**
 * Sentry Middleware for Express Routes
 *
 * Automatically captures errors and creates transactions for API requests
 */

import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { startSpan, captureException, setUser } from "shared/monitoring/sentry";
import { AuthRequest } from "./auth";

/**
 * Request handler middleware (must be first)
 * Captures request data and starts transaction
 * Note: In Sentry v8, use setupExpressErrorHandler() instead
 */
export function sentryRequestHandler() {
  // This is a no-op placeholder - actual Sentry setup happens in app initialization
  // with Sentry.setupExpressErrorHandler(app)
  return (req: Request, _res: Response, next: NextFunction) => {
    // Set transaction name for critical routes
    const criticalRoutes = ["/api/gmail/sync", "/api/reports", "/api/transactions"];
    if (criticalRoutes.some((route) => req.path.startsWith(route))) {
      Sentry.getCurrentScope().setTransactionName(`${req.method} ${req.path}`);
    }
    next();
  };
}

/**
 * Tracing middleware for API routes
 * Creates spans for critical endpoints
 */
export function sentryTracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Set user context if authenticated
  if ("userId" in req && (req as AuthRequest).userId) {
    const authReq = req as AuthRequest;
    setUser({
      id: authReq.userId!,
      email: authReq.email,
    });
  }

  // Add custom span for critical routes
  const criticalRoutes = ["/api/gmail/sync", "/api/reports", "/api/transactions"];

  if (criticalRoutes.some((route) => req.path.startsWith(route))) {
    // Span will be created automatically by Sentry's request handler
    Sentry.getCurrentScope().setTransactionName(`${req.method} ${req.path}`);
  }

  next();
}

/**
 * Error handler middleware (must be last)
 * Captures exceptions and sends to Sentry
 */
export function sentryErrorHandler() {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    captureException(error, {
      route: req.path,
      method: req.method,
      userId: "userId" in req ? (req as AuthRequest).userId : undefined,
    });
    next(error);
  };
}

/**
 * Custom error handler that works with our AppError system
 */
export function customSentryErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Capture to Sentry
  captureException(error, {
    route: req.path,
    method: req.method,
    userId: "userId" in req ? (req as AuthRequest).userId : undefined,
  });

  // Pass to next error handler
  next(error);
}

/**
 * Performance monitoring for database queries
 */
export function wrapDatabaseQuery<T>(
  queryName: string,
  callback: () => Promise<T>
): T | Promise<T> {
  return startSpan(`db.query.${queryName}`, "db", callback);
}

/**
 * Performance monitoring for external API calls
 */
export function wrapExternalCall<T>(
  serviceName: string,
  callback: () => Promise<T>
): T | Promise<T> {
  return startSpan(`http.${serviceName}`, "http.client", callback);
}

export { startSpan };
