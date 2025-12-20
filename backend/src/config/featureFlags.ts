import crypto from 'crypto';
import { env } from './env';

export const featureFlags = {
    USE_NEW_PIPELINE: env.NODE_ENV !== 'test' && (process.env.USE_NEW_PIPELINE === 'true'),
    NEW_PIPELINE_ROLLOUT_PERCENTAGE: parseInt(
        process.env.NEW_PIPELINE_ROLLOUT_PERCENTAGE || '100' // Default 100% - already deployed
    ),
};

/**
 * Deterministic user rollout based on user ID hash
 * Returns true if user is in the rollout percentage
 */
export function isUserInRollout(userId: string): boolean {
    if (featureFlags.NEW_PIPELINE_ROLLOUT_PERCENTAGE === 100) return true;
    if (featureFlags.NEW_PIPELINE_ROLLOUT_PERCENTAGE === 0) return false;

    // Hash userId and convert to percentage (0-99)
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const userPercentile = parseInt(hash.substring(0, 2), 16) % 100;

    return userPercentile < featureFlags.NEW_PIPELINE_ROLLOUT_PERCENTAGE;
}

/**
 * Check if feature is enabled globally
 */
export function isFeatureEnabled(featureName: keyof typeof featureFlags): boolean {
    const value = featureFlags[featureName];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return false;
}
