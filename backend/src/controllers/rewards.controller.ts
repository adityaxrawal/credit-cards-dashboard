import { Request, Response, NextFunction } from 'express';
import * as rewardsService from '../services/rewards.service';

/**
 * Get all rewards for the authenticated user
 */
export async function getAllRewards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const rewards = await rewardsService.getAllRewards(userId);
    
    res.json({ data: rewards });
  } catch (error) {
    next(error);
  }
}

/**
 * Get rewards summary for the authenticated user
 */
export async function getRewardsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const summary = await rewardsService.getRewardsSummary(userId);
    
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}

/**
 * Get rewards for a specific card
 */
export async function getCardRewards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId } = req.params;
    
    const rewards = await rewardsService.getCardRewards(userId, cardId);
    
    res.json({ data: rewards });
  } catch (error) {
    next(error);
  }
}

/**
 * Get reward transactions for a specific card
 */
export async function getRewardTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId } = req.params;
    
    const transactions = await rewardsService.getRewardTransactions(userId, cardId);
    
    res.json({ data: transactions });
  } catch (error) {
    next(error);
  }
}

/**
 * Update reward points for a card
 */
export async function upsertRewardPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId, pointsEarned, pointsRedeemed, pointsBalance, pointsExpiringSoon, nextExpiryDate } = req.body;
    
    // Validation
    if (!cardId || pointsEarned === undefined || pointsRedeemed === undefined || pointsBalance === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }
    
    const rewards = await rewardsService.upsertRewardPoints({
      cardId,
      pointsEarned,
      pointsRedeemed,
      pointsBalance,
      pointsExpiringSoon,
      nextExpiryDate: nextExpiryDate ? new Date(nextExpiryDate) : undefined,
    });
    
    res.json({ data: rewards });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a reward transaction
 */
export async function createRewardTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const { cardId, transactionId, pointsChange, description, expiryDate } = req.body;
    
    // Validation
    if (!cardId || pointsChange === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }
    
    const transaction = await rewardsService.createRewardTransaction({
      cardId,
      transactionId,
      pointsChange,
      description,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    });
    
    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
}
