/**
 * Type guards for common error types to avoid unsafe 'any' casts
 */

/**
 * PostgreSQL error with code property
 */
export interface PostgresError extends Error {
    code: string;
    detail?: string;
    table?: string;
    constraint?: string;
}

/**
 * Type guard to check if error is a PostgreSQL error with code
 */
export function isPostgresError(error: unknown): error is PostgresError {
    return (
        error instanceof Error &&
        typeof (error as any).code === 'string'
    );
}

/**
 * Check if error is a unique constraint violation (23505)
 */
export function isUniqueViolationError(error: unknown): error is PostgresError {
    return isPostgresError(error) && error.code === '23505';
}

/**
 * Check if error is a connection termination error
 */
export function isConnectionError(error: unknown): error is PostgresError {
    return isPostgresError(error) &&
        (error.code === '57P01' || error.code === '57P02' || error.code === '57P03');
}
