/**
 * Session Repository
 * Data access layer for user sessions
 */

import { query } from '@shared/database/db';

export interface SessionRow {
    id: string;
    user_id: string;
    token_hash: string;
    device_info: any;
    ip_address: string | null;
    user_agent: string | null;
    is_active: boolean;
    created_at: Date;
    last_accessed_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
    revoked_reason: string | null;
}

export interface CreateSessionData {
    userId: string;
    tokenHash: string;
    deviceInfo: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
}

export class SessionRepository {
    /**
     * Create a new session
     */
    static async create(data: CreateSessionData): Promise<SessionRow> {
        const result = await query(
            `INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4::inet, $5, $6)
             RETURNING *`,
            [
                data.userId,
                data.tokenHash,
                JSON.stringify(data.deviceInfo),
                data.ipAddress || null,
                data.userAgent || null,
                data.expiresAt,
            ]
        );
        return result.rows[0];
    }

    /**
     * Find active sessions by user ID
     */
    static async findActiveByUserId(userId: string): Promise<SessionRow[]> {
        const result = await query(
            `SELECT * FROM user_sessions
             WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
             ORDER BY last_accessed_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Find session by token hash
     */
    static async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
        const result = await query(
            `SELECT * FROM user_sessions
             WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()`,
            [tokenHash]
        );
        return result.rows[0] || null;
    }

    /**
     * Update last accessed time
     */
    static async touch(tokenHash: string): Promise<void> {
        await query(
            `UPDATE user_sessions SET last_accessed_at = NOW()
             WHERE token_hash = $1 AND is_active = true`,
            [tokenHash]
        );
    }

    /**
     * Revoke a specific session
     */
    static async revoke(sessionId: string, userId: string, reason: string): Promise<boolean> {
        const result = await query(
            `UPDATE user_sessions
             SET is_active = false, revoked_at = NOW(), revoked_reason = $3
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [sessionId, userId, reason]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Revoke all sessions for a user, optionally except one
     */
    static async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
        let sql = `UPDATE user_sessions
                   SET is_active = false, revoked_at = NOW(), revoked_reason = 'logout_all'
                   WHERE user_id = $1 AND is_active = true`;
        const params: any[] = [userId];

        if (exceptSessionId) {
            sql += ` AND id != $2`;
            params.push(exceptSessionId);
        }

        const result = await query(sql, params);
        return result.rowCount ?? 0;
    }

    /**
     * Delete expired sessions
     */
    static async deleteExpired(): Promise<number> {
        const result = await query(
            `DELETE FROM user_sessions WHERE expires_at < NOW() RETURNING id`
        );
        return result.rowCount ?? 0;
    }
}
