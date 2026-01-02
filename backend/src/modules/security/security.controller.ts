import { Response, NextFunction } from 'express';
import { AuthRequest } from '@shared/types/auth.types';

export interface ISecurityService {
    getActiveSessions(userId: string): Promise<any>;
    revokeSession(sessionId: string, userId: string): Promise<any>;
    revokeAllSessions(userId: string, currentSessionId: string): Promise<any>;
    exportAllUserData(userId: string): Promise<any>;
    deleteUserAccount(userId: string): Promise<any>;
}

export interface ISecurityController {
    getActiveSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    revokeSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    revokeOtherSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    exportUserData(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createSecurityController(service: ISecurityService): ISecurityController {
    return {
        async getActiveSessions(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const sessions = await service.getActiveSessions(req.user.id);
                res.json({ success: true, data: sessions });
            } catch (error) {
                next(error);
            }
        },

        async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { sessionId } = req.params;
                await service.revokeSession(sessionId, req.user.id);
                res.json({ success: true, message: 'Session revoked' });
            } catch (error) {
                next(error);
            }
        },

        async revokeOtherSessions(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const currentSessionId = (req as any).sessionId;
                if (currentSessionId) {
                    await service.revokeAllSessions(req.user.id, currentSessionId);
                    res.json({ success: true, message: 'All other sessions revoked' });
                } else {
                    res.status(400).json({ error: 'Current session ID unknown, cannot revoke others safely.' });
                }
            } catch (error) {
                next(error);
            }
        },

        async exportUserData(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const data = await service.exportAllUserData(req.user.id);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="data_export_${req.user.id}.json"`);
                res.send(JSON.stringify(data, null, 2));
            } catch (error) {
                next(error);
            }
        },

        async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                await service.deleteUserAccount(req.user.id);
                res.json({ success: true, message: 'Account deleted successfully' });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { SessionService } from '@modules/auth/services/session.service';
import { GdprService } from './gdpr.service';

// Adapter for multiple services
const securityServiceAdapter: ISecurityService = {
    getActiveSessions: (userId) => SessionService.getActiveSessions(userId),
    revokeSession: (sessionId, userId) => SessionService.revokeSession(sessionId, userId),
    revokeAllSessions: (userId, current) => SessionService.revokeAllSessions(userId, current),
    exportAllUserData: (userId) => GdprService.exportAllUserData(userId),
    deleteUserAccount: (userId) => GdprService.deleteUserAccount(userId)
};

const defaultController = createSecurityController(securityServiceAdapter);

export const getActiveSessions = defaultController.getActiveSessions;
export const revokeSession = defaultController.revokeSession;
export const revokeOtherSessions = defaultController.revokeOtherSessions;
export const exportUserData = defaultController.exportUserData;
export const deleteAccount = defaultController.deleteAccount;
