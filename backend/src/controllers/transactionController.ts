import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';

const transactionSchema = z.object({
  card_id: z.string().uuid(),
  transaction_date: z.string(), // ISO date
  merchant: z.string().min(1),
  category: z.string().optional(),
  amount: z.number(),
  transaction_type: z.enum(['debit', 'credit', 'refund']).default('debit'),
  description: z.string().optional(),
  bill_month: z.number().optional(),
  bill_year: z.number().optional(),
  is_settled: z.boolean().default(true),
  is_manually_added: z.boolean().default(true),
  metadata: z.any().optional()
});

export const getTransactions = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      card_id, 
      month, 
      year, 
      category, 
      search 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const params: any[] = [req.user.id];
    let query = `
      SELECT t.*, c.card_name, c.bank_name 
      FROM transactions t
      JOIN credit_cards c ON t.card_id = c.id
      WHERE t.user_id = $1
    `;
    let countQuery = `SELECT COUNT(*) FROM transactions t WHERE t.user_id = $1`;

    let idx = 2;

    if (card_id) {
      query += ` AND t.card_id = $${idx}`;
      countQuery += ` AND t.card_id = $${idx}`;
      params.push(card_id);
      idx++;
    }

    if (month) {
      query += ` AND t.bill_month = $${idx}`;
      countQuery += ` AND t.bill_month = $${idx}`;
      params.push(month);
      idx++;
    }

    if (year) {
      query += ` AND t.bill_year = $${idx}`;
      countQuery += ` AND t.bill_year = $${idx}`;
      params.push(year);
      idx++;
    }

    if (category) {
      query += ` AND t.category = $${idx}`;
      countQuery += ` AND t.category = $${idx}`;
      params.push(category);
      idx++;
    }

    if (search) {
      query += ` AND (t.merchant ILIKE $${idx} OR t.description ILIKE $${idx})`;
      countQuery += ` AND (t.merchant ILIKE $${idx} OR t.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY t.transaction_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, idx - 1));

    res.json({
      data: result.rows,
      pagination: {
        total: Number(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = transactionSchema.parse(req.body);
    
    // Auto-calculate bill cycle if not provided
    let { bill_month, bill_year } = data;
    if (!bill_month || !bill_year) {
      const cardResult = await pool.query('SELECT bill_date FROM credit_cards WHERE id = $1', [data.card_id]);
      if (cardResult.rows.length > 0) {
        const billDate = cardResult.rows[0].bill_date;
        const txnDate = new Date(data.transaction_date);
        // Simple logic: if txn date day > bill date, it belongs to next month's cycle
        // This is a simplification, real logic depends on bank
        if (txnDate.getDate() > billDate) {
          txnDate.setMonth(txnDate.getMonth() + 1);
        }
        bill_month = txnDate.getMonth() + 1;
        bill_year = txnDate.getFullYear();
      }
    }

    const result = await pool.query(
      `INSERT INTO transactions (
        user_id, card_id, transaction_date, merchant, category, amount, 
        transaction_type, description, bill_month, bill_year, is_settled, 
        is_manually_added, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        req.user.id, data.card_id, data.transaction_date, data.merchant, 
        data.category, data.amount, data.transaction_type, data.description,
        bill_month, bill_year, data.is_settled, data.is_manually_added, data.metadata
      ]
    );

    // Update card balance
    if (data.transaction_type === 'debit') {
      await pool.query(
        'UPDATE credit_cards SET current_balance = current_balance + $1 WHERE id = $2',
        [data.amount, data.card_id]
      );
    } else {
      await pool.query(
        'UPDATE credit_cards SET current_balance = current_balance - $1 WHERE id = $2',
        [data.amount, data.card_id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const bulkImportTransactions = async (req: any, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { transactions } = req.body; // Array of transaction objects
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Invalid input: transactions must be an array' });
    }

    await client.query('BEGIN');
    const inserted = [];

    for (const txn of transactions) {
      // Basic validation
      if (!txn.card_id || !txn.amount || !txn.transaction_date) continue;

      const result = await client.query(
        `INSERT INTO transactions (
          user_id, card_id, transaction_date, merchant, category, amount, 
          transaction_type, description, bill_month, bill_year, is_settled, 
          is_manually_added
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          req.user.id, txn.card_id, txn.transaction_date, txn.merchant, 
          txn.category, txn.amount, txn.transaction_type || 'debit', 
          txn.description, txn.bill_month, txn.bill_year, 
          txn.is_settled ?? true, true
        ]
      );
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Bulk import successful', count: inserted.length });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
