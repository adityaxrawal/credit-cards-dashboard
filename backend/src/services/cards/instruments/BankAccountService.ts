import { BankAccountRepository } from '../../../repositories/BankAccountRepository';
import { CreditCardRepository } from '../../../repositories/CreditCardRepository';
import { DebitCardRepository } from '../../../repositories/DebitCardRepository';
import { UPIHandleRepository } from '../../../repositories/UPIHandleRepository';
import { BankAccount, CreditCard, DebitCard, UPIHandle, UUID } from '../../../types/instruments.types';

export class BankAccountService {
    // Get all accounts for user
    static async getUserAccounts(userId: UUID): Promise<BankAccount[]> {
        return BankAccountRepository.findByUserId(userId);
    }

    // Get account with cards/UPI (full hierarchy)
    static async getAccountHierarchy(userId: UUID, accountId: UUID): Promise<{
        account: BankAccount,
        creditCards: CreditCard[],
        debitCards: DebitCard[],
        upiHandles: UPIHandle[]
    }> {
        const account = await BankAccountRepository.findById(accountId);
        if (!account || account.userId !== userId) {
            throw new Error('Account not found');
        }

        const [creditCards, debitCards, upiHandles] = await Promise.all([
            CreditCardRepository.findByAccountId(accountId),
            DebitCardRepository.findByAccountId(accountId),
            UPIHandleRepository.findByAccountId(accountId)
        ]);

        return {
            account,
            creditCards,
            debitCards,
            upiHandles
        };
    }

    // Create account
    static async createAccount(userId: UUID, data: {
        bankId: UUID,
        accountNumberMasked: string,
        accountType: 'savings' | 'current' | 'joint',
        upiHandle?: string
    }): Promise<BankAccount> {
        return BankAccountRepository.create({
            userId,
            ...data
        });
    }

    // Update account
    static async updateAccount(accountId: UUID, data: Partial<BankAccount>): Promise<BankAccount> {
        return BankAccountRepository.update(accountId, data);
    }

    // List accounts by bank
    static async getAccountsByBank(userId: UUID, bankId: UUID): Promise<BankAccount[]> {
        return BankAccountRepository.findByUserAndBank(userId, bankId);
    }

    // Search account by masked number
    static async findAccountByMaskedNumber(userId: UUID, mask: string): Promise<BankAccount | null> {
        return BankAccountRepository.findByUserAndMasked(userId, mask);
    }
}
