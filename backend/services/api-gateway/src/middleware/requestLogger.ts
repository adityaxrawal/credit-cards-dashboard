import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Log request
  logger.info(`[${req.method}] ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Log response on finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      `[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`,
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      }
    );
  });

  next();
};
