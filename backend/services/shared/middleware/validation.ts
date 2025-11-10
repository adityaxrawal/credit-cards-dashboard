import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../errors/AppError";

/**
 * Validation middleware factory
 * Validates request body, params, or query against a Zod schema
 */

export interface ValidationOptions {
  /**
   * Where to validate: body, params, or query
   */
  source?: "body" | "params" | "query";

  /**
   * Whether to strip unknown keys
   */
  stripUnknown?: boolean;

  /**
   * Custom error message
   */
  errorMessage?: string;
}

/**
 * Validate request body against a Zod schema
 */
export function validateRequest(schema: ZodSchema, options: ValidationOptions = {}) {
  const { source = "body", errorMessage } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];

      // Parse and validate
      const validated = schema.parse(dataToValidate);

      // Replace with validated data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        next(
          AppError.validation(errorMessage || "Request validation failed", { validationErrors })
        );
      } else {
        next(AppError.internal("Validation error", { error }));
      }
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: ZodSchema, errorMessage?: string) {
  return validateRequest(schema, { source: "body", errorMessage });
}

/**
 * Validate request params
 */
export function validateParams(schema: ZodSchema, errorMessage?: string) {
  return validateRequest(schema, { source: "params", errorMessage });
}

/**
 * Validate request query
 */
export function validateQuery(schema: ZodSchema, errorMessage?: string) {
  return validateRequest(schema, { source: "query", errorMessage });
}

/**
 * Validate multiple sources at once
 */
export function validateMultiple(config: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (config.body) {
        req.body = config.body.parse(req.body);
      }

      if (config.params) {
        req.params = config.params.parse(req.params);
      }

      if (config.query) {
        req.query = config.query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        next(
          AppError.validation("Request validation failed", {
            validationErrors,
          })
        );
      } else {
        next(AppError.internal("Validation error", { error }));
      }
    }
  };
}
