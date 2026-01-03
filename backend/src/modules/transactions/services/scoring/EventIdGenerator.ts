/**
 * EventIdGenerator - Unique Event ID Generation
 * 
 * Generates unique event IDs for transactions following the new architecture spec.
 * Format: evt_{timestamp}_{random}
 */

import * as crypto from 'crypto';

export class EventIdGenerator {
    /**
     * Generate a unique event ID for a transaction
     * Format: evt_{base36_timestamp}_{random_hex}
     */
    static generate(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = crypto.randomBytes(6).toString('hex');
        return `evt_${timestamp}_${randomPart}`;
    }

    /**
     * Generate a deterministic event ID from transaction fingerprint
     * Useful for deduplication - same transaction data produces same ID
     */
    static fromFingerprint(fingerprint: string): string {
        const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
        return `evt_${hash.substring(0, 16)}`;
    }

    /**
     * Generate event ID from source and reference
     * Used when a unique reference already exists (bank ref, RRN, etc.)
     */
    static fromReference(source: string, reference: string): string {
        const combined = `${source}:${reference}`;
        const hash = crypto.createHash('sha256').update(combined).digest('hex');
        return `evt_${hash.substring(0, 16)}`;
    }

    /**
     * Validate if a string is a valid event ID format
     */
    static isValid(eventId: string): boolean {
        return /^evt_[a-z0-9]+_[a-f0-9]+$/.test(eventId) || /^evt_[a-f0-9]{16}$/.test(eventId);
    }
}
