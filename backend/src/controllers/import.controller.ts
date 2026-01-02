import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

export interface IImportService {
    getTemplates(userId: string): Promise<any>;
    saveTemplate(userId: string, template: any): Promise<any>;
    parseCSV(content: string, hasHeader: boolean): any;
    previewImport(rows: any[], mapping: any): any;
    executeImport(userId: string, instrumentId: string, transactions: any[], options: any): Promise<any>;
    getImportHistory(userId: string, limit: number): Promise<any>;
}

export interface IImportController {
    getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    saveTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    parseCSV(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    previewImport(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    executeImport(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getImportHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createImportController(importService: IImportService): IImportController {
    return {
        async getTemplates(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const templates = await importService.getTemplates(userId);
                res.json({ data: templates });
            } catch (error) {
                next(error);
            }
        },

        async saveTemplate(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const template = await importService.saveTemplate(userId, req.body);
                res.status(201).json({ data: template });
            } catch (error) {
                next(error);
            }
        },

        async parseCSV(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { csvContent, hasHeader = true } = req.body;

                if (!csvContent) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'csvContent is required' }
                    });
                    return;
                }

                const result = importService.parseCSV(csvContent, hasHeader);
                res.json({ data: result });
            } catch (error) {
                next(error);
            }
        },

        async previewImport(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { rows, mapping } = req.body;

                if (!rows || !mapping) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'rows and mapping are required' }
                    });
                    return;
                }

                const result = importService.previewImport(rows, mapping);
                res.json({ data: result });
            } catch (error) {
                next(error);
            }
        },

        async executeImport(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { instrumentId, transactions, skipDuplicates = true } = req.body;

                if (!instrumentId || !transactions || !Array.isArray(transactions)) {
                    res.status(400).json({
                        error: { code: 'VALIDATION_ERROR', message: 'instrumentId and transactions are required' }
                    });
                    return;
                }

                const result = await importService.executeImport(userId, instrumentId, transactions, { skipDuplicates });
                res.status(201).json({ data: result });
            } catch (error) {
                next(error);
            }
        },

        async getImportHistory(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const limit = parseInt(req.query.limit as string) || 20;
                const history = await importService.getImportHistory(userId, limit);
                res.json({ data: history });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { ImportService } from '../services/import/import.service';
const defaultController = createImportController(new ImportService());

export const getTemplates = defaultController.getTemplates;
export const saveTemplate = defaultController.saveTemplate;
export const parseCSV = defaultController.parseCSV;
export const previewImport = defaultController.previewImport;
export const executeImport = defaultController.executeImport;
export const getImportHistory = defaultController.getImportHistory;

