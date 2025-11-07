import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

export const requestId = (req: Request, _res: Response, next: NextFunction) => {
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  next();
};
