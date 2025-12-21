import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';
import * as alertsService from '../services/alerts/AlertsService';

/**
 * Get user alerts
 */
export async function getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unread === 'true';
    const type = req.query.type as string;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    const result = await alertsService.getUserAlerts(userId, {
      unreadOnly,
      type,
      page,
      limit,
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Mark alert as read
 */
export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const success = await alertsService.markAlertAsRead(userId, id);
    
    if (!success) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }
    
    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete alert
 */
export async function deleteAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const success = await alertsService.deleteAlert(userId, id);
    
    if (!success) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }
    
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    next(error);
  }
}
