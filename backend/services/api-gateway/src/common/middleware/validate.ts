import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { logger } from "shared/monitoring/logger";

/**
 * Validation middleware factory
 * Creates middleware to validate request body, query, or params using Zod schemas
 */

export type ValidationSource = "body" | "query" | "params";

export function validate(schema: z.ZodSchema, source: ValidationSource = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[source];
      const validated = schema.parse(dataToValidate);

      // Replace request data with validated (and potentially transformed) data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("Validation error", {
          source,
          errors: error.errors,
          path: req.path,
        });

        res.status(400).json({
          status: "error",
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
        return;
      }

      next(error);
    }
  };
}

/**
 * Helper to create optional pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Helper to create optional date range schema
 */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: "startDate must be before or equal to endDate",
    }
  );
