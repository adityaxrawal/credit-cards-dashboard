/**
 * Recurring Transactions Controller
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { RecurringPatternService } from '../services/recurring/RecurringPatternService';
import logger from '../utils/infrastructure/logger';

/**
 * Get all recurring patterns
 */
export async function getPatterns(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const status = req.query.status as string || 'active';
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await RecurringPatternService.getPatterns(userId, { status, limit, offset });

        res.json({
            success: true,
            data: result.patterns,
            pagination: {
                limit,
                offset,
                total: result.total,
            },
        });
    } catch (error) {
        logger.error('get_patterns_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Detect recurring patterns from transaction history
 */
export async function detectPatterns(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;

        const patterns = await RecurringPatternService.detectPatterns(userId);

        res.json({
            success: true,
            data: patterns,
            count: patterns.length,
        });
    } catch (error) {
        logger.error('detect_patterns_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Save detected patterns
 */
export async function savePatterns(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { patterns } = req.body;

        if (!Array.isArray(patterns) || patterns.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No patterns provided',
            });
        }

        const saved = [];
        for (const pattern of patterns) {
            const result = await RecurringPatternService.savePattern(userId, pattern);
            saved.push(result);
        }

        res.json({
            success: true,
            data: saved,
            savedCount: saved.length,
        });
    } catch (error) {
        logger.error('save_patterns_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Pause a pattern
 */
export async function pausePattern(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await RecurringPatternService.pausePattern(userId, id);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            message: 'Pattern paused',
        });
    } catch (error) {
        logger.error('pause_pattern_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Resume a paused pattern
 */
export async function resumePattern(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await RecurringPatternService.resumePattern(userId, id);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            message: 'Pattern resumed',
        });
    } catch (error) {
        logger.error('resume_pattern_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Delete a pattern
 */
export async function deletePattern(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await RecurringPatternService.deletePattern(userId, id);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            message: 'Pattern deleted',
        });
    } catch (error) {
        logger.error('delete_pattern_error', { error, userId: req.user?.id });
        next(error);
    }
}

/**
 * Confirm a pattern (user verification)
 */
export async function confirmPattern(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await RecurringPatternService.confirmPattern(userId, id);

        res.json({
            success: true,
            message: 'Pattern confirmed',
        });
    } catch (error) {
        logger.error('confirm_pattern_error', { error, userId: req.user?.id });
        next(error);
    }
}
