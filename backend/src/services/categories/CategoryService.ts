import pool from '../../lib/db';
import { Category, MerchantCategoryMapping } from '../../types/transaction.types';

/**
 * CategoryService - Manages hierarchical categories and merchant mappings
 */
export class CategoryService {
    /**
     * Get all categories with optional hierarchy
     */
    static async getAllCategories(userId?: string, includeChildren = true): Promise<Category[]> {
        const result = await pool.query(`
            SELECT 
                id, name, slug, parent_id as "parentId", icon, color, description,
                is_system as "isSystem", is_personal as "isPersonal", 
                is_tax_deductible as "isTaxDeductible", sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM categories
            ORDER BY sort_order, name
        `);

        const categories = result.rows;

        if (includeChildren) {
            return this.buildHierarchy(categories);
        }

        return categories;
    }

    /**
     * Build category hierarchy from flat list
     */
    private static buildHierarchy(categories: Category[]): Category[] {
        const categoryMap = new Map<string, Category>();
        const roots: Category[] = [];

        // First pass: create map
        for (const cat of categories) {
            categoryMap.set(cat.id, { ...cat, children: [] });
        }

        // Second pass: build tree
        for (const cat of categories) {
            const category = categoryMap.get(cat.id)!;
            if (cat.parentId) {
                const parent = categoryMap.get(cat.parentId);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(category);
                } else {
                    roots.push(category);
                }
            } else {
                roots.push(category);
            }
        }

