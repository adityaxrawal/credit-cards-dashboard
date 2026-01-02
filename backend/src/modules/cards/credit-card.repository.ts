import { InstrumentRepository } from '../../repositories/InstrumentRepository';
import { CreditCard, UUID } from '@shared/types/instruments.types';

export class CreditCardRepository {
    static async findByUserId(userId: UUID): Promise<CreditCard[]> {
        const instruments = await InstrumentRepository.findByType(userId, 'credit_card');
        return instruments.map(this.mapToCreditCard);
    }

    static async findByUserAndLast4(userId: UUID, last4: string): Promise<CreditCard | null> {
        const { query } = require('@shared/database/db');
        const result = await query(
            `SELECT * FROM instruments WHERE user_id = $1 AND type = 'credit_card' AND last4 = $2 LIMIT 1`,
            [userId, last4]
        );
        return result.rows[0] ? this.mapRowToCreditCard(result.rows[0]) : null;
    }

    static async findByAccountId(accountId: UUID): Promise<CreditCard[]> {
        const { query } = require('@shared/database/db');
        const result = await query(
            `SELECT * FROM instruments 
             WHERE type = 'credit_card' 
             AND metadata->>'linked_bank_account_id' = $1`,
            [accountId]
        );
        return result.rows.map(this.mapRowToCreditCard);
    }

    static async findById(id: UUID): Promise<CreditCard | null> {
        const instrument = await InstrumentRepository.findById(id);
        if (!instrument || instrument.type !== 'credit_card') return null;
        return this.mapToCreditCard(instrument as any);
    }

    static async create(data: Partial<CreditCard>): Promise<CreditCard> {
        return InstrumentRepository.create({
            userId: data.userId,
            type: 'credit_card',
            bankId: data.bankId,
            name: data.cardName,
            identifier: data.cardNumberMasked,
            last4: data.cardNumberLast4,
            status: data.cardStatus,
            isPrimary: data.isPrimary,
            balance: data.currentBalance,
            metadata: {
                linkedBankAccountId: data.bankAccountId,
                card_network: data.cardNetwork,
                card_type: data.cardType,
                bill_date: data.billDate,
                due_date: data.dueDate,
                credit_limit: data.creditLimit,
                minimum_payment: data.minimumPayment,
                activation_date: data.cardActivationDate,
                expiry_date: data.cardExpiryDate,
                reward_rate: data.rewardRate,
                notes: data.notes,
                ...data.metadata
            }
        }).then(inst => this.mapToCreditCard(inst as any));
    }

    static async update(id: UUID, data: Partial<CreditCard>): Promise<CreditCard> {
        const updateData: any = {};
        if (data.cardName) updateData.name = data.cardName;
        if (data.cardNumberMasked) updateData.identifier = data.cardNumberMasked;
        if (data.cardNumberLast4) updateData.last4 = data.cardNumberLast4;
        if (data.cardStatus) updateData.status = data.cardStatus;
        if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
        if (data.currentBalance !== undefined) updateData.balance = data.currentBalance;

        // Merge metadata
        if (data.bankAccountId || data.cardNetwork || data.billDate || data.dueDate || data.creditLimit || data.cardExpiryDate || data.notes) {
            const current = await this.findById(id);
            updateData.metadata = {
                ...current?.metadata,
                linkedBankAccountId: data.bankAccountId,
                card_network: data.cardNetwork,
                card_type: data.cardType,
                bill_date: data.billDate,
                due_date: data.dueDate,
                credit_limit: data.creditLimit,
                minimum_payment: data.minimumPayment,
                activation_date: data.cardActivationDate,
                expiry_date: data.cardExpiryDate,
                reward_rate: data.rewardRate,
                notes: data.notes,
                ...data.metadata
            };
        }

        const inst = await InstrumentRepository.update(id, updateData);
        return this.mapToCreditCard(inst as any);
    }

    static async delete(id: UUID): Promise<void> {
        await InstrumentRepository.delete(id);
    }

    private static mapRowToCreditCard(row: any): CreditCard {
        return {
            id: row.id,
            userId: row.user_id,
            type: 'credit_card',
            bankId: row.bank_id,
            bankAccountId: row.metadata.linked_bank_account_id,
            cardName: row.name,
            cardNetwork: row.metadata.card_network,
            cardNumberLast4: row.last4,
            cardNumberMasked: row.identifier,
            cardType: row.metadata.card_type,
            status: row.status as any, // Required by Instrument
            cardStatus: row.status as any, // Legacy
            billDate: row.metadata.bill_date,
            dueDate: row.metadata.due_date,
            creditLimit: row.metadata.credit_limit,
            currentBalance: parseFloat(row.balance),
            minimumPayment: row.metadata.minimum_payment,
            cardActivationDate: row.metadata.activation_date ? new Date(row.metadata.activation_date) : undefined,
            cardExpiryDate: row.metadata.expiry_date ? new Date(row.metadata.expiry_date) : undefined,
            isPrimary: row.is_primary,
            rewardRate: row.metadata.reward_rate,
            notes: row.metadata.notes,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private static mapToCreditCard(inst: any): CreditCard {
        return {
            id: inst.id,
            userId: inst.userId || inst.user_id,
            type: 'credit_card',
            bankId: inst.bankId || inst.bank_id,
            bankAccountId: inst.metadata.linkedBankAccountId || inst.metadata.linked_bank_account_id,
            cardName: inst.name || inst.cardName,
            cardNetwork: inst.metadata.cardNetwork || inst.metadata.card_network,
            cardNumberLast4: inst.last4,
            cardNumberMasked: inst.identifier,
            cardType: inst.metadata.cardType || inst.metadata.card_type,
            status: inst.status as any, // Required by Instrument
            cardStatus: inst.status as any, // Legacy
            billDate: inst.metadata.billDate || inst.metadata.bill_date,
            dueDate: inst.metadata.dueDate || inst.metadata.due_date,
            creditLimit: inst.metadata.creditLimit || inst.metadata.credit_limit,
            currentBalance: inst.balance,
            minimumPayment: inst.metadata.minimumPayment || inst.metadata.minimum_payment,
            cardActivationDate: inst.metadata.activationDate ? new Date(inst.metadata.activationDate) : (inst.metadata.activation_date ? new Date(inst.metadata.activation_date) : undefined),
            cardExpiryDate: inst.metadata.expiryDate ? new Date(inst.metadata.expiryDate) : (inst.metadata.expiry_date ? new Date(inst.metadata.expiry_date) : undefined),
            isPrimary: inst.isPrimary,
            rewardRate: inst.metadata.rewardRate || inst.metadata.reward_rate,
            notes: inst.metadata.notes,
            metadata: inst.metadata,
            createdAt: inst.createdAt || inst.created_at,
            updatedAt: inst.updatedAt || inst.updated_at
        };
    }
}
