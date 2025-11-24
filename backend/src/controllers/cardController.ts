import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';

const cardSchema = z.object({
  card_name: z.string().min(1),
  bank_name: z.string().optional(),
  card_number_last4: z.string().length(4).optional(),
  bill_date: z.number().min(1).max(31),
  due_date: z.number().min(1).max(31),
  credit_limit: z.number().positive().optional(),
  current_balance: z.number().default(0),
  card_activation_date: z.string().optional(), // ISO date string
  notes: z.string().optional()
});

export const getCards = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createCard = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = cardSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO credit_cards (
        user_id, card_name, bank_name, card_number_last4, bill_date, due_date, 
        credit_limit, current_balance, card_activation_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.id, data.card_name, data.bank_name, data.card_number_last4,
        data.bill_date, data.due_date, data.credit_limit, data.current_balance,
        data.card_activation_date, data.notes
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const getCard = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateCard = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = cardSchema.partial().parse(req.body);
    
    // Construct dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      return res.json({ message: 'No changes' });
    }

    values.push(id);
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE credit_cards SET ${fields.join(', ')}, updated_at = NOW() 
       WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteCard = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM credit_cards WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    next(error);
  }
};
