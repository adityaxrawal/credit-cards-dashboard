/**
 * Validation Middleware
 * Wraps Zod schemas for Express route validation
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidateOptions {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

/**
 * Validate request against Zod schemas
 * Usage: validate({ body: CreateTransactionSchema })
 */
export const validate = (schemas: ValidateOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query) as typeof req.query;
            }
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message,
                        })),
                    },
                });
            }
            next(error);
        }
    };
};

/**
 * Validate single schema against body (convenience wrapper)
 */
export const validateBody = (schema: ZodSchema) => validate({ body: schema });

/**
 * Validate single schema against query (convenience wrapper)
 */
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });

/**
 * Validate single schema against params (convenience wrapper)
 */
export const validateParams = (schema: ZodSchema) => validate({ params: schema });
