import { Request, Response, NextFunction } from "express";
import { logger } from "shared/monitoring/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.debug(`[REQ] ${req.method} ${req.path}`);

  // Log response on finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const msg = `[RES] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
    if (duration > 1000) {
      logger.warn(msg);
    } else if (res.statusCode >= 500) {
      logger.error(msg);
    } else if (res.statusCode >= 400) {
      logger.warn(msg);
    } else {
      logger.debug(msg);
    }
  });

  next();
};
