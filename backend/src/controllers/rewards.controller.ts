/**
 * Rewards Controller
 * 
 * Handles rewards and points management endpoints.
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth.types';

/**
 * Rewards Service Interface
 */
export interface IRewardsService {
  getAllRewards(userId: string): Promise<any>;
  getRewardsSummary(userId: string): Promise<any>;
  getCardRewards(userId: string, cardId: string): Promise<any>;
  getRewardTransactions(userId: string, cardId: string): Promise<any>;
  upsertRewardPoints(data: any): Promise<any>;
  createRewardTransaction(data: any): Promise<any>;
}

/**
 * Reward Calculation Service Interface
 */
export interface IRewardCalculationService {
  getRules(userId: string): Promise<any>;
  createRule(userId: string, data: any): Promise<any>;
  deleteRule(userId: string, ruleId: string): Promise<boolean>;
  toggleRule(userId: string, ruleId: string, isActive: boolean): Promise<any>;
}

/**
 * Controller Interface
 */
export interface IRewardsController {
  getAllRewards(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getRewardsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getCardRewards(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getRewardTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  upsertRewardPoints(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  createRewardTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  getRewardRules(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  createRewardRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  deleteRewardRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  toggleRewardRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Factory function to create Rewards controller with injected dependencies
 */
export function createRewardsController(
  rewardsService: IRewardsService,
  rewardCalculationService: IRewardCalculationService
): IRewardsController {
  const RuleSchema = z.object({
    ruleName: z.string().min(1, 'Rule name is required'),
    category: z.string().optional(),
    merchantPattern: z.string().optional(),
    cardId: z.string().uuid().optional(),
    rewardType: z.enum(['points', 'cashback', 'miles']),
    rate: z.number().positive('Rate must be positive'),
    rateType: z.enum(['percentage', 'fixed', 'multiplier']),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
    capPerTransaction: z.number().optional(),
    capPerMonth: z.number().optional(),
  });

  const TransactionSchema = z.object({
    cardId: z.string().uuid(),
    transactionId: z.string().optional(),
    pointsChange: z.number(),
    description: z.string().optional(),
    expiryDate: z.string().datetime().or(z.date()).optional()
  });

  return {
    async getAllRewards(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const rewards = await rewardsService.getAllRewards(req.user.id);
        res.json({ data: rewards });
      } catch (error) {
        next(error);
      }
    },

    async getRewardsSummary(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const summary = await rewardsService.getRewardsSummary(req.user.id);
        res.json({ data: summary });
      } catch (error) {
        next(error);
      }
    },

    async getCardRewards(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const rewards = await rewardsService.getCardRewards(req.user.id, req.params.cardId);
        res.json({ data: rewards });
      } catch (error) {
        next(error);
      }
    },

    async getRewardTransactions(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const transactions = await rewardsService.getRewardTransactions(req.user.id, req.params.cardId);
        res.json({ data: transactions });
      } catch (error) {
        next(error);
      }
    },

    async upsertRewardPoints(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { cardId, pointsEarned, pointsRedeemed, pointsBalance, pointsExpiringSoon, nextExpiryDate } = req.body;
        if (!cardId || pointsEarned === undefined || pointsRedeemed === undefined || pointsBalance === undefined) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }) as any;
        }
        const rewards = await rewardsService.upsertRewardPoints({
          cardId, pointsEarned, pointsRedeemed, pointsBalance, pointsExpiringSoon,
          nextExpiryDate: nextExpiryDate ? new Date(nextExpiryDate) : undefined
        });
        res.json({ data: rewards });
      } catch (error) {
        next(error);
      }
    },

    async createRewardTransaction(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const val = await TransactionSchema.parseAsync(req.body);
        const transaction = await rewardsService.createRewardTransaction({
          cardId: val.cardId,
          transactionId: val.transactionId,
          pointsChange: val.pointsChange,
          description: val.description,
          expiryDate: val.expiryDate ? new Date(val.expiryDate) : undefined,
        });
        res.status(201).json({ data: transaction });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } }) as any;
        }
        next(error);
      }
    },

    async getRewardRules(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const rules = await rewardCalculationService.getRules(req.user.id);
        res.json({ data: rules });
      } catch (error) {
        next(error);
      }
    },

    async createRewardRule(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const validated = await RuleSchema.parseAsync(req.body);
        const rule = await rewardCalculationService.createRule(req.user.id, validated);
        res.status(201).json({ data: rule });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid rule data', details: error.errors } }) as any;
        }
        next(error);
      }
    },

    async deleteRewardRule(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const deleted = await rewardCalculationService.deleteRule(req.user.id, req.params.ruleId);
        if (!deleted) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }) as any;
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async toggleRewardRule(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'isActive must be a boolean' } }) as any;
        }
        const rule = await rewardCalculationService.toggleRule(req.user.id, req.params.ruleId, isActive);
        if (!rule) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }) as any;
        }
        res.json({ data: rule });
      } catch (error) {
        next(error);
      }
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as rewardsService from '../services/analytics/RewardsService';
import { RewardCalculationService } from '../services/rewards/RewardCalculationService';

// Adapt static service to interface
const rewardCalcAdapter: IRewardCalculationService = {
  getRules: (userId) => RewardCalculationService.getRules(userId),
  createRule: (userId, data) => RewardCalculationService.createRule(userId, data),
  deleteRule: (userId, ruleId) => RewardCalculationService.deleteRule(userId, ruleId),
  toggleRule: (userId, ruleId, isActive) => RewardCalculationService.toggleRule(userId, ruleId, isActive),
};

const defaultController = createRewardsController(rewardsService as IRewardsService, rewardCalcAdapter);

export const getAllRewards = defaultController.getAllRewards;
export const getRewardsSummary = defaultController.getRewardsSummary;
export const getCardRewards = defaultController.getCardRewards;
export const getRewardTransactions = defaultController.getRewardTransactions;
export const upsertRewardPoints = defaultController.upsertRewardPoints;
export const createRewardTransaction = defaultController.createRewardTransaction;
export const getRewardRules = defaultController.getRewardRules;
export const createRewardRule = defaultController.createRewardRule;
export const deleteRewardRule = defaultController.deleteRewardRule;
export const toggleRewardRule = defaultController.toggleRewardRule;
