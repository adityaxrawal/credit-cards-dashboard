import { DebitCardRepository } from '../../repositories/DebitCardRepository';
import { DebitCard, UUID } from '../../types/instruments.types';

export class DebitCardService {
    // Register debit card (must have parent account)
    static async registerDebitCard(userId: UUID, accountId: UUID, data: {
        bankId: UUID,
        cardName: string,
        cardNetwork: string,
        cardNumberLast4: string,
        cardNumberMasked: string,
        expiryDate: Date,
        dailyLimit?: number
    }): Promise<DebitCard> {
        return DebitCardRepository.create({
            userId,
            bankAccountId: accountId,
            ...data,
            dailyWithdrawalLimit: data.dailyLimit,
            cardStatus: 'active'
        });
    }

    // Get debit cards for account
    static async getCardsForAccount(accountId: UUID): Promise<DebitCard[]> {
        return DebitCardRepository.findByAccountId(accountId);
    }

    // Get debit cards for user
    static async getCardsByUser(userId: UUID): Promise<DebitCard[]> {
        return DebitCardRepository.findByUserId(userId);
    }

    // Get debit card by ID
    static async getById(id: UUID): Promise<DebitCard | null> {
        return DebitCardRepository.findById(id);
    }

    // Search debit card by last 4
    static async findCardByLast4(userId: UUID, last4: string): Promise<DebitCard | null> {
        return DebitCardRepository.findByUserAndLast4(userId, last4);
    }
}
