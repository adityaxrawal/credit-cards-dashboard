import { ErrorRecoveryManager } from '../src/services/error-recovery/ErrorRecoveryManager';
import pool from '../src/lib/db';

// Mock dependencies
jest.mock('../src/lib/db', () => ({
    query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn()
}));

describe('ErrorRecoveryManager', () => {
    const mockContext = {
        userId: 'user-1',
        emailId: 'email-1',
        currentStage: 'TEST',
        retryCount: 0
    };

    beforeEach(() => {
        (pool.query as jest.Mock).mockClear();
    });

    // Note: logError is private, so we test it via handleProcessingError
    // We mock pool.query to fail, and check if handleProcessingError propagates the error

    it('should propagate error when logging fails', async () => {
        // Mock DB failure for the INSERT call
        (pool.query as jest.Mock).mockRejectedValue(new Error('DB Connection Failed'));

        // Expect handleProcessingError to fail because logError re-throws
        await expect(
            ErrorRecoveryManager.handleProcessingError(new Error('Original Error'), mockContext)
        ).rejects.toThrow('Failed to log pipeline error: DB Connection Failed');
    });

    it('should succeed when logging succeeds', async () => {
        // Mock DB success
        (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

        await expect(
            ErrorRecoveryManager.handleProcessingError(new Error('Original Error'), mockContext)
        ).resolves.toBeDefined();
    });
});
