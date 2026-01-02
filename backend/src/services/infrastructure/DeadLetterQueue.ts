import { DlqRepository } from '../../repositories/DlqRepository';

export interface DeadLetterMessage {
    id: string;
    source: string; // e.g. 'GMAIL_INGESTION', 'PDF_PARSER'
    payload: any;
    error: string;
    status: 'PENDING' | 'RESOLVED' | 'IGNORED';
    created_at: Date;
}

export class DeadLetterQueue {

    /**
     * Push a message to the DLQ
     */
    static async push(source: string, payload: any, error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await DlqRepository.create(source, payload, errorMsg);
    }

    /**
     * Get pending messages for review
     */
    static async getPending(limit: number = 50) {
        return await DlqRepository.getPending(limit);
    }

    /**
     * Mark message as resolved
     */
    static async resolve(id: string) {
        await DlqRepository.markResolved(id);
    }
}
