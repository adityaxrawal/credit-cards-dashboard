import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';

export const getRewardsSummary = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.card_name, c.bank_name 
       FROM reward_points r
       JOIN credit_cards c ON r.card_id = c.id
       WHERE c.user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getCardRewardsHistory = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { cardId } = req.params;
    const result = await pool.query(
      `SELECT rt.*, t.merchant, t.transaction_date 
       FROM reward_transactions rt
       LEFT JOIN transactions t ON rt.transaction_id = t.id
       WHERE rt.card_id = $1 AND rt.card_id IN (SELECT id FROM credit_cards WHERE user_id = $2)
       ORDER BY rt.created_at DESC`,
      [cardId, req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const redeemPoints = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { card_id, points, description } = req.body;
    
    if (!card_id || !points) {
      return res.status(400).json({ error: 'Card ID and points are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check balance
      const balanceRes = await client.query(
        'SELECT points_balance FROM reward_points WHERE card_id = $1 AND card_id IN (SELECT id FROM credit_cards WHERE user_id = $2)',
        [card_id, req.user.id]
      );

      if (balanceRes.rows.length === 0) {
        throw new Error('Card rewards not found');
      }

      const currentBalance = balanceRes.rows[0].points_balance;
      if (currentBalance < points) {
        throw new Error('Insufficient points');
      }

      // Deduct points
      await client.query(
        'UPDATE reward_points SET points_balance = points_balance - $1, points_redeemed = points_redeemed + $1, last_updated = NOW() WHERE card_id = $2',
        [points, card_id]
      );

      // Log transaction
      const txnRes = await client.query(
        `INSERT INTO reward_transactions (card_id, points_change, description) 
         VALUES ($1, $2, $3) RETURNING *`,
        [card_id, -points, description || 'Redemption']
      );

      await client.query('COMMIT');
      res.json(txnRes.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.message === 'Insufficient points' || error.message === 'Card rewards not found') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};
