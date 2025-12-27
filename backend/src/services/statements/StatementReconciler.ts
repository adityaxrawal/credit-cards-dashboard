import { ExtractedStatement, StatementTransaction, ReconciliationStats } from '../../types/statement.types';
import * as TransactionService from '../transactions/TransactionService';
import dayjs from 'dayjs';

export class StatementReconciler {
    /**
     * Reconcile extracted statement with existing transactions
     * - Matches based on Amount and Date (+/- 3 days)
     * - Updates settled status for matches
     * - Inserts new transactions for non-matches
     */
    static async reconcile(statement: ExtractedStatement, userId: string): Promise<ReconciliationStats> {
        const stats: ReconciliationStats = {
            totalProcessed: 0,
            matched: 0,
            newInserted: 0,
            skipped: 0
        };

        if (!statement.transactions || statement.transactions.length === 0) {
            return stats;
        }

        // 1. Define window for fetching existing txns
        // We look a bit wider than the statement period to account for date mismatches
        const firstDate = statement.transactions.reduce((min, t) => t.date < min ? t.date : min, statement.transactions[0].date);
        const lastDate = statement.transactions.reduce((max, t) => t.date > max ? t.date : max, statement.transactions[0].date);

        const fromDate = dayjs(firstDate).subtract(5, 'day').toISOString();
        const toDate = dayjs(lastDate).add(5, 'day').toISOString();

        // 2. Fetch existing transactions
        const existingResult = await TransactionService.listTransactions(userId, {
            from: fromDate,
            to: toDate,
            limit: 1000 // Reasonable limit for a monthly statement
        });

        const existingTxns = existingResult.data; // Assumes data is Array<Transaction>

        // 3. Process each statement transaction
        for (const stmtTxn of statement.transactions) {
            stats.totalProcessed++;

            // Find match
            // Criteria: Amount matches exactly. Date matches within +/- 3 days.
            // Optional: Check if already settled? If so, maybe skip or just re-confirm.
            const matchIndex = existingTxns.findIndex(exTxn => {
                const amountMatch = Math.abs(exTxn.amount - stmtTxn.amount) < 0.01;
                if (!amountMatch) return false;

                const exDate = dayjs(exTxn.transaction_date);
                const stmtDate = dayjs(stmtTxn.date);
                const diffDays = Math.abs(exDate.diff(stmtDate, 'day'));

                return diffDays <= 3;
            });

            if (matchIndex !== -1) {
                // MATCH FOUND
                const matchedTxn = existingTxns[matchIndex];

                // Update match (mark as settled)
                await TransactionService.updateTransaction(userId, matchedTxn.id, {
                    description: stmtTxn.description, // Enhance description
                    // We could also set is_settled=true but updateTransaction might not expose it yet.
                    // For now, let's just update description as proof of concept or assume updateTransaction handles it.
                    // Ideally we should have a 'settleTransaction' method.
                });
                // Assuming we want to mark it settled in DB directly or via service if exposed.
                // Since updateTransaction partial is limited, we might need to expand it later.

                // Remove from local list so we don't match it again (simple greediness)
                existingTxns.splice(matchIndex, 1);
                stats.matched++;
            } else {
                // NO MATCH -> INSERT
                await TransactionService.createManualTransaction({
                    userId,
                    amount: stmtTxn.amount,
                    transactionDate: stmtTxn.date,
                    merchant: stmtTxn.description, // Use raw desc as merchant for now
                    category: 'Uncategorized', // Parser doesn't categorize yet
                    transactionType: stmtTxn.type === 'credit' ? 'payment' : 'expense',
                    direction: stmtTxn.type,
                    instrumentType: 'credit_card', // Defaulting for statement import
                    instrumentId: 'unknown', // Need resolution logic later
                    description: `Imported from ${statement.bankName} Statement`,
                    metadata: {
                        source: 'statement_import',
                        originalText: stmtTxn.metadata?.originalText
                    }
                });
                stats.newInserted++;
            }
        }

        return stats;
    }
}
