import { AuthRequest } from '../types/auth.types';
import { Response, NextFunction } from 'express';
import logger from '../utils/infrastructure/logger';
import { extractionService } from '../services/extraction/ExtractionService';

/**
 * Endpoint 1: POST /api/extraction/process-csv
 */
export async function processCsv(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { csvRows } = req.body;
        const userId = req.user.id;

        // Delegate to service
        const result = await extractionService.processCsv(userId, csvRows);

        res.json(result);

    } catch (error) {
        logger.error('Extraction error:', error);
        next(error);
    }
}
