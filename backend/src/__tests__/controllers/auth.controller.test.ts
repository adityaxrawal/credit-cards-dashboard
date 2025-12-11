/**
 * Auth Controller Unit Tests
 * Tests Google OAuth login, token refresh, and logout
 */

import { Request, Response } from 'express';
import * as authController from '../../controllers/auth.controller';

// Mock dependencies
jest.mock('google-auth-library');
jest.mock('jsonwebtoken');
jest.mock('../../repositories/user.repository');
jest.mock('../../config/env', () => ({
    env: {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3000/login',
        JWT_SECRET: 'test-jwt-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        NODE_ENV: 'test',
    },
}));

describe('Auth Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockReq = {
            body: {},
            cookies: {},
            headers: {},
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('googleLogin', () => {
        it('should return 400 if authorization code is missing', async () => {
            mockReq.body = {};

            await authController.googleLogin(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Missing authorization code',
            });
        });
    });

    describe('getMe', () => {
        it('should return user from request', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            (mockReq as any).user = mockUser;

            await authController.getMe(
                mockReq as any,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith(mockUser);
        });
    });

    describe('refresh', () => {
        it('should return 400 if refresh token is missing', async () => {
            mockReq.body = {};
            mockReq.cookies = {};

            await authController.refresh(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Missing refresh token',
            });
        });
    });

    describe('logout', () => {
        it('should return success message', async () => {
            await authController.logout(
                mockReq as Request,
                mockRes as Response
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Logged out successfully',
            });
        });
    });
});