        return roots;
    }

    /**
     * Get category by ID
     */
    static async getCategoryById(categoryId: string): Promise<Category | null> {
        const result = await pool.query(`
            SELECT 
                id, name, slug, parent_id as "parentId", icon, color, description,
                is_system as "isSystem", is_personal as "isPersonal", 
                is_tax_deductible as "isTaxDeductible", sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM categories
            WHERE id = $1
        `, [categoryId]);

        return result.rows[0] || null;
    }

    /**
     * Get category by slug
     */
    static async getCategoryBySlug(slug: string): Promise<Category | null> {
        const result = await pool.query(`
            SELECT 
                id, name, slug, parent_id as "parentId", icon, color, description,
                is_system as "isSystem", is_personal as "isPersonal", 
                is_tax_deductible as "isTaxDeductible", sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM categories
            WHERE slug = $1
        `, [slug]);

        return result.rows[0] || null;
    }

    /**
     * Create a custom category (user-created)
     */
    static async createCategory(data: {
        name: string;
        slug: string;
        parentId?: string;
        icon?: string;
        color?: string;
        description?: string;
        isPersonal?: boolean;
        isTaxDeductible?: boolean;
    }): Promise<Category> {
        const result = await pool.query(`
            INSERT INTO categories (name, slug, parent_id, icon, color, description, is_system, is_personal, is_tax_deductible)
            VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
            RETURNING 
                id, name, slug, parent_id as "parentId", icon, color, description,
                is_system as "isSystem", is_personal as "isPersonal", 
                is_tax_deductible as "isTaxDeductible", sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
        `, [
            data.name,
            data.slug,
            data.parentId || null,
            data.icon || null,
            data.color || null,
            data.description || null,
            data.isPersonal !== false,
            data.isTaxDeductible || false
        ]);

        return result.rows[0];
    }

    /**
     * Update a category (only non-system categories)
     */
    static async updateCategory(categoryId: string, data: Partial<{
        name: string;
        icon: string;
        color: string;
        description: string;
        isPersonal: boolean;
        isTaxDeductible: boolean;
    }>): Promise<Category | null> {
        // Check if system category
        const existing = await this.getCategoryById(categoryId);
        if (!existing || existing.isSystem) {
            return null;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.icon !== undefined) {
            updates.push(`icon = $${paramIndex++}`);
            values.push(data.icon);
        }
        if (data.color !== undefined) {
            updates.push(`color = $${paramIndex++}`);
            values.push(data.color);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description);
        }
        if (data.isPersonal !== undefined) {
            updates.push(`is_personal = $${paramIndex++}`);
            values.push(data.isPersonal);
        }
        if (data.isTaxDeductible !== undefined) {
            updates.push(`is_tax_deductible = $${paramIndex++}`);
            values.push(data.isTaxDeductible);
        }

        if (updates.length === 0) {
            return existing;
        }

        values.push(categoryId);

        const result = await pool.query(`
            UPDATE categories SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING 
                id, name, slug, parent_id as "parentId", icon, color, description,
                is_system as "isSystem", is_personal as "isPersonal", 
                is_tax_deductible as "isTaxDeductible", sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
        `, values);

        return result.rows[0] || null;
    }

    /**
     * Match merchant name to category using mappings
     */
    static async matchMerchantToCategory(merchantName: string, userId?: string): Promise<{
        categoryId: string | null;
        confidence: number;
        matchedPattern?: string;
    }> {
        // Get all mappings ordered by priority
        const result = await pool.query(`
            SELECT id, merchant_pattern, category_id, priority, is_regex
            FROM merchant_category_mappings
            WHERE created_by IS NULL OR created_by = $1
            ORDER BY priority DESC
        `, [userId || null]);

        const mappings = result.rows;
        const merchantLower = merchantName.toLowerCase();

        for (const mapping of mappings) {
            let matches = false;

            if (mapping.is_regex) {
                try {
                    const regex = new RegExp(mapping.merchant_pattern, 'i');
                    matches = regex.test(merchantName);
                } catch {
                    // Invalid regex, skip
                }
            } else {
                matches = merchantLower.includes(mapping.merchant_pattern.toLowerCase());
            }

            if (matches) {
                return {
                    categoryId: mapping.category_id,
                    confidence: Math.min(1, 0.7 + (mapping.priority / 1000)),
                    matchedPattern: mapping.merchant_pattern
                };
            }
        }

        return { categoryId: null, confidence: 0 };
    }

    /**
     * Create a merchant-to-category mapping
     */
    static async createMerchantMapping(data: {
        merchantPattern: string;
        categoryId: string;
        priority?: number;
        isRegex?: boolean;
        createdBy?: string;
    }): Promise<MerchantCategoryMapping> {
        const result = await pool.query(`
            INSERT INTO merchant_category_mappings (merchant_pattern, category_id, priority, is_regex, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING 
                id, merchant_pattern as "merchantPattern", category_id as "categoryId",
                priority, is_regex as "isRegex", created_by as "createdBy",
                created_at as "createdAt"
        `, [
            data.merchantPattern,
            data.categoryId,
            data.priority || 0,
            data.isRegex || false,
            data.createdBy || null
        ]);

        return result.rows[0];
    }

    /**
     * Override transaction category (user action)
     */
    static async overrideTransactionCategory(
        transactionId: string,
        categoryId: string,
        userId: string
    ): Promise<boolean> {
        const result = await pool.query(`
            UPDATE transactions 
            SET category_id = $1, category_override_by_user = TRUE, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
        `, [categoryId, transactionId, userId]);

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get category statistics for a user
     */
    static async getCategoryStats(userId: string, startDate?: Date, endDate?: Date): Promise<Array<{
        categoryId: string;
        categoryName: string;
        parentId: string | null;
        totalAmount: number;
        transactionCount: number;
    }>> {
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

        const result = await pool.query(`
            SELECT 
                c.id as "categoryId",
                c.name as "categoryName",
                c.parent_id as "parentId",
                COALESCE(SUM(t.amount), 0) as "totalAmount",
                COUNT(t.id)::int as "transactionCount"
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1 ${dateFilter}
            GROUP BY c.id, c.name, c.parent_id
            ORDER BY "totalAmount" DESC
        `, params);

        return result.rows;
    }
}
