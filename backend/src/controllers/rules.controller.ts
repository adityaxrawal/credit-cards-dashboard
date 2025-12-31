
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { ruleService } from '../services/rules/RuleService';
import { ruleSuggestionService } from '../services/transactions/rules/RuleSuggestionService';

export async function getSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const suggestions = await ruleSuggestionService.generateSuggestions(req.user.id);
        res.json({ data: suggestions });
    } catch (error) {
        next(error);
    }
}

export async function getRules(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const rules = await ruleService.getRules(req.user.id);
        res.json({ data: rules });
    } catch (error) {
        next(error);
    }
}

export async function createRule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const rule = await ruleService.createRule(req.user.id, req.body);
        res.status(201).json({ data: rule });
    } catch (error) {
        next(error);
    }
}

export async function updateRule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const rule = await ruleService.updateRule(req.user.id, id, req.body);
        if (!rule) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } });
        res.json({ data: rule });
    } catch (error) {
        next(error);
    }
}

export async function deleteRule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const success = await ruleService.deleteRule(req.user.id, id);
        if (!success) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } });
        res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
        next(error);
    }
}
