import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        errors: result.error.errors.map((e) => ({ path: e.path, message: e.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
