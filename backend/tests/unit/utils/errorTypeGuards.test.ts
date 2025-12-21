import { isPostgresError, isUniqueViolationError, isConnectionError } from '../../../utils/errorTypeGuards';

describe('Error Type Guards', () => {
    describe('isPostgresError', () => {
        test('should return true for Postgres errors', () => {
            const pgError = new Error('Database error');
            (pgError as any).code = '23505';

            expect(isPostgresError(pgError)).toBe(true);
        });

        test('should return false for standard errors', () => {
            const standardError = new Error('Regular error');

            expect(isPostgresError(standardError)).toBe(false);
        });

        test('should return false for non-Error objects', () => {
            expect(isPostgresError('string error')).toBe(false);
            expect(isPostgresError(null)).toBe(false);
            expect(isPostgresError(undefined)).toBe(false);
        });
    });

    describe('isUniqueViolationError', () => {
        test('should return true for unique constraint violations', () => {
            const error = new Error('duplicate key violation');
            (error as any).code = '23505';

            expect(isUniqueViolationError(error)).toBe(true);
        });

        test('should return false for other Postgres errors', () => {
            const error = new Error('foreign key violation');
            (error as any).code = '23503';

            expect(isUniqueViolationError(error)).toBe(false);
        });
    });

    describe('isConnectionError', () => {
        test('should return true for connection termination errors', () => {
            const error1 = new Error('connection terminated');
            (error1 as any).code = '57P01';

            const error2 = new Error('crash shutdown');
            (error2 as any).code = '57P02';

            const error3 = new Error('cannot connect now');
            (error3 as any).code = '57P03';

            expect(isConnectionError(error1)).toBe(true);
            expect(isConnectionError(error2)).toBe(true);
            expect(isConnectionError(error3)).toBe(true);
        });

        test('should return false for non-connection errors', () => {
            const error = new Error('regular error');
            (error as any).code = '23505';

            expect(isConnectionError(error)).toBe(false);
        });
    });
});
