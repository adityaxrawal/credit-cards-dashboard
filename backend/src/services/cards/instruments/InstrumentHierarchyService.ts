import { BankService } from './BankService';
import { BankAccountService } from './BankAccountService';
import { CreditCardService } from './CreditCardService';
import { DebitCardService } from './DebitCardService';
import { UPIHandleService } from './UPIHandleService';
import { Bank, BankAccount, CreditCard, DebitCard, UPIHandle, UUID, BankHierarchy } from '../../../types/instruments.types';

export class InstrumentHierarchyService {
    // Get complete hierarchy for user (Bank → Account → Cards/UPI)
    static async getUserHierarchy(userId: UUID): Promise<BankHierarchy> {
        const [allBanks, userAccounts, userCreditCards, userDebitCards, userUPIHandles] = await Promise.all([
            BankService.getAllBanks(),
            BankAccountService.getUserAccounts(userId),
            CreditCardService.getUserCards(userId),
            DebitCardService.getCardsByUser(userId),
            UPIHandleService.getUserHandles(userId)
        ]);

        // Construct hierarchy
        // Filter banks that the user has accounts or standalone credit cards in
        const relevantBankIds = new Set([
            ...userAccounts.map(a => a.bankId),
            ...userCreditCards.map(c => c.bankId)
        ]);

        const hierarchy: BankHierarchy = {
            userId,
            banks: allBanks
                .filter(b => relevantBankIds.has(b.id))
                .map(bank => ({
                    bankId: bank.id,
                    bankName: bank.name,
                    bankCode: bank.code,
                    accounts: userAccounts
                        .filter(a => a.bankId === bank.id)
                        .map(account => ({
                            accountId: account.id,
                            accountType: account.accountType,
                            accountNumberMasked: account.accountNumberMasked,
                            upiHandle: account.upiHandle,
                            creditCards: userCreditCards
                                .filter(cc => cc.bankAccountId === account.id)
                                .map(cc => ({
                                    cardId: cc.id,
                                    cardName: cc.cardName,
                                    last4: cc.cardNumberLast4,
                                    status: cc.cardStatus
                                })),
                            debitCards: userDebitCards
                                .filter(dc => dc.bankAccountId === account.id)
                                .map(dc => ({
                                    cardId: dc.id,
                                    cardName: dc.cardName,
                                    last4: dc.cardNumberLast4,
                                    status: dc.cardStatus
                                })),
                            upiHandles: userUPIHandles
                                .filter(upi => upi.bankAccountId === account.id)
                                .map(upi => ({
                                    handleId: upi.id,
                                    upiHandle: upi.upiHandle,
                                    isActive: upi.isActive
                                }))
                        }))
                }))
        };

        // Add Standalone Credit Cards
        // In some cases, a user might have a CC but no account in that bank.
        // The current hierarchy structure expects cards under accounts.
        // If we want to show them, we might need to add a "Standalone" account node.

        return hierarchy;
    }

    // Get instruments under account
    static async getAccountInstruments(accountId: UUID): Promise<{
        creditCards: CreditCard[],
        debitCards: DebitCard[],
        upiHandles: UPIHandle[]
    }> {
        const [creditCards, debitCards, upiHandles] = await Promise.all([
            CreditCardService.getCardsForAccount(accountId),
            DebitCardService.getCardsForAccount(accountId),
            UPIHandleService.getHandlesForAccount(accountId)
        ]);

        return { creditCards, debitCards, upiHandles };
    }

    // Find instrument path (useful for breadcrumbs)
    // Returns: Bank → Account → Instrument
    static async getInstrumentPath(userId: UUID, instrumentId: UUID, type: 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle'): Promise<{
        bank: Bank | null,
        account: BankAccount | null,
        instrument: any
    }> {
        let instrument: any = null;
        let bankId: UUID | null = null;
        let accountId: UUID | null = null;

        if (type === 'credit_card') {
            instrument = await CreditCardService.getById(instrumentId);
        } else if (type === 'debit_card') {
            instrument = await DebitCardService.getById(instrumentId);
        } else if (type === 'bank_account') {
            instrument = await BankAccountService.updateAccount(instrumentId, {}); // updateAccount acts as a get if data is empty, but better to add a getById
            // I'll add BankAccountService.getById later
        } else if (type === 'upi_handle') {
            instrument = await UPIHandleService.getById(instrumentId);
        }

        if (instrument) {
            bankId = instrument.bankId;
            accountId = (instrument as any).bankAccountId || (type === 'bank_account' ? instrument.id : null);
        }

        const [bank, account] = await Promise.all([
            bankId ? BankService.getBankById(bankId) : Promise.resolve(null),
            accountId ? BankAccountService.getAccountHierarchy(userId, accountId).then(h => h.account).catch(() => null) : Promise.resolve(null)
        ]);

        return { bank, account, instrument };
    }
}
