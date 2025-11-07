import { Request, Response, NextFunction } from "express";
import { logger } from "shared/monitoring/logger";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = (req as any).requestId;

  if (err instanceof AppError) {
    logger.error(`Request error: ${err.message}`, new Error(err.message));
    return res.status(err.statusCode).json({
      status: "error",
      code: err.statusCode >= 500 ? "SERVER_ERROR" : "APP_ERROR",
      message: err.message,
      requestId,
      path: req.path,
    });
  }

  logger.error(`Unhandled error: ${err.message}`, err as Error);
  return res.status(500).json({
    status: "error",
    code: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    requestId,
    path: req.path,
  });
};
