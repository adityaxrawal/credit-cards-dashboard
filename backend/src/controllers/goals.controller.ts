/**
 * Goals Controller
 * 
 * Handles savings goal management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

/**
 * Goals Service Interface
 */
export interface IGoalsService {
    getAll(userId: string, filters: { status?: string; type?: string }): Promise<any[]>;
    getById(userId: string, id: string): Promise<any>;
    create(userId: string, data: any): Promise<any>;
    update(userId: string, id: string, data: any): Promise<any>;
    delete(userId: string, id: string): Promise<void>;
    addContribution(userId: string, id: string, data: any): Promise<any>;
    getContributions(userId: string, id: string): Promise<any[]>;
    getProgress(userId: string, id: string): Promise<any>;
    getSummary(userId: string): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IGoalsController {
    getAllGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGoalById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addContribution(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getContributions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGoalProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getGoalsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Goals controller with injected dependencies
 */
export function createGoalsController(goalsService: IGoalsService): IGoalsController {
    return {
        async getAllGoals(req, res, next) {
            try {
                const { status, type } = req.query;
                const goals = await goalsService.getAll(req.user.id, { status: status as string, type: type as string });
                res.json({ data: goals });
            } catch (error) { next(error); }
        },

        async getGoalById(req, res, next) {
            try {
                const goal = await goalsService.getById(req.user.id, req.params.id);
                if (!goal) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } }) as any;
                res.json({ data: goal });
            } catch (error) { next(error); }
        },

        async createGoal(req, res, next) {
            try {
                const goal = await goalsService.create(req.user.id, req.body);
                res.status(201).json({ data: goal });
            } catch (error) { next(error); }
        },

        async updateGoal(req, res, next) {
            try {
                const goal = await goalsService.update(req.user.id, req.params.id, req.body);
                if (!goal) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } }) as any;
                res.json({ data: goal });
            } catch (error) { next(error); }
        },

        async deleteGoal(req, res, next) {
            try {
                await goalsService.delete(req.user.id, req.params.id);
                res.json({ message: 'Goal deleted successfully' });
            } catch (error) { next(error); }
        },

        async addContribution(req, res, next) {
            try {
                const contribution = await goalsService.addContribution(req.user.id, req.params.id, req.body);
                res.status(201).json({ data: contribution });
            } catch (error) { next(error); }
        },

        async getContributions(req, res, next) {
            try {
                const contributions = await goalsService.getContributions(req.user.id, req.params.id);
                res.json({ data: contributions });
            } catch (error) { next(error); }
        },

        async getGoalProgress(req, res, next) {
            try {
                const progress = await goalsService.getProgress(req.user.id, req.params.id);
                res.json({ data: progress });
            } catch (error) { next(error); }
        },

        async getGoalsSummary(req, res, next) {
            try {
                const summary = await goalsService.getSummary(req.user.id);
                res.json({ data: summary });
            } catch (error) { next(error); }
        },
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { GoalsService } from '../services/goals/goals.service';

const goalsService = new GoalsService();
const defaultController = createGoalsController(goalsService as IGoalsService);

export const getAllGoals = defaultController.getAllGoals;
export const getGoalById = defaultController.getGoalById;
export const createGoal = defaultController.createGoal;
export const updateGoal = defaultController.updateGoal;
export const deleteGoal = defaultController.deleteGoal;
export const addContribution = defaultController.addContribution;
export const getContributions = defaultController.getContributions;
export const getGoalProgress = defaultController.getGoalProgress;
export const getGoalsSummary = defaultController.getGoalsSummary;
