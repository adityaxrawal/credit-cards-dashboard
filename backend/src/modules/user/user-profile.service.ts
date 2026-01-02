import { UserRepository, User } from './user.repository';
import logger from '@shared/utils/infrastructure/logger';

export interface UserProfile {
    userId: string;
    name: string;
    email: string;
    dateOfBirth: Date | null;
}

export class UserProfileService {
    /**
     * Get user profile details by ID
     */
    static async getProfile(userId: string): Promise<UserProfile | null> {
        try {
            const user = await UserRepository.findById(userId);
            if (!user) return null;

            return {
                userId: user.id,
                name: user.name,
                email: user.email,
                dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth) : null
            };
        } catch (error) {
            logger.error('[UserProfileService] Failed to fetch profile', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    static async updateProfile(
        googleId: string,
        data: { name?: string; dateOfBirth?: Date }
    ): Promise<boolean> {
        try {
            const updated = await UserRepository.update(googleId, data);
            return !!updated;
        } catch (error) {
            logger.error('[UserProfileService] Failed to update profile', error);
            return false;
        }
    }

    /**
     * Get password generation context for a user
     * (Convenience method for pipeline)
     */
    static async getPasswordContext(userId: string) {
        const profile = await this.getProfile(userId);

        if (!profile) return null;

        // Split name for common password patterns (First 4 chars)
        const firstName = profile.name.split(' ')[0].toUpperCase();

        return {
            firstName: firstName,
            fullName: profile.name.toUpperCase(),
            dob: profile.dateOfBirth
        };
    }
}
