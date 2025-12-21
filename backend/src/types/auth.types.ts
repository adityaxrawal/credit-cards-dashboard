export interface JwtPayload {
    userId: string;
    email?: string;
    iat?: number;
    exp?: number;
}

export enum AuthErrorCode {
    MISSING_TOKEN = 'MISSING_TOKEN',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    INVALID_TOKEN = 'INVALID_TOKEN',
    TOKEN_VERIFICATION_FAILED = 'TOKEN_VERIFICATION_FAILED',
    INVALID_PAYLOAD = 'INVALID_PAYLOAD',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR'
}

import { Request } from 'express';

/**
 * Authenticated user object attached to request by auth middleware
 */
export interface User {
    id: string;
    email: string;
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Express Request extended with authenticated user
 * Use this type in controllers that require authentication
 */
export interface AuthRequest extends Request {
    user: User;
}

