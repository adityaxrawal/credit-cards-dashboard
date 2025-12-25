import { UPIHandleRepository } from '../../../repositories/UPIHandleRepository';
import { UPIHandle, UUID } from '../../../types/instruments.types';

export class UPIHandleService {
    // Register UPI handle (linked to account)
    static async registerUPIHandle(userId: UUID, accountId: UUID, data: {
        bankId: UUID,
        upiHandle: string,  // e.g., "user@okaxis"
        upiProvider?: string,
        dailyLimit?: number,
        monthlyLimit?: number
    }): Promise<UPIHandle> {
        return UPIHandleRepository.create({
            userId,
            bankAccountId: accountId,
            ...data,
            isActive: true
        });
    }

    // Get UPI handles for account
    static async getHandlesForAccount(accountId: UUID): Promise<UPIHandle[]> {
        return UPIHandleRepository.findByAccountId(accountId);
    }

    // Get UPI handle by ID
    static async getById(id: UUID): Promise<UPIHandle | null> {
        return UPIHandleRepository.findById(id);
    }

    // Get UPI handle by handle string
    static async findByHandle(userId: UUID, upiHandle: string): Promise<UPIHandle | null> {
        return UPIHandleRepository.findByUserAndHandle(userId, upiHandle);
    }

    // Get all user's UPI handles
    static async getUserHandles(userId: UUID): Promise<UPIHandle[]> {
        return UPIHandleRepository.findByUserId(userId);
    }
}
