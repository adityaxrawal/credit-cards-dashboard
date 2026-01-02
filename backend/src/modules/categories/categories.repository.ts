/**
 * Category Repository
 * Data access layer for categories and merchant mappings
 */

import { query } from '@shared/database/db';

export interface CategoryRow {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    icon: string | null;
    color: string | null;
    description: string | null;
    is_system: boolean;
    is_personal: boolean;
    is_tax_deductible: boolean;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
}

export interface MerchantMappingRow {
    id: string;
    merchant_pattern: string;
    category_id: string;
    priority: number;
    is_regex: boolean;
    created_by: string | null;
    created_at: Date;
}

const CATEGORY_SELECT = `
    id, name, slug, parent_id, icon, color, description,
    is_system, is_personal, 
    is_tax_deductible, sort_order,
    created_at, updated_at
`;

export class CategoryRepository {
    /**
     * Get all categories
     */
    static async findAll(): Promise<CategoryRow[]> {
        const result = await query(`
            SELECT ${CATEGORY_SELECT}
            FROM categories
            ORDER BY sort_order, name
        `);
        return result.rows;
    }

    /**
     * Find category by ID
     */
    static async findById(categoryId: string): Promise<CategoryRow | null> {
        const result = await query(`
            SELECT ${CATEGORY_SELECT}
            FROM categories
            WHERE id = $1
        `, [categoryId]);
        return result.rows[0] || null;
    }

    /**
     * Find category by slug
     */
    static async findBySlug(slug: string): Promise<CategoryRow | null> {
        const result = await query(`
            SELECT ${CATEGORY_SELECT}
            FROM categories
            WHERE slug = $1
        `, [slug]);
        return result.rows[0] || null;
    }

    /**
     * Find category by name (case insensitive)
     */
    static async findByName(name: string): Promise<CategoryRow | null> {
        const result = await query(`
            SELECT ${CATEGORY_SELECT}
            FROM categories
            WHERE LOWER(name) = LOWER($1)
        `, [name]);
        return result.rows[0] || null;
    }

    /**
     * Create a new category
     */
    static async create(data: {
        name: string;
        slug: string;
        parent_id?: string | null;
        icon?: string | null;
        color?: string | null;
        description?: string | null;
        is_personal?: boolean;
        is_tax_deductible?: boolean;
    }): Promise<CategoryRow> {
        const result = await query(`
            INSERT INTO categories (name, slug, parent_id, icon, color, description, is_system, is_personal, is_tax_deductible)
            VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
            RETURNING ${CATEGORY_SELECT}
        `, [
            data.name,
            data.slug,
            data.parent_id || null,
            data.icon || null,
            data.color || null,
            data.description || null,
            data.is_personal !== false,
            data.is_tax_deductible || false
        ]);
        return result.rows[0];
    }

    /**
     * Update a category
     */
    static async update(categoryId: string, updates: string[], values: any[]): Promise<CategoryRow | null> {
        if (updates.length === 0) return null;

        values.push(categoryId);
        const result = await query(`
            UPDATE categories SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING ${CATEGORY_SELECT}
        `, values);
        return result.rows[0] || null;
    }

    /**
     * Get merchant category mappings
     */
    static async getMerchantMappings(userId?: string | null): Promise<MerchantMappingRow[]> {
        const result = await query(`
            SELECT id, merchant_pattern, category_id, priority, is_regex, created_by, created_at
            FROM merchant_category_mappings
            WHERE created_by IS NULL OR created_by = $1
            ORDER BY priority DESC
        `, [userId || null]);
        return result.rows;
    }

    /**
     * Create merchant mapping
     */
    static async createMerchantMapping(data: {
        merchant_pattern: string;
        category_id: string;
        priority?: number;
        is_regex?: boolean;
        created_by?: string | null;
    }): Promise<any> {
        const result = await query(`
            INSERT INTO merchant_category_mappings (merchant_pattern, category_id, priority, is_regex, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING 
                id, merchant_pattern, category_id,
                priority, is_regex, created_by,
                created_at
        `, [
            data.merchant_pattern,
            data.category_id,
            data.priority || 0,
            data.is_regex || false,
            data.created_by || null
        ]);
        return result.rows[0];
    }

    /**
     * Override transaction category
     */
    static async overrideTransactionCategory(
        transactionId: string,
        categoryId: string,
        userId: string
    ): Promise<boolean> {
        const result = await query(`
            UPDATE transactions 
            SET category_id = $1, category_override_by_user = TRUE, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
        `, [categoryId, transactionId, userId]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get category statistics
     */
    static async getCategoryStats(
        userId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<any[]> {
        let dateFilter = '';
        const params: any[] = [userId];

        if (startDate) {
            params.push(startDate);
            dateFilter += ` AND t.transaction_date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            dateFilter += ` AND t.transaction_date <= $${params.length}`;
        }

        const result = await query(`
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.parent_id,
                COALESCE(SUM(t.amount), 0) as total_amount,
                COUNT(t.id)::int as transaction_count
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1 ${dateFilter}
            GROUP BY c.id, c.name, c.parent_id
            ORDER BY total_amount DESC
        `, params);

        return result.rows;
    }
}
