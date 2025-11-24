import { Request, Response, NextFunction } from 'express';
import pool from '../db';

export const getOverview = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // 1. Monthly Spending & Transactions
    const spendingRes = await pool.query(
      `SELECT SUM(amount) as total, COUNT(*) as count
       FROM transactions 
       WHERE user_id = $1 AND bill_month = $2 AND bill_year = $3 AND transaction_type = 'debit'`,
      [userId, currentMonth, currentYear]
    );
    const monthly_spending = Number(spendingRes.rows[0].total) || 0;
    const total_transactions = Number(spendingRes.rows[0].count) || 0;

    // 2. Budget Info
    const userRes = await pool.query('SELECT monthly_budget FROM users WHERE id = $1', [userId]);
    const monthly_budget = Number(userRes.rows[0].monthly_budget) || 0;
    
    // 3. Card Stats (Total Cards & Total Outstanding)
    const cardsRes = await pool.query(
      `SELECT COUNT(*) as count, SUM(current_balance) as outstanding, SUM(credit_limit) as total_limit 
       FROM credit_cards 
       WHERE user_id = $1 AND is_active = true`, 
      [userId]
    );
    const total_cards = Number(cardsRes.rows[0].count) || 0;
    const total_outstanding = Number(cardsRes.rows[0].outstanding) || 0;
    const total_limit = Number(cardsRes.rows[0].total_limit) || 0;

    // 4. Calculations
    const budget_utilization = monthly_budget > 0 ? (monthly_spending / monthly_budget) * 100 : 0;
    const budget_remaining = Math.max(0, monthly_budget - monthly_spending);
    const credit_utilization = total_limit > 0 ? (total_outstanding / total_limit) * 100 : 0;

    res.json({
      total_cards,
      monthly_spending,
      total_transactions,
      total_outstanding,
      credit_utilization,
      monthly_budget,
      budget_utilization,
      budget_remaining
    });
  } catch (error) {
    next(error);
  }
};

export const getSpendingTrends = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    // Last 6 months
    const result = await pool.query(
      `SELECT bill_month, bill_year, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = $1 AND transaction_type = 'debit' 
       GROUP BY bill_year, bill_month 
       ORDER BY bill_year DESC, bill_month DESC 
       LIMIT 6`,
      [userId]
    );
    res.json(result.rows.reverse());
  } catch (error) {
    next(error);
  }
};

export const getCategoryBreakdown = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    
    let query = `
      SELECT category, SUM(amount) as total 
      FROM transactions 
      WHERE user_id = $1 AND transaction_type = 'debit'
    `;
    const params: any[] = [userId];
    let idx = 2;

    if (month) {
      query += ` AND bill_month = $${idx}`;
      params.push(month);
      idx++;
    }
    if (year) {
      query += ` AND bill_year = $${idx}`;
      params.push(year);
      idx++;
    }

    query += ` GROUP BY category ORDER BY total DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
