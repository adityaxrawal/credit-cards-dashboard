import { InstrumentRepository } from './InstrumentRepository';
import { BankAccount, UUID } from '@shared/types/instruments.types';

export class BankAccountRepository {
    static async findByUserId(userId: UUID): Promise<BankAccount[]> {
        const instruments = await InstrumentRepository.findByType(userId, 'bank_account');
        return instruments.map(this.mapToBankAccount);
    }

    static async findByUserAndBank(userId: UUID, bankId: UUID): Promise<BankAccount[]> {
        const { query } = require('@shared/database/db');
        const result = await query(
            `SELECT * FROM instruments WHERE user_id = $1 AND bank_id = $2 AND type = 'bank_account'`,
            [userId, bankId]
        );
        return result.rows.map(this.mapRowToBankAccount);
    }

    static async findById(id: UUID): Promise<BankAccount | null> {
        const instrument = await InstrumentRepository.findById(id);
        if (!instrument || instrument.type !== 'bank_account') return null;
        return this.mapToBankAccount(instrument as any);
    }

    static async findByUserAndMasked(userId: UUID, masked: string): Promise<BankAccount | null> {
        const { query } = require('@shared/database/db');
        const result = await query(
            `SELECT * FROM instruments WHERE user_id = $1 AND identifier = $2 AND type = 'bank_account' LIMIT 1`,
            [userId, masked]
        );
        return result.rows[0] ? this.mapRowToBankAccount(result.rows[0]) : null;
    }

    static async create(data: Partial<BankAccount>): Promise<BankAccount> {
        return InstrumentRepository.create({
            userId: data.userId,
            type: 'bank_account',
            bankId: data.bankId,
            name: data.accountHolderName,
            identifier: data.accountNumberMasked,
            status: 'active',
            isPrimary: data.isPrimary,
            metadata: {
                account_type: data.accountType,
                account_holder_name: data.accountHolderName,
                upi_handle: data.upiHandle,
                notes: data.notes,
                ...data.metadata
            }
        }).then(inst => this.mapToBankAccount(inst as any));
    }

    static async update(id: UUID, data: Partial<BankAccount>): Promise<BankAccount> {
        const updateData: any = {};
        if (data.accountHolderName) updateData.name = data.accountHolderName;
        if (data.accountNumberMasked) updateData.identifier = data.accountNumberMasked;
        if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

        // Merge metadata
        if (data.accountType || data.accountHolderName || data.upiHandle || data.notes) {
            const current = await this.findById(id);
            updateData.metadata = {
                ...current?.metadata,
                account_type: data.accountType,
                account_holder_name: data.accountHolderName,
                upi_handle: data.upiHandle,
                notes: data.notes,
                ...data.metadata
            };
        }

        const inst = await InstrumentRepository.update(id, updateData);
        return this.mapToBankAccount(inst as any);
    }

    static async delete(id: UUID): Promise<void> {
        await InstrumentRepository.delete(id);
    }

    private static mapRowToBankAccount(row: any): BankAccount {
        return {
            id: row.id,
            userId: row.user_id,
            type: 'bank_account',
            bankId: row.bank_id,
            accountNumberMasked: row.identifier,
            accountType: row.metadata.account_type,
            accountHolderName: row.name, // or row.metadata.account_holder_name
            upiHandle: row.metadata.upi_handle,
            status: row.status as any, // Required
            isPrimary: row.is_primary,
            notes: row.metadata.notes,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private static mapToBankAccount(inst: any): BankAccount {
        return {
            id: inst.id,
            userId: inst.userId || inst.user_id,
            type: 'bank_account',
            bankId: inst.bankId || inst.bank_id,
            accountNumberMasked: inst.identifier,
            accountType: inst.metadata.accountType || inst.metadata.account_type,
            accountHolderName: inst.name || inst.metadata.accountHolderName || inst.metadata.account_holder_name,
            upiHandle: inst.metadata.upiHandle || inst.metadata.upi_handle,
            status: inst.status as any, // Required
            isPrimary: inst.isPrimary,
            notes: inst.metadata.notes,
            metadata: inst.metadata,
            createdAt: inst.createdAt || inst.created_at,
            updatedAt: inst.updatedAt || inst.updated_at
        };
    }
}
