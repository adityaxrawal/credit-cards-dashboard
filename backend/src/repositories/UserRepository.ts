import { query } from '../lib/db';

export class UserRepository {
    /**
     * Find all active users
     */
    /**
     * Find all active users
     */
    static async getAllActiveUsers(): Promise<{ id: string }[]> {
        const result = await query('SELECT id FROM users WHERE is_active = true');
        return result.rows;
    }

    /**
     * Find user by ID
     */
    static async findById(id: string): Promise<any> {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    /**
     * Update Gmail Refresh Token
     */
    static async updateGmailToken(userId: string, encryptedToken: string): Promise<void> {
        await query(
            'UPDATE users SET google_refresh_token = $1, updated_at = NOW() WHERE id = $2',
            [encryptedToken, userId]
        );
    }

    /**
     * Update Gmail Watch Info
     */
    static async updateGmailWatch(userId: string, historyId: string, expiration: Date): Promise<void> {
        await query(
            `UPDATE users 
             SET gmail_history_id = $1, gmail_watch_expiration = $2, updated_at = NOW()
             WHERE id = $3`,
            [historyId, expiration, userId]
        );
    }

    /**
     * Clear Gmail Connection
     */
    static async clearGmailConnection(userId: string): Promise<void> {
        await query(
            `UPDATE users 
             SET google_refresh_token = NULL, gmail_history_id = NULL, gmail_watch_expiration = NULL, updated_at = NOW()
             WHERE id = $1`,
            [userId]
        );
    }

    /**
     * Get Gmail connection info
     */
    static async getGmailConnectionInfo(userId: string): Promise<{
        google_refresh_token: string | null;
        gmail_watch_expiration: Date | null;
        gmail_history_id: string | null;
    } | null> {
        const result = await query(
            `SELECT google_refresh_token, gmail_watch_expiration, gmail_history_id 
             FROM users WHERE id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    }
}
