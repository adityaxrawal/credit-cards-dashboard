import pool from '../../lib/db';

export class TerminatorService {
    /**
     * Terminate an email processing workflow.
     * Logs the termination reason and stage.
     */
    static async terminate(userId: string, emailId: string, reason: string, stage: 'filter' | 'rule' | 'gpt') {
        await pool.query(
            `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, reason, stage, created_at)
         VALUES ($1, $2, 'terminated', $3, $4, NOW())
         ON CONFLICT (email_message_id) DO UPDATE SET 
            processing_status = 'terminated',
            reason = EXCLUDED.reason,
            stage = EXCLUDED.stage,
            created_at = NOW()`,
            [userId, emailId, reason, stage]
        );
    }

    /**
     * Get termination report.
     */
    static async getReport(userId: string, from: Date, to: Date) {
        const { rows } = await pool.query(
            `SELECT * FROM email_processing_log 
           WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
           ORDER BY created_at DESC`,
            [userId, from, to]
        );
        return rows;
    }
}
