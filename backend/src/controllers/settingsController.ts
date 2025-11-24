import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { z } from 'zod';

const settingsSchema = z.object({
  monthly_budget: z.number().optional(),
  alert_threshold: z.number().min(1).max(100).optional(),
  email_notifications: z.boolean().optional(),
  notification_preferences: z.object({
    bill_reminders: z.boolean().optional(),
    spending_alerts: z.boolean().optional(),
    weekly_summary: z.boolean().optional(),
  }).optional(),
});

export const getSettings = async (req: any, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT monthly_budget, alert_threshold, email_notifications, notification_preferences FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = settingsSchema.parse(req.body);
    const userId = req.user.id;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.monthly_budget !== undefined) {
      updates.push(`monthly_budget = $${idx}`);
      values.push(data.monthly_budget);
      idx++;
    }
    if (data.alert_threshold !== undefined) {
      updates.push(`alert_threshold = $${idx}`);
      values.push(data.alert_threshold);
      idx++;
    }
    if (data.email_notifications !== undefined) {
      updates.push(`email_notifications = $${idx}`);
      values.push(data.email_notifications);
      idx++;
    }
    if (data.notification_preferences !== undefined) {
      // Merge with existing preferences
      const currentRes = await pool.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
      const currentPrefs = currentRes.rows[0].notification_preferences || {};
      const newPrefs = { ...currentPrefs, ...data.notification_preferences };
      
      updates.push(`notification_preferences = $${idx}`);
      values.push(newPrefs);
      idx++;
    }

    if (updates.length === 0) {
      return res.json({ message: 'No changes' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
