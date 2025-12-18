import * as transactionsService from '../transactions.service';
import * as cardsQueries from '../../db/queries/cards.queries';
import { cardDetectionService } from '../extraction/cardDetectionService';
import { cardAutoCreationService } from '../extraction/cardAutoCreation';

export class ResolutionService {

    /**
     * Resolve card and create transaction from extracted data
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
        return await transactionsService.insertFromEmail(userId, {
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
    }
}
