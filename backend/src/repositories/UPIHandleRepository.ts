import { InstrumentRepository } from './InstrumentRepository';
import { UPIHandle, UUID } from '../types/instruments.types';

export class UPIHandleRepository {
    static async findByUserId(userId: UUID): Promise<UPIHandle[]> {
        const instruments = await InstrumentRepository.findByType(userId, 'upi_handle');
        return instruments.map(this.mapToUPI);
    }

    static async findByAccountId(accountId: UUID): Promise<UPIHandle[]> {
        const { query } = require('../lib/db');
        const result = await query(
            `SELECT * FROM instruments 
             WHERE type = 'upi_handle' 
             AND metadata->>'linked_bank_account_id' = $1`,
            [accountId]
        );
        return result.rows.map(this.mapRowToUPI);
    }

    static async findByHandle(upiHandle: string): Promise<UPIHandle | null> {
        const { query } = require('../lib/db');
        const result = await query(
            `SELECT * FROM instruments WHERE type = 'upi_handle' AND identifier = $1 LIMIT 1`,
            [upiHandle]
        );
        return result.rows[0] ? this.mapRowToUPI(result.rows[0]) : null;
    }

    static async findByUserAndHandle(userId: UUID, upiHandle: string): Promise<UPIHandle | null> {
        const { query } = require('../lib/db');
        const result = await query(
            `SELECT * FROM instruments WHERE user_id = $1 AND type = 'upi_handle' AND identifier = $2 LIMIT 1`,
            [userId, upiHandle]
        );
        return result.rows[0] ? this.mapRowToUPI(result.rows[0]) : null;
    }

    static async findById(id: UUID): Promise<UPIHandle | null> {
        const instrument = await InstrumentRepository.findById(id);
        if (!instrument || instrument.type !== 'upi_handle') return null;
        return this.mapToUPI(instrument as any);
    }

    static async create(data: Partial<UPIHandle>): Promise<UPIHandle> {
        return InstrumentRepository.create({
            userId: data.userId,
            type: 'upi_handle',
            bankId: data.bankId,
            name: data.upiHandle,
            identifier: data.upiHandle, // Handle is both name and identifier
            status: data.isActive ? 'active' : 'inactive',
            isPrimary: data.isPrimary,
            metadata: {
                linkedBankAccountId: data.bankAccountId,
                provider: data.upiProvider,
                daily_limit: data.dailyLimit,
                monthly_limit: data.monthlyLimit,
                registered_phone: data.registeredPhone,
                notes: data.notes,
                ...data.metadata
            }
        }).then(inst => this.mapToUPI(inst as any)); // reusing mapper for consistency
    }

    static async update(id: UUID, data: Partial<UPIHandle>): Promise<UPIHandle> {
        const updateData: any = {};
        if (data.upiHandle) {
            updateData.name = data.upiHandle;
            updateData.identifier = data.upiHandle;
        }
        if (data.isActive !== undefined) updateData.status = data.isActive ? 'active' : 'inactive';
        if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

        // Merge metadata
        if (data.bankAccountId || data.upiProvider || data.dailyLimit || data.monthlyLimit || data.registeredPhone || data.notes) {
            const current = await this.findById(id);
            updateData.metadata = {
                ...current?.metadata,
                linkedBankAccountId: data.bankAccountId,
                provider: data.upiProvider,
                daily_limit: data.dailyLimit,
                monthly_limit: data.monthlyLimit,
                registered_phone: data.registeredPhone,
                notes: data.notes,
                ...data.metadata
            };
        }

        const inst = await InstrumentRepository.update(id, updateData);
        return this.mapToUPI(inst as any);
    }

    static async delete(id: UUID): Promise<void> {
        await InstrumentRepository.delete(id);
    }

    private static mapRowToUPI(row: any): UPIHandle {
        return {
            id: row.id,
            userId: row.user_id,
            type: 'upi_handle',
            bankId: row.bank_id,
            bankAccountId: row.metadata.linked_bank_account_id,
            upiHandle: row.identifier,
            upiProvider: row.metadata.provider,
            status: row.status as any, // Required
            isPrimary: row.is_primary,
            isActive: row.status === 'active',
            dailyLimit: row.metadata.daily_limit,
            monthlyLimit: row.metadata.monthly_limit,
            registeredPhone: row.metadata.registered_phone,
            verifiedAt: row.metadata.verified_at ? new Date(row.metadata.verified_at) : undefined,
            notes: row.metadata.notes,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private static mapToUPI(inst: any): UPIHandle {
        // instrument 'inst' might have metadata already parsed if coming from Instrument Repo
        return {
            id: inst.id,
            userId: inst.userId || inst.user_id,
            type: 'upi_handle',
            bankId: inst.bankId || inst.bank_id,
            bankAccountId: inst.metadata.linkedBankAccountId || inst.metadata.linked_bank_account_id,
            upiHandle: inst.identifier,
            upiProvider: inst.metadata.provider,
            status: inst.status as any, // Required
            isPrimary: inst.isPrimary,
            isActive: inst.status === 'active',
            dailyLimit: inst.metadata.daily_limit,
            monthlyLimit: inst.metadata.monthly_limit,
            registeredPhone: inst.metadata.registered_phone,
            verifiedAt: inst.metadata.verified_at ? new Date(inst.metadata.verified_at) : undefined,
            notes: inst.metadata.notes,
            metadata: inst.metadata,
            createdAt: inst.createdAt || inst.created_at,
            updatedAt: inst.updatedAt || inst.updated_at
        };
    }
}
