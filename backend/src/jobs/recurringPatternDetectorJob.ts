import pool from '@shared/database/db';
import dayjs from 'dayjs';

/**
 * Recurring Pattern Detector
 * Analyzes transactions to detect and categorize recurring payment patterns
 * Creates recurring_transactions entries for detected patterns
 */
export async function runRecurringPatternDetectorJob() {
    console.log('[RecurringPatternDetector] Starting...');

    try {
        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE is_active = true'
        );

        console.log(`[RecurringPatternDetector] Processing ${users.length} users`);

        let patternsDetected = 0;

        for (const user of users) {
            try {
                // Detect monthly patterns (same merchant, similar amount, monthly interval)
                const { rows: monthlyPatterns } = await pool.query(
                    `WITH txn_groups AS (
            SELECT 
              LOWER(COALESCE(merchant_name, description)) as merchant,
              category,
              AVG(amount) as avg_amount,
              STDDEV(amount) as amount_variance,
              COUNT(*) as count,
              MODE() WITHIN GROUP (ORDER BY EXTRACT(DAY FROM transaction_date)) as typical_day,
              MAX(transaction_date) as last_date,
              MIN(transaction_date) as first_date,
              array_agg(DISTINCT instrument_id) as instruments
            FROM transactions
            WHERE user_id = $1
            AND direction = 'debit'
            AND is_transfer IS NOT TRUE
            AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY LOWER(COALESCE(merchant_name, description)), category
            HAVING COUNT(*) >= 3
          ),
          patterns AS (
            SELECT *,
              CASE 
                WHEN count >= 6 AND (amount_variance IS NULL OR amount_variance < avg_amount * 0.15) THEN 'confirmed'
                WHEN count >= 3 AND (amount_variance IS NULL OR amount_variance < avg_amount * 0.25) THEN 'likely'
                ELSE 'possible'
              END as confidence,
              CASE
                WHEN EXTRACT(MONTH FROM AGE(last_date, first_date)) >= count - 1 THEN 'monthly'
                WHEN EXTRACT(WEEK FROM AGE(last_date, first_date)) >= count - 1 THEN 'weekly'
                ELSE 'irregular'
              END as frequency
            FROM txn_groups
            WHERE EXTRACT(MONTH FROM AGE(last_date, first_date)) >= 2
          )
          SELECT * FROM patterns
          WHERE frequency IN ('monthly', 'weekly')
          ORDER BY confidence DESC, count DESC`,
                    [user.id]
                );

                for (const pattern of monthlyPatterns) {
                    // Check if already tracked
                    const { rows: existing } = await pool.query(
                        `SELECT id FROM recurring_transactions 
             WHERE user_id = $1 AND LOWER(name) = $2`,
                        [user.id, pattern.merchant]
                    );

                    if (existing.length === 0) {
                        // Calculate next expected date
                        const typicalDay = Math.round(pattern.typical_day);
                        const today = dayjs();
                        let nextExpected = today.date(typicalDay);
                        if (nextExpected.isBefore(today)) {
                            nextExpected = pattern.frequency === 'weekly'
                                ? nextExpected.add(1, 'week')
                                : nextExpected.add(1, 'month');
                        }

                        await pool.query(
                            `INSERT INTO recurring_transactions 
               (user_id, name, amount, category, frequency, day_of_month, 
                next_expected_date, confidence, is_auto_detected, instrument_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
                            [
                                user.id,
                                pattern.merchant,
                                Math.round(pattern.avg_amount),
                                pattern.category,
                                pattern.frequency,
                                typicalDay,
                                nextExpected.format('YYYY-MM-DD'),
                                pattern.confidence,
                                pattern.instruments[0]
                            ]
                        );

                        patternsDetected++;
                        console.log(`[RecurringPatternDetector] Detected: ${pattern.merchant} - ${pattern.frequency} - ₹${Math.round(pattern.avg_amount)}`);
                    } else {
                        // Update existing pattern with latest data
                        await pool.query(
                            `UPDATE recurring_transactions 
               SET amount = $1, confidence = $2, last_detected_at = NOW()
               WHERE id = $3`,
                            [Math.round(pattern.avg_amount), pattern.confidence, existing[0].id]
                        );
                    }
                }

                // Also detect potential subscriptions based on keywords
                await detectSubscriptionPatterns(user.id);

            } catch (error) {
                console.error(`[RecurringPatternDetector] Error processing user ${user.id}:`, error);
            }
        }

        console.log(`[RecurringPatternDetector] Detected ${patternsDetected} new patterns`);
        console.log('[RecurringPatternDetector] Completed');
    } catch (error) {
        console.error('[RecurringPatternDetector] Job failed:', error);
        throw error;
    }
}

/**
 * Detect subscription patterns based on known service names
 */
async function detectSubscriptionPatterns(userId: string) {
    const subscriptionKeywords = [
        { pattern: 'netflix', name: 'Netflix', category: 'Entertainment' },
        { pattern: 'spotify', name: 'Spotify', category: 'Entertainment' },
        { pattern: 'prime', name: 'Amazon Prime', category: 'Entertainment' },
        { pattern: 'hotstar', name: 'Disney+ Hotstar', category: 'Entertainment' },
        { pattern: 'youtube', name: 'YouTube Premium', category: 'Entertainment' },
        { pattern: 'apple', name: 'Apple Services', category: 'Technology' },
        { pattern: 'google one', name: 'Google One', category: 'Technology' },
        { pattern: 'dropbox', name: 'Dropbox', category: 'Technology' },
        { pattern: 'notion', name: 'Notion', category: 'Productivity' },
        { pattern: 'canva', name: 'Canva', category: 'Design' },
        { pattern: 'linkedin', name: 'LinkedIn Premium', category: 'Professional' },
        { pattern: 'gym', name: 'Gym Membership', category: 'Health & Fitness' },
        { pattern: 'cult', name: 'Cult.fit', category: 'Health & Fitness' },
    ];

    for (const sub of subscriptionKeywords) {
        const { rows: matches } = await pool.query(
            `SELECT 
        AVG(amount) as avg_amount,
        COUNT(*) as count,
        MAX(transaction_date) as last_date
       FROM transactions
       WHERE user_id = $1
       AND LOWER(description) LIKE $2
       AND direction = 'debit'
       AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'`,
            [userId, `%${sub.pattern}%`]
        );

        if (matches[0].count >= 2) {
            const { rows: existing } = await pool.query(
                `SELECT id FROM recurring_transactions 
         WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
                [userId, sub.name]
            );

            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO recurring_transactions 
           (user_id, name, amount, category, frequency, is_auto_detected, confidence)
           VALUES ($1, $2, $3, $4, 'monthly', true, 'confirmed')`,
                    [userId, sub.name, Math.round(matches[0].avg_amount), sub.category]
                );
            }
        }
    }
}

/**
 * Mark missed recurring transactions
 */
export async function markMissedRecurringJob() {
    console.log('[MarkMissedRecurring] Starting...');

    try {
        const today = dayjs().format('YYYY-MM-DD');

        // Find recurring transactions that are overdue
        const { rows: overdue } = await pool.query(
            `SELECT id, user_id, name, next_expected_date 
       FROM recurring_transactions 
       WHERE next_expected_date < $1
       AND status = 'active'`,
            [today]
        );

        for (const rec of overdue) {
            // Check if transaction actually occurred
            const { rows: found } = await pool.query(
                `SELECT id FROM transactions
         WHERE user_id = $1
         AND LOWER(description) LIKE $2
         AND transaction_date >= $3
         AND direction = 'debit'`,
                [rec.user_id, `%${rec.name.toLowerCase()}%`, rec.next_expected_date]
            );

            if (found.length > 0) {
                // Transaction occurred, update next expected date
                const nextDate = dayjs(rec.next_expected_date).add(1, 'month');
                await pool.query(
                    `UPDATE recurring_transactions 
           SET next_expected_date = $1, last_occurred_at = NOW()
           WHERE id = $2`,
                    [nextDate.format('YYYY-MM-DD'), rec.id]
                );
            } else {
                // Transaction missed, flag it
                await pool.query(
                    `UPDATE recurring_transactions 
           SET missed_count = COALESCE(missed_count, 0) + 1
           WHERE id = $1`,
                    [rec.id]
                );
            }
        }

        console.log(`[MarkMissedRecurring] Processed ${overdue.length} overdue items`);
        console.log('[MarkMissedRecurring] Completed');
    } catch (error) {
        console.error('[MarkMissedRecurring] Job failed:', error);
        throw error;
    }
}

// If run directly
if (require.main === module) {
    runRecurringPatternDetectorJob()
        .then(() => markMissedRecurringJob())
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
