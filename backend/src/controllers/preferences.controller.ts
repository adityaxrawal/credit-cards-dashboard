import { AuthRequest } from '../types/auth.types';
import { Response, NextFunction } from 'express';
import { z } from 'zod';

export interface IPreferenceService {
    getPreferences(userId: string): Promise<any>;
    updatePreferences(userId: string, data: any): Promise<any>;
    createDefaultPreferences(userId: string): Promise<any>;
    isQuietHours(userId: string): Promise<boolean>;
}

export interface IPreferencesController {
    getPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    resetPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    checkQuietHours(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createPreferencesController(service: IPreferenceService): IPreferencesController {
    return {
        async getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const preferences = await service.getPreferences(userId);

                res.json({ data: preferences });
            } catch (error) {
                next(error);
            }
        },

        async updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
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
                const preferences = await service.updatePreferences(userId, validated);

                res.json({ data: preferences });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    res.status(422).json({
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid preferences data',
                            details: error.errors
                        }
                    });
                    return;
                }
                next(error);
            }
        },

        async resetPreferences(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const preferences = await service.createDefaultPreferences(userId);

                res.json({ data: preferences });
            } catch (error) {
                next(error);
            }
        },

        async checkQuietHours(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const isQuiet = await service.isQuietHours(userId);

                res.json({ data: { isQuietHours: isQuiet } });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { PreferenceService } from '../services/notifications/PreferenceService';

// Adapter for static method service
const preferenceServiceAdapter: IPreferenceService = {
    getPreferences: (userId) => PreferenceService.getPreferences(userId),
    updatePreferences: (userId, data) => PreferenceService.updatePreferences(userId, data),
    createDefaultPreferences: (userId) => PreferenceService.createDefaultPreferences(userId),
    isQuietHours: (userId) => PreferenceService.isQuietHours(userId)
};

const defaultController = createPreferencesController(preferenceServiceAdapter);

export const getPreferences = defaultController.getPreferences;
export const updatePreferences = defaultController.updatePreferences;
export const resetPreferences = defaultController.resetPreferences;
export const checkQuietHours = defaultController.checkQuietHours;

