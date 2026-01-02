import { AuthRequest } from '../types/auth.types';
import { Response, NextFunction } from 'express';
import logger from '../utils/infrastructure/logger';

export interface IExtractionService {
    processCsv(userId: string, rows: any[]): Promise<any>;
}

export interface IExtractionController {
    processCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createExtractionController(extractionService: IExtractionService): IExtractionController {
    return {
        async processCsv(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { csvText } = req.body;
                const userId = req.user.id;

                if (!csvText) {
                    res.status(400).json({ error: 'csvText is required' });
                    return;
                }

                // Robust CSV Parser
                const parseCSV = (text: string) => {
                    const lines: string[][] = [];
                    let currentRow: string[] = [];
                    let currentField = '';
                    let inQuotes = false;

                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const nextChar = text[i + 1];

                        if (inQuotes) {
                            if (char === '"' && nextChar === '"') {
                                currentField += '"';
                                i++; // Skip next quote
                            } else if (char === '"') {
                                inQuotes = false;
                            } else {
                                currentField += char;
                            }
                        } else {
                            if (char === '"') {
                                inQuotes = true;
                            } else if (char === ',') {
                                currentRow.push(currentField.trim());
                                currentField = '';
                            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                                currentRow.push(currentField.trim());
                                lines.push(currentRow);
                                currentRow = [];
                                currentField = '';
                                if (char === '\r') i++; // Skip \n
                            } else if (char !== '\r') {
                                currentField += char;
                            }
                        }
                    }
                    if (currentField || currentRow.length > 0) {
                        currentRow.push(currentField.trim());
                        lines.push(currentRow);
                    }
                    return lines;
                };

                const rows = parseCSV(csvText);
                if (rows.length < 2) {
                    res.status(400).json({ error: 'CSV must contain header and at least one row' });
                    return;
                }

                const headers = rows[0].map(h => h.toLowerCase());
                const dataRows = rows.slice(1).map(row => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        obj[h] = row[i];
                    });
                    // Normalize common fields for ExtractionService
                    return {
                        ...obj,
                        // Map common column names to what ExtractionService expects
                        subject: obj.description || obj.narrative || obj.details || obj.merchant || '',
                        amount: obj.amount || obj.debit || obj.credit || '0',
                        date: obj.date || obj.timestamp || obj.txn_date || '',
                        sender: obj.merchant || obj.description || 'CSV Import'
                    };
                });

                // Delegate to service
                const result = await extractionService.processCsv(userId, dataRows);

                res.json(result);

            } catch (error) {
                logger.error('Extraction error:', error);
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { extractionService } from '../services/extraction/ExtractionService';
const defaultController = createExtractionController(extractionService);

export const processCsv = defaultController.processCsv;

