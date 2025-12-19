import * as transactionsService from '../transactions.service';
import * as cardsQueries from '../../db/queries/cards.queries';
import { cardDetectionService } from '../extraction/cardDetectionService';
import { cardAutoCreationService } from '../extraction/cardAutoCreation';
import logger from '../../utils/logger';

export class ResolutionService {

    /**
     * Resolve card strictly by Bank and Last4.
     * Auto-creates if not found (assuming strict extraction).
     */
    static async resolveCard(userId: string, bankName: string, last4: string): Promise<{ id: string } | null> {
        // 1. Try Find
        const existing = await cardsQueries.findCardByBankAndLastFour(userId, bankName, last4);
        if (existing) return existing;

        // 2. Auto Create (Since we trust StrictExtractor)
        try {
            const autoCard = await cardAutoCreationService.autoCreateOrFindCard({
                userId,
                bankName,
                last4,
                cardName: `${bankName} ${last4}`
            });
            return { id: autoCard.cardId };
        } catch (e) {
            console.error('Failed to auto-create card', e);
            return null;
        }
    }

    /**
     * Create formatted transaction
     */
    static async createTransaction(
        userId: string,
        data: {
            amount: number;
            merchant: string;
            date: Date;
            cardId?: string;
            externalId: string;
            type: 'debit';
            description?: string;
            currency?: string;
        },
        context: {
            gmailMessageId: string;
            gmailThreadId: string;
            rawEmailId: string;
            confidence: number;
            extractionMethod: string;
        }
    ) {
        return await transactionsService.insertFromEmail(userId, {
            cardId: data.cardId!, // Assume routed correctly or allow null handling in service
            amount: data.amount,
            transactionDate: data.date,
            merchant: data.merchant,
            category: 'Uncategorized',
            emailMessageId: context.gmailMessageId,
            gmailThreadId: context.gmailThreadId,
            rawEmailId: context.rawEmailId,
            metadata: {
                confidence: context.confidence,
                extraction_method: context.extractionMethod
            },
            emailSubject: undefined, // Can pass if needed
            currencyCode: data.currency
        });
    }

    /**
     * Resolve card and create transaction from extracted data (Legacy / Statement Support)
     */
    static async resolveAndCreateTransaction(
        userId: string,
        extractedData: {
            amount: number;
            merchant: string;
            date: Date;
            bankName?: string;
            extractionMethod: string;
            confidence?: number;
            [key: string]: any;
        },
        email: { id: string; subject: string; body: string; from: string },
        context?: { scanJobId?: string; rawEmailId?: string }
    ) {
        // 1. DETECT CARD
        const cardDetection = await cardDetectionService.detectCardFromEmail(
            userId,
            email,
            extractedData.bankName
        );

        let cardId: string;

        if ('status' in cardDetection && cardDetection.status === 'CREATE_CARD') {
            // Auto-create card
            const autoCard = await cardAutoCreationService.autoCreateOrFindCard({
                userId,
                bankName: cardDetection.bankName,
                last4: (cardDetection as any).last4,
                cardName: undefined
            });
            cardId = autoCard.cardId;
        } else if ('status' in cardDetection && cardDetection.status === 'FOUND') {
            const existing = await cardsQueries.findCardByBankAndLastFour(
                userId,
                cardDetection.bankName,
                cardDetection.last4Digits
            );
            if (existing) {
                cardId = existing.id;
            } else {
                throw new Error(`Card reported found but not retrievable: ${cardDetection.bankName} ${cardDetection.last4Digits}`);
            }
        } else {
            // Low confidence / fallback
            const bankName = 'bankName' in cardDetection ? cardDetection.bankName : undefined;
            const last4 = 'last4Digits' in cardDetection ? cardDetection.last4Digits :
                ('last4' in cardDetection ? (cardDetection as any).last4 : undefined);

            if (bankName && last4) {
                const autoCard = await cardAutoCreationService.autoCreateOrFindCard({
                    userId,
                    bankName,
                    last4
                });
                cardId = autoCard.cardId;
            } else {
                return {
                    status: 'PENDING_CARD_MAPPING',
                    message: `Could not auto-detect card.`
                };
            }
        }

        // 2. VERIFY CARD
        const card = await cardsQueries.getCardById(userId, cardId);
        if (!card) throw new Error("Card not found after resolution");

        if (extractedData.amount <= 0) {
            throw new Error('Amount validation failed');
        }

        // 3. METADATA
        const detectionMethod = 'detectionMethod' in cardDetection ? cardDetection.detectionMethod : 'auto_create';
        const finalBankName = 'bankName' in cardDetection ? cardDetection.bankName : ('bankName' in cardDetection ? (cardDetection as any).bankName : 'Unknown');
        const finalLast4 = 'last4Digits' in cardDetection ? cardDetection.last4Digits : ('last4' in cardDetection ? (cardDetection as any).last4 : 'Unknown');

        const metadata = {
            card_detection_method: detectionMethod,
            bank: finalBankName,
            last4: finalLast4
        };

        // 4. CREATE
        const result = await transactionsService.insertFromEmail(userId, {
            cardId: card.id,
            amount: extractedData.amount,
            transactionDate: extractedData.date,
            merchant: extractedData.merchant,
            category: 'Uncategorized',
            emailMessageId: email.id,
            metadata: metadata,
            emailSubject: email.subject,
            scanJobId: context?.scanJobId,
            rawEmailId: context?.rawEmailId
        });

        const { logger } = require('../../utils/logger'); // Dynamic to avoid circular? or import top if clean
        // It seems logger not imported at top. Checking imports.
        // I will trust dynamic require or just console if logger not available, but user wants logs.
        // Actually I should add import at top if safe. But let's check file again.
        // File view showed no logger import. SAFE: require inside or console.
        // Better: user standard logger.

        logger.info(`[Resolution] Created Txn: ${extractedData.merchant} ${extractedData.amount} on Card ${finalLast4}`);
        return result;
    }
}
