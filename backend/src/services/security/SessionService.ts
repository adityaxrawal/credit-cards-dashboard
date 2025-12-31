
/**
 * Session Service
 * Manages active user sessions and allows revocation.
 * Note: Since we use JWTs, true revocation requires a blacklist (Redis/DB).
 * For this implementation, we will use a DB table 'active_sessions' or 'token_blacklist'.
 */

import pool from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export class SessionService {

    /**
     * Log a new login session
     */
    static async createSession(userId: string, deviceInfo: string, ipAddress: string): Promise<string> {
        const sessionId = uuidv4();

        await pool.query(
            `INSERT INTO user_sessions (id, user_id, device_info, ip_address, last_active, created_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [sessionId, userId, deviceInfo, ipAddress]
        );

        return sessionId;
    }

    /**
     * Get active sessions for a user
     */
    static async getActiveSessions(userId: string) {
        const result = await pool.query(
            `SELECT id, device_info, ip_address, last_active, created_at 
             FROM user_sessions 
             WHERE user_id = $1 AND is_active = true
             ORDER BY last_active DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Revoke a specific session
     */
    static async revokeSession(sessionId: string, userId: string) {
        await pool.query(
            `UPDATE user_sessions SET is_active = false WHERE id = $1 AND user_id = $2`,
            [sessionId, userId]
        );
        // In a real JWT setup, you'd add the JTI to a Redis blacklist here.
    }

    /**
     * Revoke all other sessions
     */
    static async revokeAllOtherSessions(userId: string, currentSessionId: string) {
        await pool.query(
            `UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND id != $2`,
            [userId, currentSessionId]
        );
    }
}
