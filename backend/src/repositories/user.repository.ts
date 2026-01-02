import { query } from '../lib/db';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  picture: string;
  google_refresh_token?: string;
  date_of_birth?: Date;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository {
  static async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(data: { googleId: string; email: string; name: string; picture: string }): Promise<User> {
    const result = await query(
      `INSERT INTO users (google_id, email, name, picture) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [data.googleId, data.email, data.name, data.picture]
    );
    return result.rows[0];
  }

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
      // Just return current
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

  static async updateRefreshToken(id: string, refreshToken: string): Promise<void> {
    await query(
      `UPDATE users SET google_refresh_token = $2 WHERE id = $1`,
      [id, refreshToken]
    );
  }
  static async findAll(): Promise<User[]> {
    const result = await query('SELECT * FROM users');
    return result.rows;
  }
}
