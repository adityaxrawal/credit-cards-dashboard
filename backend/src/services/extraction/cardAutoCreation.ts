import * as cardsQueries from '../../db/queries/cards.queries';
import logger from '../../utils/logger';

export interface AutoCreateCardRequest {
    userId: string;
    bankName: string;
    last4: string;
    cardName?: string;
}

export interface AutoCreateCardResult {
    cardId: string;
    cardName: string;
    isNewCard: boolean;
}

/**
 * Auto-create or find a credit card for transaction ingestion
 * Prevents loss of transactions due to missing card records
 */
export async function autoCreateOrFindCard(
    request: AutoCreateCardRequest
): Promise<AutoCreateCardResult> {
    const { userId, bankName, last4, cardName } = request;

    // STRATEGY 1: Try exact match first
    let existingCard = await cardsQueries.findCardByBankAndLastFour(
        userId,
        bankName,
        last4
    );

    if (existingCard) {
        logger.info(`Found existing card: ${existingCard.card_name}`);
        return {
            cardId: existingCard.id,
            cardName: existingCard.card_name,
            isNewCard: false,
        };
    }

    // STRATEGY 2: Try fuzzy match (same bank, any last4)
    const allUserCards = await cardsQueries.getUserCards(userId);
    const sameBank = allUserCards.find(
        (c) => c.bank_name.toLowerCase() === bankName.toLowerCase()
    );

    if (sameBank && allUserCards.length < 10) {
        // If user has card from this bank and fewer than 10 cards,
        // it's likely a duplicate/hidden card variant
        logger.warn(
            `Found similar card from ${bankName}: ${sameBank.card_name}, using it`
        );
        return {
            cardId: sameBank.id,
            cardName: sameBank.card_name,
            isNewCard: false,
        };
    }

    // STRATEGY 3: Auto-create new card
    logger.info(
        `Auto-creating card: ${bankName} ending in ${last4} for user ${userId}`
    );

    const generatedCardName = cardName || `${bankName} Card (****${last4})`;

    const newCard = await cardsQueries.createCard({
        userId,
        cardName: generatedCardName,
        bankName,
        lastFour: last4,
        billDate: 20,  // Default to 20th
        dueDate: 5,    // Default to 5th next month
        creditLimit: 0,  // Unknown, set to 0
        activationDate: new Date(),
        notes: `Auto-created from email extraction on ${new Date().toISOString()}`,
    });

    logger.info(
        `Created new card: ${newCard.id} (${newCard.card_name})`
    );

    return {
        cardId: newCard.id,
        cardName: newCard.card_name,
        isNewCard: true,
    };
}

export const cardAutoCreationService = {
    autoCreateOrFindCard
};
