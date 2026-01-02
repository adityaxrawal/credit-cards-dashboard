import { TransferRepository } from '../../repositories/TransferRepository';

export interface TransferInput {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date?: string;
    description?: string;
    notes?: string;
}

export interface TransferMatch {
    debitTransactionId: string;
    creditTransactionId: string;
    matchConfidence: number;
    matchReason: string;
}

export class TransferService {
    /**
     * Create an internal transfer between two accounts
     */
    async createTransfer(userId: string, input: TransferInput): Promise<{ debit: any; credit: any; pairId: string }> {
        const pairId = `TRF-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const txnDate = input.date || new Date().toISOString().split('T')[0];
        const description = input.description || 'Internal Transfer';

        const { debit, credit } = await TransferRepository.createTransfer(
            userId,
            input.fromAccountId,
            input.toAccountId,
            input.amount,
            description,
            txnDate,
            pairId
        );

        return { debit, credit, pairId };
    }

    /**
     * Find unmatched transactions that could be transfers
     */
    async findPotentialTransfers(userId: string): Promise<TransferMatch[]> {
        const rows = await TransferRepository.findPotentialTransfers(userId);

        return rows.map(row => ({
            debitTransactionId: row.debit_id,
            creditTransactionId: row.credit_id,
            matchConfidence: this.calculateConfidence(row),
            matchReason: this.getMatchReason(row),
        }));
    }

    /**
     * Link two transactions as a transfer pair
     */
    async linkAsTransfer(userId: string, debitTxnId: string, creditTxnId: string): Promise<{ pairId: string }> {
        const pairId = `TRF-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await TransferRepository.linkAsTransfer(userId, debitTxnId, creditTxnId, pairId);
        return { pairId };
    }

    /**
     * Get transfer history
     */
    async getTransferHistory(userId: string, limit: number = 50): Promise<any[]> {
        return TransferRepository.getTransferHistory(userId, limit);
    }

    private calculateConfidence(row: any): number {
        let confidence = 0.5;

        const daysDiff = Math.abs(
            (new Date(row.debit_date).getTime() - new Date(row.credit_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 0) confidence += 0.3;
        else if (daysDiff <= 1) confidence += 0.2;
        else confidence += 0.1;

        return Math.min(confidence, 1);
    }

    private getMatchReason(row: any): string {
        const daysDiff = Math.abs(
            (new Date(row.debit_date).getTime() - new Date(row.credit_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
            return `Same amount (₹${row.debit_amount}) debited and credited on the same day`;
        } else {
            return `Same amount (₹${row.debit_amount}) within ${Math.round(daysDiff)} day(s)`;
        }
    }
}
