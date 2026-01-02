import { query } from '@shared/database/db';

export interface User {
    id: string;
    google_id: string;
    email: string;
    name: string;
    picture: string;
    google_refresh_token?: string | null;
    gmail_history_id?: string | null;
    gmail_watch_expiration?: Date | null;
    date_of_birth?: Date;
    timezone?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

/**
 * Unified UserRepository - consolidates all user data access methods
 * Merged from: src/repositories/UserRepository.ts and src/repositories/user.repository.ts
 */
export class UserRepository {
    // ==================== Query Methods ====================

    /**
     * Find all active users
     */
    static async getAllActiveUsers(): Promise<{ id: string }[]> {
        const result = await query('SELECT id FROM users WHERE is_active = true');
        return result.rows;
    }

    /**
     * Find all users
     */
    static async findAll(): Promise<User[]> {
        const result = await query('SELECT * FROM users');
        return result.rows;
    }

    /**
     * Find user by ID
     */
    static async findById(id: string): Promise<User | null> {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Find user by Google ID
     */
    static async findByGoogleId(googleId: string): Promise<User | null> {
        const result = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        return result.rows[0] || null;
    }

    // ==================== Create/Update Methods ====================

    /**
     * Create a new user
     */
    static async create(data: {
        googleId: string;
        email: string;
        name: string;
        picture: string;
    }): Promise<User> {
        const result = await query(
            `INSERT INTO users (google_id, email, name, picture) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [data.googleId, data.email, data.name, data.picture]
        );
        return result.rows[0];
    }

    /**
     * Update user profile
     */
    static async update(
        googleId: string,
        data: { name?: string; picture?: string; dateOfBirth?: Date }
    ): Promise<User> {
        const updates: string[] = [];
        const values: any[] = [googleId];
        let paramIndex = 2;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.picture !== undefined) {
            updates.push(`picture = $${paramIndex++}`);
            values.push(data.picture);
        }
        if (data.dateOfBirth !== undefined) {
            updates.push(`date_of_birth = $${paramIndex++}`);
            values.push(data.dateOfBirth);
        }

        if (updates.length === 0) {
            return (await this.findByGoogleId(googleId))!;
        }

        updates.push(`updated_at = NOW()`);

        const result = await query(
            `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE google_id = $1 
       RETURNING *`,
            values
        );
        return result.rows[0];
    }

    // ==================== Token/Auth Methods ====================

    /**
     * Update refresh token
     */
    static async updateRefreshToken(id: string, refreshToken: string): Promise<void> {
        await query(`UPDATE users SET google_refresh_token = $2 WHERE id = $1`, [
            id,
            refreshToken,
        ]);
    }

    /**
     * Update Gmail Refresh Token (encrypted)
     */
    static async updateGmailToken(userId: string, encryptedToken: string): Promise<void> {
        await query(
            'UPDATE users SET google_refresh_token = $1, updated_at = NOW() WHERE id = $2',
            [encryptedToken, userId]
        );
    }

    // ==================== Gmail Watch Methods ====================

    /**
     * Update Gmail Watch Info
     */
    static async updateGmailWatch(
        userId: string,
        historyId: string,
        expiration: Date
    ): Promise<void> {
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

    // ==================== Timezone Methods ====================

    /**
     * Get user's timezone preference
     */
    static async getUserTimezone(userId: string): Promise<string | null> {
        const result = await query(
            `SELECT timezone FROM users WHERE id = $1`,
            [userId]
        );
        return result.rows[0]?.timezone || null;
    }

    /**
     * Update user's timezone preference
     */
    static async updateTimezone(userId: string, timezone: string): Promise<void> {
        await query(
            `UPDATE users SET timezone = $2, updated_at = NOW() WHERE id = $1`,
            [userId, timezone]
        );
    }
}

