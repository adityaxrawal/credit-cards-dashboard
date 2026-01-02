/**
 * Recurring Transactions Controller
 * 
 * Handles recurring pattern management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Recurring Pattern Service Interface
 */
export interface IRecurringPatternService {
    getPatterns(userId: string, opts: { status: string; limit: number; offset: number }): Promise<{ patterns: any[]; total: number }>;
    detectPatterns(userId: string): Promise<any[]>;
    savePattern(userId: string, pattern: any): Promise<any>;
    pausePattern(userId: string, id: string): Promise<{ success: boolean; error?: string }>;
    resumePattern(userId: string, id: string): Promise<{ success: boolean; error?: string }>;
    deletePattern(userId: string, id: string): Promise<{ success: boolean; error?: string }>;
    confirmPattern(userId: string, id: string): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IRecurringController {
    getPatterns(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    detectPatterns(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    savePatterns(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    pausePattern(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    resumePattern(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deletePattern(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    confirmPattern(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Recurring controller with injected dependencies
 */
export function createRecurringController(service: IRecurringPatternService): IRecurringController {
    return {
        async getPatterns(req, res, next) {
            try {
                const userId = req.user.id;
                const status = req.query.status as string || 'active';
                const limit = parseInt(req.query.limit as string) || 50;
                const offset = parseInt(req.query.offset as string) || 0;
                const result = await service.getPatterns(userId, { status, limit, offset });
                res.json({ success: true, data: result.patterns, pagination: { limit, offset, total: result.total } });
            } catch (error) {
                logger.error('get_patterns_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async detectPatterns(req, res, next) {
            try {
                const patterns = await service.detectPatterns(req.user.id);
                res.json({ success: true, data: patterns, count: patterns.length });
            } catch (error) {
                logger.error('detect_patterns_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async savePatterns(req, res, next) {
            try {
                const { patterns } = req.body;
                if (!Array.isArray(patterns) || patterns.length === 0) {
                    return res.status(400).json({ success: false, error: 'No patterns provided' }) as any;
                }
                const saved = [];
                for (const pattern of patterns) {
                    const result = await service.savePattern(req.user.id, pattern);
                    saved.push(result);
                }
                res.json({ success: true, data: saved, savedCount: saved.length });
            } catch (error) {
                logger.error('save_patterns_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async pausePattern(req, res, next) {
            try {
                const result = await service.pausePattern(req.user.id, req.params.id);
                if (!result.success) return res.status(404).json({ success: false, error: result.error }) as any;
                res.json({ success: true, message: 'Pattern paused' });
            } catch (error) {
                logger.error('pause_pattern_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async resumePattern(req, res, next) {
            try {
                const result = await service.resumePattern(req.user.id, req.params.id);
                if (!result.success) return res.status(404).json({ success: false, error: result.error }) as any;
                res.json({ success: true, message: 'Pattern resumed' });
            } catch (error) {
                logger.error('resume_pattern_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async deletePattern(req, res, next) {
            try {
                const result = await service.deletePattern(req.user.id, req.params.id);
                if (!result.success) return res.status(404).json({ success: false, error: result.error }) as any;
                res.json({ success: true, message: 'Pattern deleted' });
            } catch (error) {
                logger.error('delete_pattern_error', { error, userId: req.user?.id });
                next(error);
            }
        },

        async confirmPattern(req, res, next) {
            try {
                await service.confirmPattern(req.user.id, req.params.id);
                res.json({ success: true, message: 'Pattern confirmed' });
            } catch (error) {
                logger.error('confirm_pattern_error', { error, userId: req.user?.id });
                next(error);
            }
        },
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { RecurringPatternService } from './recurring-pattern.service';

// Adapt static service to interface
const serviceAdapter: IRecurringPatternService = {
    getPatterns: (userId, opts) => RecurringPatternService.getPatterns(userId, opts),
    detectPatterns: (userId) => RecurringPatternService.detectPatterns(userId),
    savePattern: (userId, pattern) => RecurringPatternService.savePattern(userId, pattern),
    pausePattern: (userId, id) => RecurringPatternService.pausePattern(userId, id),
    resumePattern: (userId, id) => RecurringPatternService.resumePattern(userId, id),
    deletePattern: (userId, id) => RecurringPatternService.deletePattern(userId, id),
    confirmPattern: (userId, id) => RecurringPatternService.confirmPattern(userId, id),
};

const defaultController = createRecurringController(serviceAdapter);

export const getPatterns = defaultController.getPatterns;
export const detectPatterns = defaultController.detectPatterns;
export const savePatterns = defaultController.savePatterns;
export const pausePattern = defaultController.pausePattern;
export const resumePattern = defaultController.resumePattern;
export const deletePattern = defaultController.deletePattern;
export const confirmPattern = defaultController.confirmPattern;
