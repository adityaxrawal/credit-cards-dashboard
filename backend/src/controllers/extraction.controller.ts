import { Request, Response, NextFunction } from 'express';
import pool from '../lib/db';
import { TransactionExtractor } from '../services/extraction/transaction.extractor';
import { createTransactionsBulk, createTransaction } from '../db/queries/transactions.queries';

/**
 * Endpoint 1: POST /api/extraction/process-csv
 */
export async function processCsv(req: Request, res: Response, next: NextFunction) {
    try {
        const { csvRows } = req.body;
        const userId = (req as any).user.id;

        // Validate input
        if (!Array.isArray(csvRows) || csvRows.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty csvRows' });
        }

        // Process directly here using TransactionExtractor
        const result = {
            autoSave: [] as any[],
            needsReview: [] as any[],
            terminated: [] as any[],
            stats: { total: csvRows.length, saved: 0, review: 0, terminated: 0 }
        };

        for (const row of csvRows) {
            try {
                // Normalize typical input formats
                const subject = row.subject || '';
                const sender = row.sender || row.from || '';
                const snippet = row.snippet || '';
                const messageId = row.message_id || row.id || `temp_${Date.now()}_${Math.random()}`;
                const internalDate = row.internal_date ? parseInt(row.internal_date) : Date.now();
                const fullContent = row.cleaned_text || row.bodyText || row.body || '';

                // Construct mock email for Extractor
                const mockEmail = {
                    id: messageId,
                    subject,
                    from: sender,
                    cleanedBody: fullContent || snippet,
                    date: new Date(internalDate),
                    raw: { snippet }
                };

                const extracted = await TransactionExtractor.extract(mockEmail);

                if (extracted) {
                    // Map to output format expected by frontend/logic
                    const txn = {
                        userId,
                        cardId: row.cardLast4 || extracted.lastFourDigits, // CSV might have card hint
                        transactionDate: extracted.transactionDate,
                        merchant: extracted.merchant,
                        category: extracted.category || 'Uncategorized',
                        amount: extracted.amount,
                        transactionType: extracted.transactionType,
                        txnFingerprint: `csv-${messageId}`, // Simple fingerprint
                        emailMessageId: extracted.emailMessageId,
                        confidence: extracted.confidenceScore,
                        detectionMethod: 'rule_based',
                        needsReview: false,
                        // Add extra fields if needed by UI
                        cardLast4Digit: extracted.lastFourDigits,
                        bank: extracted.bankName
                    };

                    result.autoSave.push(txn);
                } else {
                    // Not found
                    result.terminated.push({
                        emailId: messageId,
                        reason: 'No transaction detected (Rule-based)'
                    });
                }

            } catch (error) {
                result.terminated.push({
                    emailId: row.message_id || 'unknown',
                    reason: `Error: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }

        result.stats.saved = result.autoSave.length;
        result.stats.terminated = result.terminated.length;

        // Save auto-approved
        if (result.autoSave.length > 0) {
            // Map ExtractedTransaction to DB schema
            const txnsToSave = result.autoSave.map((t) => ({
                userId: t.userId,
                cardId: t.cardLast4Digit === '0000' ? '' : t.cardLast4Digit,
                transactionDate: t.transactionDate,
                merchant: t.merchant,
                category: t.category,
                amount: t.amount,
                transactionType: 'debit',
                txnFingerprint: t.txnFingerprint,
                emailMessageId: t.emailMessageId,
                confidence: t.confidence,
                detectionMethod: t.detectionMethod,
                needsReview: false
            }));

            // TODO: Improve Card ID mapping. For now relying on a known card or failure if card_id is rigid.
            const cardsRes = await pool.query('SELECT id, card_number_last4 FROM credit_cards WHERE user_id = $1', [userId]);
            const cards = cardsRes.rows;

            const txnsWithCard = txnsToSave.map(t => {
                // Try to find matching card, fallback to first, fallback to null/error
                const match = cards.find(c => c.card_number_last4 === t.cardId); // t.cardId is last4 here
                return {
                    ...t,
                    cardId: match ? match.id : (cards[0]?.id || null) // Fallback to first card or null
                };
            }).filter(t => t.cardId !== null) as any[]; // Filter out if no card found (schema constraint)

            if (txnsWithCard.length > 0) {
                await createTransactionsBulk(txnsWithCard);
            }
        }

        // Removed "needsReview" queue logic for CSV upload for simplicity unless strictly required, 
        // as TransactionExtractor only returns high confidence or null. 
        // If we want review logic, we'd need to lower threshold in Extractor or handle "partial" matches.

        // Log job
        await pool.query(
            `INSERT INTO extraction_logs 
      (user_id, job_id, total_processed, auto_saved, needs_review, terminated, status, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
                userId,
                `job_${Date.now()}`,
                result.stats.total,
                result.stats.saved,
                result.stats.review,
                result.stats.terminated,
                'completed'
            ]
        );

        res.json({
            success: true,
            stats: result.stats,
            saved: result.autoSave.length,
            queued: result.needsReview.length,
            terminated: result.terminated.length,
        });

    } catch (error) {
        console.error('Extraction error:', error);
        next(error);
    }
}

/**
 * Endpoint 2: GET /api/extraction/review-queue
 */
export async function getReviewQueue(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).user.id;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        const { rows } = await pool.query(
            `SELECT * FROM gpt_processing_queue 
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({ items: rows });
    } catch (error) {
        next(error);
    }
}

/**
 * Endpoint 3: POST /api/extraction/review/:id/approve
 */
export async function approveReviewItem(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const { approved, amount, merchant, category, cardId } = req.body;

        // 1. Get item
        const { rows } = await pool.query(
            'SELECT * FROM gpt_processing_queue WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const item = rows[0];

        if (!approved) {
            // Reject
            await pool.query(
                'UPDATE gpt_processing_queue SET status = $1, processed_at = NOW() WHERE id = $2',
                ['rejected', id]
            );
            return res.json({ success: true, status: 'rejected' });
        }

        // Approve
        const data = item.transaction_data;
        const txnData = {
            userId,
            amount: amount || data.amount,
            merchant: merchant || data.merchant,
            category: category || 'Uncategorized',
            transactionDate: new Date(data.date),
            cardId: cardId, // Must be provided or implied?
            // Need cardId. If not in body, try to find by last4 or default
            transactionType: 'debit',
            emailMessageId: item.message_id,
            description: 'Approved from review queue',
            isManuallyAdded: true
        };

        // Fallback card ID logic
        if (!txnData.cardId) {
            const cardsRes = await pool.query('SELECT id, card_number_last4 FROM credit_cards WHERE user_id = $1', [userId]);
            const cards = cardsRes.rows;
            // Logic to match last4 from data
            const match = cards.find(c => c.card_number_last4 === data.cardLast4);
            txnData.cardId = match ? match.id : cards[0]?.id;
        }

        if (!txnData.cardId) {
            return res.status(400).json({ error: 'No credit card found for user to link transaction' });
        }

        const savedTxn = await createTransaction(txnData as any);

        // Update queue
        await pool.query(
            'UPDATE gpt_processing_queue SET status = $1, processed_at = NOW() WHERE id = $2',
            ['approved', id]
        );

        res.json({ success: true, transaction: savedTxn });

    } catch (error) {
        next(error);
    }
}
