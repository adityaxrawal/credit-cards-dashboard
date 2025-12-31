import pool from '../lib/db';
import * as alertsService from '../services/alerts/AlertsService';
import dayjs from 'dayjs';

/**
 * Bill Auto-Detection Worker
 * Scans transactions to automatically detect and create bill entries
 * Detects recurring utility bills, subscriptions, and other regular payments
 */
export async function runBillAutoDetectionJob() {
    console.log('[BillAutoDetectionJob] Starting...');

    try {
        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE is_active = true'
        );

        console.log(`[BillAutoDetectionJob] Processing ${users.length} users`);

        let billsDetected = 0;

        for (const user of users) {
            try {
                // Look for recurring transactions that might be bills
                // Group by merchant/description and look for patterns
                const { rows: potentialBills } = await pool.query(
                    `WITH recurring_patterns AS (
            SELECT 
              LOWER(COALESCE(merchant_name, description)) as merchant,
              EXTRACT(DAY FROM transaction_date) as bill_day,
              AVG(amount) as avg_amount,
              STDDEV(amount) as amount_stddev,
              COUNT(*) as occurrence_count,
              MAX(transaction_date) as last_occurrence,
              array_agg(DISTINCT EXTRACT(DAY FROM transaction_date)) as days_array
            FROM transactions
            WHERE user_id = $1
            AND direction = 'debit'
            AND is_transfer IS NOT TRUE
            AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
            AND (
              category IN ('Utilities', 'Subscriptions', 'Insurance', 'Rent', 'EMI')
              OR LOWER(description) LIKE '%netflix%'
              OR LOWER(description) LIKE '%spotify%'
              OR LOWER(description) LIKE '%prime%'
              OR LOWER(description) LIKE '%electricity%'
              OR LOWER(description) LIKE '%water%'
              OR LOWER(description) LIKE '%gas%'
              OR LOWER(description) LIKE '%insurance%'
              OR LOWER(description) LIKE '%broadband%'
              OR LOWER(description) LIKE '%mobile%'
              OR LOWER(description) LIKE '%recharge%'
            )
            GROUP BY LOWER(COALESCE(merchant_name, description)), EXTRACT(DAY FROM transaction_date)
            HAVING COUNT(*) >= 2
          )
          SELECT * FROM recurring_patterns
          WHERE amount_stddev < avg_amount * 0.2 OR amount_stddev IS NULL
          ORDER BY occurrence_count DESC`,
                    [user.id]
                );

                for (const pattern of potentialBills) {
                    // Check if bill already exists
                    const { rows: existingBill } = await pool.query(
                        `SELECT id FROM bills 
             WHERE user_id = $1 
             AND LOWER(name) = $2`,
                        [user.id, pattern.merchant]
                    );

                    if (existingBill.length === 0) {
                        // Create new bill
                        const avgAmount = Math.round(pattern.avg_amount);
                        const billDay = Math.round(pattern.bill_day);

                        // Calculate next due date
                        const today = dayjs();
                        let nextDue = today.date(billDay);
                        if (nextDue.isBefore(today)) {
                            nextDue = nextDue.add(1, 'month');
                        }

                        // Determine category based on transaction category or keywords
                        let category = 'Other';
                        const merchantLower = pattern.merchant.toLowerCase();
                        if (merchantLower.includes('netflix') || merchantLower.includes('spotify') ||
                            merchantLower.includes('prime') || merchantLower.includes('subscription')) {
                            category = 'Subscriptions';
                        } else if (merchantLower.includes('electricity') || merchantLower.includes('water') ||
                            merchantLower.includes('gas') || merchantLower.includes('utility')) {
                            category = 'Utilities';
                        } else if (merchantLower.includes('insurance')) {
                            category = 'Insurance';
                        } else if (merchantLower.includes('broadband') || merchantLower.includes('mobile') ||
                            merchantLower.includes('recharge')) {
                            category = 'Telecom';
                        }

                        await pool.query(
                            `INSERT INTO bills (user_id, name, amount, category, due_date, frequency, is_auto_detected)
               VALUES ($1, $2, $3, $4, $5, 'monthly', true)`,
                            [user.id, pattern.merchant, avgAmount, category, nextDue.format('YYYY-MM-DD')]
                        );

                        billsDetected++;
                        console.log(`[BillAutoDetectionJob] Detected bill: ${pattern.merchant} - ₹${avgAmount}/month`);
                    }
                }

            } catch (error) {
                console.error(`[BillAutoDetectionJob] Error processing user ${user.id}:`, error);
            }
        }

        console.log(`[BillAutoDetectionJob] Detected ${billsDetected} new bills`);
        console.log('[BillAutoDetectionJob] Completed');
    } catch (error) {
        console.error('[BillAutoDetectionJob] Job failed:', error);
        throw error;
    }
}

/**
 * Update bill amounts based on recent transactions
 */
export async function updateBillAmountsJob() {
    console.log('[UpdateBillAmountsJob] Starting...');

    try {
        const { rows: bills } = await pool.query(
            `SELECT b.id, b.user_id, b.name, b.amount, b.category
       FROM bills b
       WHERE b.is_auto_detected = true`
        );

        let updated = 0;

        for (const bill of bills) {
            // Get recent transactions for this bill
            const { rows: recentTxns } = await pool.query(
                `SELECT AVG(amount) as avg_amount
         FROM transactions
         WHERE user_id = $1
         AND LOWER(COALESCE(merchant_name, description)) = LOWER($2)
         AND transaction_date >= CURRENT_DATE - INTERVAL '3 months'
         AND direction = 'debit'`,
                [bill.user_id, bill.name]
            );

            if (recentTxns[0].avg_amount) {
                const newAmount = Math.round(recentTxns[0].avg_amount);
                if (Math.abs(newAmount - bill.amount) > bill.amount * 0.1) {
                    await pool.query(
                        'UPDATE bills SET amount = $1 WHERE id = $2',
                        [newAmount, bill.id]
                    );
                    updated++;
                }
            }
        }

        console.log(`[UpdateBillAmountsJob] Updated ${updated} bill amounts`);
        console.log('[UpdateBillAmountsJob] Completed');
    } catch (error) {
        console.error('[UpdateBillAmountsJob] Job failed:', error);
        throw error;
    }
}

// If run directly
if (require.main === module) {
    runBillAutoDetectionJob()
        .then(() => updateBillAmountsJob())
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
