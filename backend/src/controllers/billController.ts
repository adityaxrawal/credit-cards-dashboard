import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';

const billSchema = z.object({
  card_id: z.string().uuid(),
  bill_month: z.number().min(1).max(12),
  bill_year: z.number().min(2000),
  bill_amount: z.number().positive(),
  bill_date: z.string(), // ISO date
  due_date: z.string(), // ISO date
  notes: z.string().optional()
});

export const getBills = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT b.*, c.card_name, c.bank_name 
      FROM bill_payments b
      JOIN credit_cards c ON b.card_id = c.id
      WHERE c.user_id = $1
    `;
    const params: any[] = [req.user.id];

    if (status) {
      query += ` AND b.payment_status = $2`;
      params.push(status);
    }

    query += ` ORDER BY b.due_date ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const payBill = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { payment_amount, payment_date, payment_method, transaction_reference } = req.body;

    if (!payment_amount || !payment_date) {
      return res.status(400).json({ error: 'Payment amount and date are required' });
    }

    const result = await pool.query(
      `UPDATE bill_payments 
       SET payment_amount = $1, payment_date = $2, payment_method = $3, 
           transaction_reference = $4, payment_status = 'paid', updated_at = NOW()
       WHERE id = $5 AND card_id IN (SELECT id FROM credit_cards WHERE user_id = $6)
       RETURNING *`,
      [payment_amount, payment_date, payment_method, transaction_reference, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const generateBill = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = billSchema.parse(req.body);
    
    // Verify card belongs to user
    const cardCheck = await pool.query('SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2', [data.card_id, req.user.id]);
    if (cardCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const result = await pool.query(
      `INSERT INTO bill_payments (
        card_id, bill_month, bill_year, bill_amount, bill_date, due_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.card_id, data.bill_month, data.bill_year, data.bill_amount, 
        data.bill_date, data.due_date, data.notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// --- New Features for Phase 1 ---

export const getBillCalendar = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;

    // Fetch from bill_payments (Credit Card Bills)
    const billsQuery = `
      SELECT b.id, c.card_name as title, b.bill_amount as amount, b.due_date as eventDate, 
             'bill' as eventType, 'pending' as status, '#EF4444' as color
      FROM bill_payments b
      JOIN credit_cards c ON b.card_id = c.id
      WHERE c.user_id = $1 AND b.due_date BETWEEN $2 AND $3
    `;

    // Fetch from bill_reminders (Manual Reminders)
    const remindersQuery = `
      SELECT id, title, amount, due_date as eventDate, 
             'reminder' as eventType, status, '#F59E0B' as color
      FROM bill_reminders
      WHERE user_id = $1 AND due_date BETWEEN $2 AND $3
    `;

    const [billsRes, remindersRes] = await Promise.all([
      pool.query(billsQuery, [userId, startDate, endDate]),
      pool.query(remindersQuery, [userId, startDate, endDate])
    ]);

    const events = [...billsRes.rows, ...remindersRes.rows].map(event => ({
      ...event,
      description: event.eventType === 'bill' ? 'Credit Card Bill' : 'Manual Reminder'
    }));

    res.json(events);
  } catch (error) {
    next(error);
  }
};

export const getReminders = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bill_reminders WHERE user_id = $1 ORDER BY due_date ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createReminder = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { title, description, amount, dueDate, isRecurring, recurrencePattern } = req.body;
    
    const result = await pool.query(
      `INSERT INTO bill_reminders (
        user_id, title, description, amount, due_date, is_recurring, recurrence_pattern
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, title, description, amount, dueDate, isRecurring, recurrencePattern]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const markReminderPaid = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE bill_reminders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const getRecurringTemplates = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Mock implementation: In real app, this would query a templates table or infer from history
    // For now, return active recurring reminders
    const result = await pool.query(
      "SELECT * FROM bill_reminders WHERE user_id = $1 AND is_recurring = true",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const detectRecurringBills = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Logic:
    // 1. Group by merchant and amount (rounded to nearest integer to account for small variations)
    // 2. Count occurrences in the last 6 months
    // 3. Filter for at least 3 occurrences
    // 4. Calculate average interval (days) between transactions
    
    const result = await pool.query(`
      WITH TransactionIntervals AS (
        SELECT 
          merchant, 
          amount,
          transaction_date,
          LAG(transaction_date) OVER (PARTITION BY merchant ORDER BY transaction_date) as prev_date
        FROM transactions
        WHERE user_id = $1 
          AND transaction_date > NOW() - INTERVAL '6 months'
          AND transaction_type = 'debit'
      )
      SELECT 
        merchant, 
        ROUND(AVG(amount), 2) as typical_amount, 
        COUNT(*) as count,
        ROUND(AVG(EXTRACT(DAY FROM (transaction_date - prev_date)))) as avg_interval_days
      FROM TransactionIntervals
      WHERE prev_date IS NOT NULL
      GROUP BY merchant
      HAVING COUNT(*) >= 2 
         AND AVG(EXTRACT(DAY FROM (transaction_date - prev_date))) BETWEEN 25 AND 35
    `, [req.user.id]);
    
    // Format candidates
    const candidates = result.rows.map(row => ({
      merchant: row.merchant,
      amount: Number(row.typical_amount),
      frequency: 'monthly',
      confidence: row.count >= 4 ? 'high' : 'medium'
    }));
    
    res.json({ detectedCount: candidates.length, candidates });
  } catch (error) {
    next(error);
  }
};
