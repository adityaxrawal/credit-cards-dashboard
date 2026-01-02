import { Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';

export interface IRulesService {
    getSuggestions(userId: string): Promise<any>;
    getRules(userId: string): Promise<any>;
    createRule(userId: string, data: any): Promise<any>;
    updateRule(userId: string, ruleId: string, data: any): Promise<any>;
    deleteRule(userId: string, ruleId: string): Promise<boolean>;
}

export interface IRulesController {
    getSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getRules(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createRulesController(service: IRulesService): IRulesController {
    return {
        async getSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const suggestions = await service.getSuggestions(req.user.id);
                res.json({ data: suggestions });
            } catch (error) {
                next(error);
            }
        },

        async getRules(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const rules = await service.getRules(req.user.id);
                res.json({ data: rules });
            } catch (error) {
                next(error);
            }
        },

        async createRule(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const rule = await service.createRule(req.user.id, req.body);
                res.status(201).json({ data: rule });
            } catch (error) {
                next(error);
            }
        },

        async updateRule(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { id } = req.params;
                const rule = await service.updateRule(req.user.id, id, req.body);
                if (!rule) {
                    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } });
                    return;
                }
                res.json({ data: rule });
            } catch (error) {
                next(error);
            }
        },

        async deleteRule(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { id } = req.params;
                const success = await service.deleteRule(req.user.id, id);
                if (!success) {
                    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } });
                    return;
                }
                res.json({ message: 'Rule deleted successfully' });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { ruleService } from './rules.service';
import { ruleSuggestionService } from '@modules/transactions/services/rules/RuleSuggestionService';

// Adapter for multiple services
const rulesServiceAdapter: IRulesService = {
    getSuggestions: (userId) => ruleSuggestionService.generateSuggestions(userId),
    getRules: (userId) => ruleService.getRules(userId),
    createRule: (userId, data) => ruleService.createRule(userId, data),
    updateRule: (userId, id, data) => ruleService.updateRule(userId, id, data),
    deleteRule: (userId, id) => ruleService.deleteRule(userId, id)
};

const defaultController = createRulesController(rulesServiceAdapter);

export const getSuggestions = defaultController.getSuggestions;
export const getRules = defaultController.getRules;
export const createRule = defaultController.createRule;
export const updateRule = defaultController.updateRule;
export const deleteRule = defaultController.deleteRule;
