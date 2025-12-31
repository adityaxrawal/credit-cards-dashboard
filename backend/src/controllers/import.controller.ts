import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { ImportService } from '../services/import/import.service';

const importService = new ImportService();

/**
 * Get user's import templates
 */
export async function getTemplates(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const templates = await importService.getTemplates(userId);
        res.json({ data: templates });
    } catch (error) {
        next(error);
    }
}

/**
 * Save import template
 */
export async function saveTemplate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const template = await importService.saveTemplate(userId, req.body);
        res.status(201).json({ data: template });
    } catch (error) {
        next(error);
    }
}

/**
 * Parse CSV and return preview
 */
export async function parseCSV(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { csvContent, hasHeader = true } = req.body;

        if (!csvContent) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'csvContent is required' }
            });
        }

        const result = importService.parseCSV(csvContent, hasHeader);
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Preview import with mapping
 */
export async function previewImport(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { rows, mapping } = req.body;

        if (!rows || !mapping) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'rows and mapping are required' }
            });
        }

        const result = importService.previewImport(rows, mapping);
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Execute import
 */
export async function executeImport(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { instrumentId, transactions, skipDuplicates = true } = req.body;

        if (!instrumentId || !transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'instrumentId and transactions are required' }
            });
        }

        const result = await importService.executeImport(userId, instrumentId, transactions, { skipDuplicates });
        res.status(201).json({ data: result });
    } catch (error) {
        next(error);
    }
}

/**
 * Get import history
 */
export async function getImportHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 20;
        const history = await importService.getImportHistory(userId, limit);
        res.json({ data: history });
    } catch (error) {
        next(error);
    }
}
