import logger from '../../utils/infrastructure/logger';
import dayjs from 'dayjs';
import { InstrumentRepository } from '../../repositories/InstrumentRepository';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { BillRepository } from '../../repositories/BillRepository';
import { BankRepository } from '../../repositories/BankRepository';

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
        const aggregates = await TransactionRepository.findBillableAggregates(userId);

        let created = 0;
        for (const row of aggregates) {
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

                await BillRepository.createBillPayment({
                    instrumentId: row.instrument_id,
                    billMonth: row.bill_month,
                    billYear: row.bill_year,
                    billAmount: Math.max(0, billAmount),
                    billDate,
                    dueDate,
                    paymentStatus
                });
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
        const aggregates = await TransactionRepository.findUnmappedSubtotals(userId);

        let created = 0;
        for (const row of aggregates) {
            try {
                // Check if instrument already exists with these identifiers
                const existing = await InstrumentRepository.findByBankNameAndLast4(userId, row.bank_name, row.last4);

                if (!existing) {
                    // Get or create bank (find only)
                    let bankId = null;
                    const bank = await BankRepository.findByNameNormalized(row.bank_name);
                    if (bank) {
                        bankId = bank.id;
                    }

                    // Create instrument with 'needs_input' status
                    await InstrumentRepository.createSuggestion({
                        userId,
                        bankId,
                        type: row.instrument_type || 'credit_card',
                        name: `${row.bank_name} ending ${row.last4}`,
                        last4: row.last4
                    });
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
        return await InstrumentRepository.findIncomplete(userId);
    }
}
