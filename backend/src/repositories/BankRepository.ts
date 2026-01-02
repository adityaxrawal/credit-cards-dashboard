import { query } from '../lib/db';
import { Bank, UUID } from '../types/instruments.types';

export class BankRepository {
    static async findAll(): Promise<Bank[]> {
        const result = await query('SELECT * FROM banks WHERE is_active = true ORDER BY name ASC');
        return result.rows;
    }

    static async findById(id: UUID): Promise<Bank | null> {
        const result = await query('SELECT * FROM banks WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async findByName(name: string): Promise<Bank | null> {
        const result = await query('SELECT * FROM banks WHERE name = $1', [name]);
        return result.rows[0] || null;
    }

    static async findByCode(code: string): Promise<Bank | null> {
        const result = await query('SELECT * FROM banks WHERE code = $1', [code]);
        return result.rows[0] || null;
    }

    static async create(data: Partial<Bank>): Promise<Bank> {
        // Check for existing bank by name OR code to avoid unique constraint violations
        const existing = await query(
            'SELECT * FROM banks WHERE name = $1 OR code = $2',
            [data.name, data.code]
        );

        if (existing.rows.length > 0) {
            return existing.rows[0];
        }

        const result = await query(
            `INSERT INTO banks (name, code, logo_url, website, support_email) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
            [data.name, data.code, data.logoUrl, data.website, data.supportEmail]
        );
        return result.rows[0];
    }

    static async update(id: UUID, data: Partial<Bank>): Promise<Bank> {
        const fields = Object.keys(data).filter(key => data[key as keyof Bank] !== undefined);
        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => data[field as keyof Bank]);

        const result = await query(
            `UPDATE banks SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }

    static async findByNameNormalized(name: string): Promise<Bank | null> {
        const result = await query('SELECT * FROM banks WHERE LOWER(name) = LOWER($1)', [name]);
        return result.rows[0] || null;
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM banks WHERE id = $1', [id]);
    }
}
