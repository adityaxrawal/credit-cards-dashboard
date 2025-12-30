/**
 * Preferences Controller
 * API endpoints for notification preferences management
 */

import { AuthRequest } from '../types/auth.types';
import { Response, NextFunction } from 'express';
import { PreferenceService } from '../services/notifications/PreferenceService';
import { z } from 'zod';

/**
 * Get user notification preferences
 */
export async function getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const preferences = await PreferenceService.getPreferences(userId);

        res.json({ data: preferences });
    } catch (error) {
        next(error);
    }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;

        const Schema = z.object({
            emailEnabled: z.boolean().optional(),
            pushEnabled: z.boolean().optional(),
            largeTransactionThreshold: z.number().positive().optional(),
            budgetWarningThreshold: z.number().min(0).max(100).optional(),
            billReminderDays: z.number().min(0).max(30).optional(),
            quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
            quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        });

        const validated = await Schema.parseAsync(req.body);
        const preferences = await PreferenceService.updatePreferences(userId, validated);

        res.json({ data: preferences });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid preferences data',
                    details: error.errors
                }
            });
        }
        next(error);
    }
}

/**
 * Reset preferences to default
 */
export async function resetPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const preferences = await PreferenceService.createDefaultPreferences(userId);

        res.json({ data: preferences });
    } catch (error) {
        next(error);
    }
}

/**
 * Check if quiet hours are active
 */
export async function checkQuietHours(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user.id;
        const isQuiet = await PreferenceService.isQuietHours(userId);

        res.json({ data: { isQuietHours: isQuiet } });
    } catch (error) {
        next(error);
    }
}
