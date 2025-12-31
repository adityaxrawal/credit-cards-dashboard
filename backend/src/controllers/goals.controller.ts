import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { GoalsService } from '../services/goals/goals.service';

const goalsService = new GoalsService();

/**
 * Get all goals for user
 */
export async function getAllGoals(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { status, type } = req.query;
        const goals = await goalsService.getAll(userId, {
            status: status as string,
            type: type as string,
        });
        res.json({ data: goals });
    } catch (error) {
        next(error);
    }
}

/**
 * Get goal by ID
 */
export async function getGoalById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const goal = await goalsService.getById(userId, id);
        if (!goal) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        }
        res.json({ data: goal });
    } catch (error) {
        next(error);
    }
}

/**
 * Create new goal
 */
export async function createGoal(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const goal = await goalsService.create(userId, req.body);
        res.status(201).json({ data: goal });
    } catch (error) {
        next(error);
    }
}

/**
 * Update goal
 */
export async function updateGoal(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const goal = await goalsService.update(userId, id, req.body);
        if (!goal) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        }
        res.json({ data: goal });
    } catch (error) {
        next(error);
    }
}

/**
 * Delete goal
 */
export async function deleteGoal(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await goalsService.delete(userId, id);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        next(error);
    }
}

/**
 * Add contribution to goal
 */
export async function addContribution(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const contribution = await goalsService.addContribution(userId, id, req.body);
        res.status(201).json({ data: contribution });
    } catch (error) {
        next(error);
    }
}

/**
 * Get contribution history
 */
export async function getContributions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const contributions = await goalsService.getContributions(userId, id);
        res.json({ data: contributions });
    } catch (error) {
        next(error);
    }
}

/**
 * Get goal progress stats
 */
export async function getGoalProgress(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const progress = await goalsService.getProgress(userId, id);
        res.json({ data: progress });
    } catch (error) {
        next(error);
    }
}

/**
 * Get goals summary
 */
export async function getGoalsSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const summary = await goalsService.getSummary(userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
}
