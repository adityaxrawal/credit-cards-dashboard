/**
 * Session Management Service
 * Handles active sessions, token management, and session revocation
 */

import { SessionRepository, SessionRow } from '@repositories/SessionRepository';
import logger from '@shared/utils/infrastructure/logger';
import crypto from 'crypto';

export interface UserSession {
    id: string;
    userId: string;
    tokenHash: string;
    deviceInfo: {
        browser?: string;
        os?: string;
        device?: string;
    };
    ipAddress: string | null;
    userAgent: string | null;
    isActive: boolean;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    revokedReason: string | null;
}

export class SessionService {
    /**
     * Create a new session
     */
    static async createSession(
        userId: string,
        token: string,
        options: {
            userAgent?: string;
            ipAddress?: string;
            expiresAt: Date;
        }
    ): Promise<UserSession> {
        const tokenHash = this.hashToken(token);
        const deviceInfo = this.parseUserAgent(options.userAgent || '');

        const row = await SessionRepository.create({
            userId,
            tokenHash,
            deviceInfo,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            expiresAt: options.expiresAt,
        });

        return this.mapRowToSession(row);
    }

    /**
     * Get active sessions for a user
     */
    static async getActiveSessions(userId: string): Promise<UserSession[]> {
        const rows = await SessionRepository.findActiveByUserId(userId);
        return rows.map(this.mapRowToSession);
    }

    /**
     * Update last accessed time
     */
    static async touchSession(tokenHash: string): Promise<void> {
        await SessionRepository.touch(tokenHash);
    }

    /**
     * Revoke a specific session
     */
    static async revokeSession(
        userId: string,
        sessionId: string,
        reason: string = 'user_revoked'
    ): Promise<boolean> {
        const revoked = await SessionRepository.revoke(sessionId, userId, reason);

        if (revoked) {
            logger.info('session_revoked', { userId, sessionId, reason });
        }

        return revoked;
    }

    /**
     * Revoke all sessions for a user (logout all devices)
     */
    static async revokeAllSessions(
        userId: string,
        exceptSessionId?: string
    ): Promise<number> {
        const count = await SessionRepository.revokeAll(userId, exceptSessionId);
        logger.info('all_sessions_revoked', { userId, count, exceptSessionId });
        return count;
    }

    /**
     * Validate a session by token
     */
    static async validateSession(token: string): Promise<UserSession | null> {
        const tokenHash = this.hashToken(token);
        const row = await SessionRepository.findByTokenHash(tokenHash);

        if (!row) {
            return null;
        }

        // Update last accessed
        await this.touchSession(tokenHash);

        return this.mapRowToSession(row);
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions(): Promise<number> {
        return SessionRepository.deleteExpired();
    }

    /**
     * Hash a token for storage
     */
    private static hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Parse user agent to extract device info
     */
    private static parseUserAgent(userAgent: string): {
        browser?: string;
        os?: string;
        device?: string;
    } {
        const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)[\/\s](\d+)/)?.[1];
        const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/)?.[1];
        const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';

        return { browser, os, device };
    }

    /**
     * Map database row to session object
     */
    private static mapRowToSession(row: SessionRow): UserSession {
        return {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            deviceInfo: row.device_info || {},
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            isActive: row.is_active,
            createdAt: row.created_at,
            lastAccessedAt: row.last_accessed_at,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
            revokedReason: row.revoked_reason,
        };
    }
}
