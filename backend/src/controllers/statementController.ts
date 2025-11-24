import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';
// import multer from 'multer'; // Assuming multer is configured in middleware or route

// Mock upload for now as we don't have S3/GCS setup in plan details, 
// but we will store file path in DB.
// In a real app, we would use multer-s3 or similar.

export const uploadStatement = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { card_id, statement_month, statement_year } = req.body;

    // Optional: Validate card_id, month, year if needed
    // For now, we allow nulls as per schema or default to current date if not provided? 
    // Schema says statement_month/year are nullable.

    const result = await pool.query(
      `INSERT INTO statement_uploads (
        user_id, card_id, file_name, file_path, file_size, file_type, statement_month, statement_year, 
        processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [
        req.user.id, 
        card_id || null, 
        req.file.originalname, 
        req.file.path, 
        req.file.size,
        req.file.mimetype,
        statement_month || null, 
        statement_year || null
      ]
    );

    // Trigger background processing (mock)
    // In real world: await queue.add('process-statement', { id: result.rows[0].id });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const getStatements = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.card_name 
       FROM statement_uploads s
       LEFT JOIN credit_cards c ON s.card_id = c.id
       WHERE s.user_id = $1 ORDER BY s.uploaded_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getStatement = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM statement_uploads WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
