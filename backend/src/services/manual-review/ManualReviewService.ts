import { UnclassifiedRepository } from './UnclassifiedRepository';
import { UnclassifiedRecord } from '../../types/transaction.types';
import { TRANSACTION_PATTERNS } from '../../data/transaction-patterns';

export class ManualReviewService {

    /**
     * Get pending items for review
     */
    static async getQueue(): Promise<UnclassifiedRecord[]> {
        return UnclassifiedRepository.getAll();
    }

    /**
     * Mark an item as explicitly handled (e.g. noise or done)
     */
    static async markAsHandled(id: string): Promise<void> {
        await UnclassifiedRepository.remove(id);
    }

    /**
     * Helper to suggest a rule based on an example
     */
    static suggestRule(recordId: string, type: 'noise' | 'transaction'): string {
        // This would be expanded to actually modify the file conceptually, 
        // or return a snippet for the user to copy-paste.
        // For now, it's a placeholder for the future UI.
        return `Suggesting rule for ${recordId}`;
    }
}
