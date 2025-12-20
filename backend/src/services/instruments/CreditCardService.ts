import { CreditCardRepository } from '../../repositories/CreditCardRepository';
import { CreditCard, UUID } from '../../types/instruments.types';

export class CreditCardService {
    // Register credit card
    static async registerCreditCard(userId: UUID, data: {
        bankId: UUID,
        bankAccountId?: UUID,  // Optional parent account
        cardName: string,
        cardNetwork: string,
        cardNumberLast4: string,
        cardNumberMasked: string,
        billDate: number,
        dueDate: number,
        creditLimit: number,
        expiryDate: Date
    }): Promise<CreditCard> {
        return CreditCardRepository.create({
            userId,
            ...data,
            cardType: 'credit',
            cardStatus: 'active'
        });
    }

    // Get cards for user
    static async getUserCards(userId: UUID): Promise<CreditCard[]> {
        return CreditCardRepository.findByUserId(userId);
    }

    // Get cards for account
    static async getCardsForAccount(accountId: UUID): Promise<CreditCard[]> {
        return CreditCardRepository.findByAccountId(accountId);
    }

    // Get card by ID
    static async getById(id: UUID): Promise<CreditCard | null> {
        return CreditCardRepository.findById(id);
    }

    // Search card by last 4
    static async findCardByLast4(userId: UUID, last4: string): Promise<CreditCard | null> {
        return CreditCardRepository.findByUserAndLast4(userId, last4);
    }

    // Get card with balance
    static async getCardWithBalance(cardId: UUID): Promise<CreditCard & { currentBalance: number }> {
        const card = await CreditCardRepository.findById(cardId);
        if (!card) throw new Error('Card not found');
        return card as CreditCard & { currentBalance: number };
    }

    // Update card balance
    static async updateCardBalance(cardId: UUID, balance: number): Promise<CreditCard> {
        return CreditCardRepository.update(cardId, { currentBalance: balance });
    }
}
