
/**
 * GDPR Service
 * Handles data export and deletion requests.
 */

import { GdprRepository } from '../../repositories/GdprRepository';

export class GdprService {

    /**
     * Export all user data as a JSON object
     */
    static async exportAllUserData(userId: string) {
        // 1. User Profile
        const user = await GdprRepository.getUserProfile(userId);

        // 2. Transactions
        const transactions = await GdprRepository.getUserTransactions(userId);

        // 3. Budgets, goals, etc. can be added here

        return {
            profile: user,
            transactions,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Delete user account and all associated data
     * WARNING: Irreversible
     */
    static async deleteUserAccount(userId: string) {
        return GdprRepository.deleteAllUserData(userId);
    }
}
