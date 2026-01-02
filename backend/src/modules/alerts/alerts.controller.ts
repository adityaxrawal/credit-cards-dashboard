import { AuthRequest } from '@shared/types/auth.types';
import { Request, Response, NextFunction } from 'express';

export interface IAlertsService {
  getUserAlerts(userId: string, options: any): Promise<any>;
  markAlertAsRead(userId: string, alertId: string): Promise<boolean>;
  deleteAlert(userId: string, alertId: string): Promise<boolean>;
}

export interface IAlertsController {
  getAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
  deleteAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createAlertsController(alertsService: IAlertsService): IAlertsController {
  return {
    async getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
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
    },

    async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const success = await alertsService.markAlertAsRead(userId, id);

        if (!success) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
          return;
        }

        res.json({ message: 'Alert marked as read' });
      } catch (error) {
        next(error);
      }
    },

    async deleteAlert(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const success = await alertsService.deleteAlert(userId, id);

        if (!success) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
          return;
        }

        res.json({ message: 'Alert deleted successfully' });
      } catch (error) {
        next(error);
      }
    }
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import * as alertsServiceImpl from './alerts.service';

const defaultController = createAlertsController(alertsServiceImpl);

export const getAlerts = defaultController.getAlerts;
export const markAsRead = defaultController.markAsRead;
export const deleteAlert = defaultController.deleteAlert;

