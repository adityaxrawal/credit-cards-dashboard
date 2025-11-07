import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errorHandler";
import redis from "shared/cache/redis";

/**
 * Extended Express Request with authentication context
 * Explicitly extends Request to ensure all Express properties are available
 */
export interface AuthRequest extends Request {
  userId?: string;
  email?: string;
}

/**
 * Middleware to verify JWT token and attach user info to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new AppError("No authentication token provided", 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };

    // Check if session exists in Redis
    const session = await redis.get(`session:${decoded.userId}`);
    if (!session) {
      throw new AppError("Session expired. Please login again", 401);
    }

    // Attach user info to request
    req.userId = decoded.userId;
    req.email = decoded.email;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError("Invalid authentication token", 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError("Authentication token expired", 401));
    }
    next(error);
  }
};
