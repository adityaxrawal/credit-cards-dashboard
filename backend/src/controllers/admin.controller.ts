import { Request, Response } from 'express';
import { query } from '../lib/db';

export const getReviewQueue = async (req: Request, res: Response) => {
    try {
        const { rows } = await query(`
      SELECT * FROM classification_review_queue
      WHERE status = 'pending'
      ORDER BY confidence ASC, created_at DESC
      LIMIT 100
    `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching review queue:', error);
        res.status(500).json({ error: 'Failed to fetch review queue' });
    }
};

export const reviewItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isCorrect, correctClassification } = req.body;
        // Assuming user is attached to req by auth middleware
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await query(`
      UPDATE classification_review_queue
      SET status = 'reviewed',
          reviewed_by = $2,
          reviewed_at = NOW(),
          correct_classification = $3
      WHERE id = $1
    `, [id, userId, correctClassification || null]);

        // TODO: If correction differs, we could trigger a retraining loop or update the transaction if already created.
        // For now, we just mark it as reviewed.

        res.json({ success: true });
    } catch (error) {
        console.error('Error reviewing item:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
};
