import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
import dayjs from 'dayjs';

/**
 * PostProcessingService - Runs after Gmail sync to compute derived data
 * - Generates bills from transaction aggregates
 * - Identifies potential new cards from unmatched transactions
 */
export class PostProcessingService {
    /**
     * Main entry point - called after Gmail sync completes
     */
    static async runPostProcessing(userId: string): Promise<void> {
        logger.info(`[PostProcessing] Starting for user ${userId}`);
        console.log(`[POST-PROC] Starting full post-processing for user ${userId}`);

        try {
            // 1. Generate bills from transaction aggregates
            await this.generateBillsFromTransactions(userId);

            // 2. Find unmapped instruments and create suggestions
            await this.createInstrumentSuggestions(userId);

            logger.info(`[PostProcessing] Completed for user ${userId}`);
        } catch (error) {
            logger.error(`[PostProcessing] Failed for user ${userId}:`, error);
        }
    }

    /**
     * Generate bills by aggregating transactions per card per billing period
     */
    static async generateBillsFromTransactions(userId: string): Promise<number> {
        logger.info(`[PostProcessing] Generating bills for user ${userId}`);
        console.log(`[POST-PROC-BILLS] Generating bills...`);

        // Find all card+month combinations with transactions but no bill
        const result = await pool.query(
            `WITH transaction_aggregates AS (
        SELECT 
          t.instrument_id,
          t.bill_month,
          t.bill_year,
          SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE 0 END) as total_credits,
          COUNT(*) as transaction_count
        FROM transactions t
        INNER JOIN instruments i ON t.instrument_id = i.id
        WHERE t.user_id = $1 
          AND t.instrument_id IS NOT NULL
          AND t.bill_month IS NOT NULL
          AND t.bill_year IS NOT NULL
          AND i.type = 'credit_card'
        GROUP BY t.instrument_id, t.bill_month, t.bill_year
        HAVING SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END) > 0
      )
      SELECT ta.*, 
        COALESCE((i.metadata->>'bill_date')::int, 1) as bill_date,
        COALESCE((i.metadata->>'due_date')::int, 15) as due_date
      FROM transaction_aggregates ta
      INNER JOIN instruments i ON ta.instrument_id = i.id
      WHERE NOT EXISTS (
        SELECT 1 FROM bill_payments bp 
        WHERE bp.instrument_id = ta.instrument_id 
          AND bp.bill_month = ta.bill_month 
          AND bp.bill_year = ta.bill_year
      )`,
            [userId]
        );

        let created = 0;
        for (const row of result.rows) {
            try {
                // Calculate bill date and due date
                const billDate = dayjs()
                    .year(row.bill_year)
                    .month(row.bill_month - 1)
                    .date(row.bill_date)
                    .toDate();

                const dueDate = dayjs(billDate)
                    .add(1, 'month')
                    .date(row.due_date)
                    .toDate();

                const billAmount = row.total_debits - row.total_credits;

                // Determine payment status based on due date
                const isPastDue = dayjs().isAfter(dueDate);
                const paymentStatus = isPastDue ? 'overdue' : 'pending';

                await pool.query(
                    `INSERT INTO bill_payments (
            instrument_id, bill_month, bill_year, bill_amount,
            bill_date, due_date, payment_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (instrument_id, bill_month, bill_year) DO NOTHING`,
                    [
                        row.instrument_id,
                        row.bill_month,
                        row.bill_year,
                        Math.max(0, billAmount),
                        billDate,
                        dueDate,
                        paymentStatus
                    ]
                );
                created++;
            } catch (err) {
                logger.warn(`[PostProcessing] Failed to create bill for ${row.instrument_id}/${row.bill_month}/${row.bill_year}:`, err);
            }
        }

        logger.info(`[PostProcessing] Created ${created} bills for user ${userId}`);
        console.log(`[POST-PROC-BILLS] Created ${created} bills.`);
        return created;
    }

    /**
     * Find transactions without matching instruments and create suggestions
     */
    static async createInstrumentSuggestions(userId: string): Promise<number> {
        logger.info(`[PostProcessing] Creating instrument suggestions for user ${userId}`);

        // Find distinct card identifiers from transactions that aren't linked to instruments
        const result = await pool.query(
            `SELECT DISTINCT
        t.metadata->>'bankName' as bank_name,
        t.metadata->>'last4' as last4,
        t.instrument_type,
        COUNT(*) as transaction_count,
        SUM(t.amount) as total_amount
      FROM transactions t
      WHERE t.user_id = $1 
        AND t.instrument_id IS NULL
        AND t.metadata->>'last4' IS NOT NULL
        AND t.metadata->>'bankName' IS NOT NULL
      GROUP BY t.metadata->>'bankName', t.metadata->>'last4', t.instrument_type
      HAVING COUNT(*) >= 2`,
            [userId]
        );

        let created = 0;
        for (const row of result.rows) {
            try {
                // Check if instrument already exists with these identifiers
                const existing = await pool.query(
                    `SELECT id FROM instruments 
           WHERE user_id = $1 AND last4 = $2 
           AND EXISTS (
             SELECT 1 FROM banks b WHERE b.id = bank_id 
             AND LOWER(b.name) = LOWER($3)
           )`,
                    [userId, row.last4, row.bank_name]
                );

                if (existing.rows.length === 0) {
                    // Get or create bank
                    let bankId = null;
                    const bankResult = await pool.query(
                        `SELECT id FROM banks WHERE LOWER(name) = LOWER($1)`,
                        [row.bank_name]
                    );
                    if (bankResult.rows.length > 0) {
                        bankId = bankResult.rows[0].id;
                    }

                    // Create instrument with 'needs_input' status
                    await pool.query(
                        `INSERT INTO instruments (
              user_id, bank_id, type, name, last4, status, needs_input
            ) VALUES ($1, $2, $3, $4, $5, 'active', true)
            ON CONFLICT (user_id, bank_id, type, last4) DO NOTHING`,
                        [
                            userId,
                            bankId,
                            row.instrument_type || 'credit_card',
                            `${row.bank_name} ending ${row.last4}`,
                            row.last4
                        ]
                    );
                    created++;
                }
            } catch (err) {
                logger.warn(`[PostProcessing] Failed to create instrument suggestion:`, err);
            }
        }

        logger.info(`[PostProcessing] Created ${created} instrument suggestions for user ${userId}`);
        console.log(`[POST-PROC-CARDS] Created ${created} suggestions.`);
        return created;
    }

    /**
     * Get all incomplete instruments (needs_input = true) for a user
     */
    static async getIncompleteInstruments(userId: string) {
        const result = await pool.query(
            `SELECT 
        i.id, i.name, i.last4, i.type, b.name as bank_name,
        (SELECT COUNT(*) FROM transactions t WHERE t.instrument_id = i.id) as transaction_count
      FROM instruments i
      LEFT JOIN banks b ON i.bank_id = b.id
      WHERE i.user_id = $1 AND i.needs_input = true
      ORDER BY i.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
}
