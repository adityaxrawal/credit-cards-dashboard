import { CreditCardMailDetector, DetectionResult } from './CreditCardMailDetector';
import { gmail_v1 } from 'googleapis';
import { OllamaService } from './ollama.service';
import * as transactionsService from './transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import { NotificationService } from './notification.service';

interface QueueItem {
    id: string;
    userId: string;
    message: gmail_v1.Schema$Message;
    timestamp: number;
}

export class FastQueueService {
    private static queue: QueueItem[] = [];
    private static isProcessing = false;
    private static MAX_QUEUE_SIZE = 1000;

    /**
     * Add email to queue
     */
    static enqueue(userId: string, message: gmail_v1.Schema$Message) {
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            console.warn('[FastQueue] Queue full, dropping old message');
            this.queue.shift();
        }

        const id = message.id || `msg-${Date.now()}`;
        this.queue.push({
            id,
            userId,
            message,
            timestamp: Date.now()
        });

        this.processLoop().catch(e => console.error('[FastQueue] Loop error:', e));
    }

    private static async processLoop() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                if (!item) break;

                const start = Date.now();
                try {
                    // 1. Detect
                    const result = await CreditCardMailDetector.detect(item.message);

                    if (result.isTransaction && result.merchant && result.amount) {
                        // 2. Resolve Card
                        // Try to find card by Last4 first
                        let cardId: string | null = null;
                        if (result.cardLast4) {
                            const card = await cardsQueries.findCardByLastFour(item.userId, result.cardLast4);
                            if (card) cardId = card.id;
                        }

                        // TODO: If no card found, logic to handle "Unknown Card" or skip

                        if (cardId) {
                            await transactionsService.insertFromEmail(item.userId, {
                                cardId,
                                amount: result.amount,
                                transactionDate: result.transactionDate ? new Date(result.transactionDate) : new Date(),
                                merchant: result.merchant || 'Unknown',
                                category: result.category,
                                emailMessageId: item.id
                            });

                            // 3. Real-time Notification
                            NotificationService.notifyNewTransaction({
                                merchant: result.merchant,
                                amount: result.amount,
                                date: result.transactionDate,
                                category: result.category,
                                cardLast4: result.cardLast4
                            });

                            console.log(`[FastQueue] Saved Tx & Notified: ${result.merchant} ${result.amount} (${Date.now() - start}ms)`);
                        } else {
                            console.warn(`[FastQueue] Tx detected but card not found (Last4: ${result.cardLast4}). MsgId: ${item.id}`);
                        }
                    }
                } catch (err) {
                    console.error(`[FastQueue] Error handling ${item.id}:`, err);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }
}
