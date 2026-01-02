import { InstrumentRepository } from '../../repositories/InstrumentRepository';
import { DebitCard, UUID } from '@shared/types/instruments.types';

export class DebitCardRepository {
    static async findByUserId(userId: UUID): Promise<DebitCard[]> {
        const instruments = await InstrumentRepository.findByType(userId, 'debit_card');
        return instruments as DebitCard[];
    }

    static async findByAccountId(accountId: UUID): Promise<DebitCard[]> {
        // We have to filter manually or add a query method for metadata filter if specialized index needed.
        // For now, fetching by user and filtering or querying metadata is option.
        // Better: Query directly since it's a migration optimization task.
        const { query } = require('@shared/database/db');
        // Note: linkedBankAccountId is in metadata now
        const result = await query(
            `SELECT * FROM instruments 
             WHERE type = 'debit_card' 
             AND metadata->>'linked_bank_account_id' = $1`,
            [accountId]
        );
        // Map manually using private mapper from InstrumentRepo or just construct compatible object
        // Re-using InstrumentRepository mapper would be nice but it's private.
        // Let's just use InstrumentRepository.findById if generic query is hard, but here we need custom query.
        // Actually, let's just use the query to get IDs then fetch via InstrumentRepo to be dry? No, performant query is better.

        // Let's copy the mapper logic briefly or just rely on the fact that the columns match mostly.
        return result.rows.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            type: 'debit_card',
            bankId: row.bank_id,
            bankAccountId: row.metadata.linked_bank_account_id,
            cardName: row.name,
            cardNetwork: row.metadata.card_network,
            cardNumberLast4: row.last4,
            cardNumberMasked: row.identifier,
            status: row.status as any, // Required by Instrument
            cardStatus: row.status as any, // Legacy
            cardActivationDate: row.metadata.activation_date ? new Date(row.metadata.activation_date) : undefined,
            cardExpiryDate: row.metadata.expiry_date ? new Date(row.metadata.expiry_date) : undefined,
            dailyWithdrawalLimit: row.metadata.daily_withdrawal_limit,
            isPrimary: row.is_primary,
            notes: row.metadata.notes,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    static async findByUserAndLast4(userId: UUID, last4: string): Promise<DebitCard | null> {
        const { query } = require('@shared/database/db');
        const result = await query(
            `SELECT * FROM instruments WHERE user_id = $1 AND type = 'debit_card' AND last4 = $2 LIMIT 1`,
            [userId, last4]
        );
        if (!result.rows[0]) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            type: 'debit_card',
            bankId: row.bank_id,
            bankAccountId: row.metadata.linked_bank_account_id,
            cardName: row.name,
            cardNetwork: row.metadata.card_network,
            cardNumberLast4: row.last4,
            cardNumberMasked: row.identifier,
            status: row.status as any, // Required by Instrument
            cardStatus: row.status as any, // Legacy
            cardActivationDate: row.metadata.activation_date ? new Date(row.metadata.activation_date) : undefined,
            cardExpiryDate: row.metadata.expiry_date ? new Date(row.metadata.expiry_date) : undefined,
            dailyWithdrawalLimit: row.metadata.daily_withdrawal_limit,
            isPrimary: row.is_primary,
            notes: row.metadata.notes,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    static async findById(id: UUID): Promise<DebitCard | null> {
        const instrument = await InstrumentRepository.findById(id);
        if (!instrument || instrument.type !== 'debit_card') return null;
        return instrument as DebitCard;
    }

    static async create(data: Partial<DebitCard>): Promise<DebitCard> {
        return InstrumentRepository.create({
            userId: data.userId,
            type: 'debit_card',
            bankId: data.bankId,
            name: data.cardName,
            identifier: data.cardNumberMasked,
            last4: data.cardNumberLast4,
            status: data.cardStatus,
            isPrimary: data.isPrimary,
            metadata: {
                linkedBankAccountId: data.bankAccountId, // crucial mapping
                card_network: data.cardNetwork,
                activation_date: data.cardActivationDate,
                expiry_date: data.cardExpiryDate,
                daily_withdrawal_limit: data.dailyWithdrawalLimit,
                notes: data.notes,
                ...data.metadata
            }
        }) as Promise<DebitCard>;
    }

    static async update(id: UUID, data: Partial<DebitCard>): Promise<DebitCard> {
        const updateData: any = {};
        if (data.cardName) updateData.name = data.cardName;
        if (data.cardNumberMasked) updateData.identifier = data.cardNumberMasked;
        if (data.cardNumberLast4) updateData.last4 = data.cardNumberLast4;
        if (data.cardStatus) updateData.status = data.cardStatus;
        if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

        // Merge metadata
        if (data.bankAccountId || data.cardNetwork || data.cardActivationDate || data.dailyWithdrawalLimit || data.notes) {
            const current = await this.findById(id);
            updateData.metadata = {
                ...current?.metadata,
                linkedBankAccountId: data.bankAccountId,
                card_network: data.cardNetwork,
                activation_date: data.cardActivationDate,
                expiry_date: data.cardExpiryDate,
                daily_withdrawal_limit: data.dailyWithdrawalLimit,
                notes: data.notes,
                ...data.metadata
            };
        }

        return InstrumentRepository.update(id, updateData) as Promise<DebitCard>;
    }

    static async delete(id: UUID): Promise<void> {
        await InstrumentRepository.delete(id);
    }
}
