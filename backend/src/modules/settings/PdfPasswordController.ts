/**
 * PdfPasswordController - API endpoints for PDF password management
 */

import { Request, Response } from 'express';
import { PdfPasswordService, CreatePdfPasswordDto } from './PdfPasswordService';
import logger from '@shared/utils/infrastructure/logger';

let pdfPasswordService: PdfPasswordService;

function getPdfPasswordService() {
    if (!pdfPasswordService) {
        pdfPasswordService = new PdfPasswordService();
    }
    return pdfPasswordService;
}

export class PdfPasswordController {
    /**
     * List all PDF passwords for the user (masked values)
     * GET /api/settings/pdf-passwords
     */
    static async listPasswords(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const passwords = await getPdfPasswordService().listPasswords(userId);
            res.json({ data: passwords });
        } catch (error) {
            logger.error('[PdfPasswordController] Error listing passwords:', error);
            res.status(500).json({ error: 'Failed to list passwords' });
        }
    }

    /**
     * Add a new PDF password
     * POST /api/settings/pdf-passwords
     */
    static async addPassword(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { password_name, password_value, bank_hint, priority } = req.body;

            if (!password_name || !password_value) {
                return res.status(400).json({
                    error: 'password_name and password_value are required'
                });
            }

            const dto: CreatePdfPasswordDto = {
                password_name,
                password_value,
                bank_hint,
                priority: priority || 0
            };

            const result = await getPdfPasswordService().addPassword(userId, dto);
            res.status(201).json({ data: result });
        } catch (error: any) {
            logger.error('[PdfPasswordController] Error adding password:', error);

            // Handle duplicate name error
            if (error.code === '23505') {
                return res.status(409).json({
                    error: 'A password with this name already exists'
                });
            }

            res.status(500).json({ error: 'Failed to add password' });
        }
    }

    /**
     * Delete a PDF password
     * DELETE /api/settings/pdf-passwords/:id
     */
    static async deletePassword(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const passwordId = req.params.id;
            if (!passwordId) {
                return res.status(400).json({ error: 'Password ID is required' });
            }

            await getPdfPasswordService().deletePassword(userId, passwordId);
            res.json({ success: true });
        } catch (error) {
            logger.error('[PdfPasswordController] Error deleting password:', error);
            res.status(500).json({ error: 'Failed to delete password' });
        }
    }

    /**
     * Update password priority
     * PATCH /api/settings/pdf-passwords/:id
     */
    static async updatePassword(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const passwordId = req.params.id;
            const { priority } = req.body;

            if (priority === undefined) {
                return res.status(400).json({ error: 'priority is required' });
            }

            await getPdfPasswordService().updatePriority(userId, passwordId, priority);
            res.json({ success: true });
        } catch (error) {
            logger.error('[PdfPasswordController] Error updating password:', error);
            res.status(500).json({ error: 'Failed to update password' });
        }
    }
}
