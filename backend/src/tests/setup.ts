// Jest test setup file
// This file runs before each test file

import { jest } from '@jest/globals';

// Mock the database pool
jest.mock('../lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn(),
}));

// Mock logger to avoid console spam in tests
jest.mock('../utils/infrastructure/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// Increase timeout for slow operations
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason: Error) => {
    console.error('Unhandled Rejection in test:', reason);
});
