import { CategoryRepository, CategoryRow } from '@modules/categories/categories.repository';
import { Category, MerchantCategoryMapping } from '@shared/types/transaction.types';

/**
 * CategoryService - Manages hierarchical categories and merchant mappings
 */
export class CategoryService {
    /**
     * Get all categories with optional hierarchy
     */
    static async getAllCategories(userId?: string, includeChildren = true): Promise<Category[]> {
        const categories = await CategoryRepository.findAll();

        if (includeChildren) {
            return this.buildHierarchy(categories as Category[]);
        }

        return categories as Category[];
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
            if (cat.parent_id) {
                const parent = categoryMap.get(cat.parent_id);
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
        return CategoryRepository.findById(categoryId) as Promise<Category | null>;
    }

    /**
     * Get category by slug
     */
    static async getCategoryBySlug(slug: string): Promise<Category | null> {
        return CategoryRepository.findBySlug(slug) as Promise<Category | null>;
    }

    /**
     * Create a custom category (user-created)
     */
    static async createCategory(data: {
        name: string;
        slug: string;
        parent_id?: string;
        icon?: string;
        color?: string;
        description?: string;
        is_personal?: boolean;
        is_tax_deductible?: boolean;
    }): Promise<Category> {
        return CategoryRepository.create(data) as Promise<Category>;
    }

    /**
     * Update a category (only non-system categories)
     */
    static async updateCategory(categoryId: string, data: Partial<{
        name: string;
        icon: string;
        color: string;
        description: string;
        is_personal: boolean;
        is_tax_deductible: boolean;
    }>): Promise<Category | null> {
        // Check if system category
        const existing = await this.getCategoryById(categoryId);
        if (!existing || existing.is_system) {
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
        if (data.is_personal !== undefined) {
            updates.push(`is_personal = $${paramIndex++}`);
            values.push(data.is_personal);
        }
        if (data.is_tax_deductible !== undefined) {
            updates.push(`is_tax_deductible = $${paramIndex++}`);
            values.push(data.is_tax_deductible);
        }

        if (updates.length === 0) {
            return existing;
        }

        return CategoryRepository.update(categoryId, updates, values) as Promise<Category | null>;
    }

    /**
     * Match merchant name to category using mappings
     */
    static async matchMerchantToCategory(merchantName: string, userId?: string): Promise<{
        categoryId: string | null;
        confidence: number;
        matchedPattern?: string;
    }> {
        const mappings = await CategoryRepository.getMerchantMappings(userId);
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
        merchant_pattern: string;
        category_id: string;
        priority?: number;
        is_regex?: boolean;
        created_by?: string;
    }): Promise<MerchantCategoryMapping> {
        return CategoryRepository.createMerchantMapping(data);
    }

    /**
     * Override transaction category (user action)
     */
    static async overrideTransactionCategory(
        transactionId: string,
        categoryId: string,
        userId: string
    ): Promise<boolean> {
        return CategoryRepository.overrideTransactionCategory(transactionId, categoryId, userId);
    }

    /**
     * Get category statistics for a user
     */
    static async getCategoryStats(userId: string, startDate?: Date, endDate?: Date): Promise<Array<{
        category_id: string;
        category_name: string;
        parent_id: string | null;
        total_amount: number;
        transaction_count: number;
    }>> {
        return CategoryRepository.getCategoryStats(userId, startDate, endDate);
    }
}
