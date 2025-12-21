import { CircuitBreaker } from '../src/utils/circuitBreaker';
import logger from '../src/utils/logger';

// Mock logger to suppress output during testing
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('CircuitBreaker Integration', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker('TestBreaker', {
            failureThreshold: 3,
            resetTimeout: 100
        });
        jest.clearAllMocks();
    });

    it('should pass through successful calls', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const result = await breaker.execute(fn);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after threshold failures', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('failure'));

        // Fail 3 times (threshold)
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(fn)).rejects.toThrow('failure');
        }

        // 4th time should fail fast with Circuit Open
        await expect(breaker.execute(fn)).rejects.toThrow(/is OPEN/);

        // Function should not be called again
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should move to half-open after timeout', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('failure'));

        // Trip the breaker
        for (let i = 0; i < 3; i++) {
            try { await breaker.execute(fn); } catch (e) { }
        }

        // Verify open
        await expect(breaker.execute(fn)).rejects.toThrow(/is OPEN/);

        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 150));

        // Next call should go through (Half-Open)
        // We mock success this time
        fn.mockResolvedValueOnce('success');
        const result = await breaker.execute(fn);
        expect(result).toBe('success');

        // Circuit should be closed now
        expect(breaker.getState()).toBe('CLOSED');
    });
});
