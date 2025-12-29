import { Router, Request, Response } from 'express';
import { CategoryService } from '../services/categories';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();

/**
 * @route GET /api/categories
 * @desc Get all categories with hierarchy
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const includeChildren = req.query.flat !== 'true';

    const categories = await CategoryService.getAllCategories(userId, includeChildren);

    res.json({
        success: true,
        data: categories
    });
}));

/**
 * @route GET /api/categories/:id
 * @desc Get category by ID
 * @access Private
 */
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const category = await CategoryService.getCategoryById(req.params.id);

    if (!category) {
        throw new AppError('Category not found', 404);
    }

    res.json({
        success: true,
        data: category
    });
}));

/**
 * @route GET /api/categories/slug/:slug
 * @desc Get category by slug
 * @access Private
 */
router.get('/slug/:slug', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const category = await CategoryService.getCategoryBySlug(req.params.slug);

    if (!category) {
        throw new AppError('Category not found', 404);
    }

    res.json({
        success: true,
        data: category
    });
}));

/**
 * @route POST /api/categories
 * @desc Create a custom category
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, parentId, icon, color, description, isPersonal, isTaxDeductible } = req.body;

    if (!name || !slug) {
        throw new AppError('Name and slug are required', 400);
    }

    // Check if slug exists
    const existing = await CategoryService.getCategoryBySlug(slug);
    if (existing) {
        throw new AppError('Category slug already exists', 409);
    }

    const category = await CategoryService.createCategory({
        name,
        slug,
        parentId,
        icon,
        color,
        description,
        isPersonal,
        isTaxDeductible
    });

    res.status(201).json({
        success: true,
        data: category
    });
}));

/**
 * @route PATCH /api/categories/:id
 * @desc Update a category (non-system only)
 * @access Private
 */
router.patch('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { name, icon, color, description, isPersonal, isTaxDeductible } = req.body;

    const category = await CategoryService.updateCategory(req.params.id, {
        name,
        icon,
        color,
        description,
        isPersonal,
        isTaxDeductible
    });

    if (!category) {
        throw new AppError('Category not found or is a system category', 400);
    }

    res.json({
        success: true,
        data: category
    });
}));

/**
 * @route POST /api/categories/mappings
 * @desc Create a merchant-to-category mapping
 * @access Private
 */
router.post('/mappings', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { merchantPattern, categoryId, priority, isRegex } = req.body;

    if (!merchantPattern || !categoryId) {
        throw new AppError('merchantPattern and categoryId are required', 400);
    }

    const mapping = await CategoryService.createMerchantMapping({
        merchantPattern,
        categoryId,
        priority,
        isRegex,
        createdBy: userId
    });

    res.status(201).json({
        success: true,
        data: mapping
    });
}));

/**
 * @route POST /api/categories/match
 * @desc Match a merchant name to a category
 * @access Private
 */
router.post('/match', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { merchantName } = req.body;

    if (!merchantName) {
        throw new AppError('merchantName is required', 400);
    }

    const result = await CategoryService.matchMerchantToCategory(merchantName, userId);

    res.json({
        success: true,
        data: result
    });
}));

/**
 * @route GET /api/categories/stats
 * @desc Get category statistics for the user
 * @access Private
 */
router.get('/stats', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { startDate, endDate } = req.query;

    const stats = await CategoryService.getCategoryStats(
        userId!,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
    );

    res.json({
        success: true,
        data: stats
    });
}));

/**
 * @route PATCH /api/categories/transactions/:transactionId
 * @desc Override transaction category
 * @access Private
 */
router.patch('/transactions/:transactionId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { transactionId } = req.params;
    const { categoryId } = req.body;

    if (!categoryId) {
        throw new AppError('categoryId is required', 400);
    }

    const success = await CategoryService.overrideTransactionCategory(
        transactionId,
        categoryId,
        userId!
    );

    if (!success) {
        throw new AppError('Transaction not found or access denied', 404);
    }

    res.json({
        success: true,
        message: 'Category updated successfully'
    });
}));

export default router;
