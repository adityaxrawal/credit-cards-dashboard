/**
 * Session Management Service
 * Handles active sessions, token management, and session revocation
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
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

        const result = await pool.query(
            `INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4::inet, $5, $6)
             RETURNING *`,
            [
                userId,
                tokenHash,
                JSON.stringify(deviceInfo),
                options.ipAddress || null,
                options.userAgent || null,
                options.expiresAt,
            ]
        );

        return this.mapRowToSession(result.rows[0]);
    }

    /**
     * Get active sessions for a user
     */
    static async getActiveSessions(userId: string): Promise<UserSession[]> {
        const result = await pool.query(
            `SELECT * FROM user_sessions
             WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
             ORDER BY last_accessed_at DESC`,
            [userId]
        );

        return result.rows.map(this.mapRowToSession);
    }

    /**
     * Update last accessed time
     */
    static async touchSession(tokenHash: string): Promise<void> {
        await pool.query(
            `UPDATE user_sessions SET last_accessed_at = NOW()
             WHERE token_hash = $1 AND is_active = true`,
            [tokenHash]
        );
    }

    /**
     * Revoke a specific session
     */
    static async revokeSession(
        userId: string,
        sessionId: string,
        reason: string = 'user_revoked'
    ): Promise<boolean> {
        const result = await pool.query(
            `UPDATE user_sessions
             SET is_active = false, revoked_at = NOW(), revoked_reason = $3
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [sessionId, userId, reason]
        );

        if ((result.rowCount ?? 0) > 0) {
            logger.info('session_revoked', { userId, sessionId, reason });
            return true;
        }

        return false;
    }

    /**
     * Revoke all sessions for a user (logout all devices)
     */
    static async revokeAllSessions(
        userId: string,
        exceptSessionId?: string
    ): Promise<number> {
        let query = `UPDATE user_sessions
                     SET is_active = false, revoked_at = NOW(), revoked_reason = 'logout_all'
                     WHERE user_id = $1 AND is_active = true`;
        const params: any[] = [userId];

        if (exceptSessionId) {
            query += ` AND id != $2`;
            params.push(exceptSessionId);
        }

        const result = await pool.query(query, params);
        const count = result.rowCount ?? 0;

        logger.info('all_sessions_revoked', { userId, count, exceptSessionId });
        return count;
    }

    /**
     * Validate a session by token
     */
    static async validateSession(token: string): Promise<UserSession | null> {
        const tokenHash = this.hashToken(token);

        const result = await pool.query(
            `SELECT * FROM user_sessions
             WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return null;
        }

        // Update last accessed
        await this.touchSession(tokenHash);

        return this.mapRowToSession(result.rows[0]);
    }

    /**
     * Clean up expired sessions
     */
    static async cleanupExpiredSessions(): Promise<number> {
        const result = await pool.query(
            `DELETE FROM user_sessions WHERE expires_at < NOW() RETURNING id`
        );

        return result.rowCount ?? 0;
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
    private static mapRowToSession(row: any): UserSession {
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
