/**
 * PdfPasswordService - Manages user PDF passwords
 * 
 * Provides CRUD operations for PDF passwords with:
 * - AES-256-GCM encryption for stored passwords
 * - Priority-based ordering for password attempts
 * - Integration with BankPasswordFormats for fallbacks
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import logger from '@shared/utils/infrastructure/logger';
import { BankPasswordFormats, UserProfile, GeneratedPassword } from '@modules/transactions/services/extraction/BankPasswordFormats';
import { env } from '@shared/config/env';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.PDF_PASSWORD_ENCRYPTION_KEY || 'default-key-change-in-production!';

export interface PdfPassword {
    id: string;
    user_id: string;
    password_name: string;
    password_value: string;  // Encrypted
    bank_hint?: string;
    priority: number;
    created_at: Date;
    updated_at: Date;
}

export interface PdfPasswordDisplay {
    id: string;
    password_name: string;
    password_masked: string;  // Shows first 2 and last 2 chars
    bank_hint?: string;
    priority: number;
    created_at: Date;
}

export interface CreatePdfPasswordDto {
    password_name: string;
    password_value: string;
    bank_hint?: string;
    priority?: number;
}

export class PdfPasswordService {
    private supabase;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } else {
            logger.warn('[PdfPasswordService] Supabase not configured. PDF password storage disabled.');
        }
    }

    private ensureSupabase() {
        if (!this.supabase) {
            throw new Error('Supabase configuration missing');
        }
    }

    /**
     * Encrypt password for storage
     */
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt password from storage
     */
    private decrypt(encryptedData: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Mask password for display (show first 2 and last 2 chars)
     */
    private maskPassword(password: string): string {
        if (password.length <= 4) {
            return '****';
        }
        const first2 = password.substring(0, 2);
        const last2 = password.substring(password.length - 2);
        const middle = '*'.repeat(Math.min(password.length - 4, 6));
        return `${first2}${middle}${last2}`;
    }

    /**
     * List all passwords for a user (masked for display)
     */
    async listPasswords(userId: string): Promise<PdfPasswordDisplay[]> {
        this.ensureSupabase();
        const { data, error } = await this.supabase!
            .from('user_pdf_passwords')
            .select('*')
            .eq('user_id', userId)
            .order('priority', { ascending: false });

        if (error) {
            logger.error('[PdfPasswordService] Error listing passwords:', error);
            throw error;
        }

        return (data || []).map(row => {
            const decrypted = this.decrypt(row.password_value);
            return {
                id: row.id,
                password_name: row.password_name,
                password_masked: this.maskPassword(decrypted),
                bank_hint: row.bank_hint,
                priority: row.priority,
                created_at: new Date(row.created_at),
            };
        });
    }

    /**
     * Get all decrypted passwords for a user (for PDF parsing)
     */
    async getDecryptedPasswords(userId: string): Promise<string[]> {
        this.ensureSupabase();
        const { data, error } = await this.supabase!
            .from('user_pdf_passwords')
            .select('password_value, priority')
            .eq('user_id', userId)
            .order('priority', { ascending: false });

        if (error) {
            logger.error('[PdfPasswordService] Error getting passwords:', error);
            return [];
        }

        return (data || []).map(row => this.decrypt(row.password_value));
    }

    /**
     * Add a new password
     */
    async addPassword(userId: string, dto: CreatePdfPasswordDto): Promise<PdfPasswordDisplay> {
        this.ensureSupabase();
        const encryptedValue = this.encrypt(dto.password_value);

        const { data, error } = await this.supabase!
            .from('user_pdf_passwords')
            .insert({
                user_id: userId,
                password_name: dto.password_name,
                password_value: encryptedValue,
                bank_hint: dto.bank_hint,
                priority: dto.priority || 0,
            })
            .select()
            .single();

        if (error) {
            logger.error('[PdfPasswordService] Error adding password:', error);
            throw error;
        }

        return {
            id: data.id,
            password_name: data.password_name,
            password_masked: this.maskPassword(dto.password_value),
            bank_hint: data.bank_hint,
            priority: data.priority,
            created_at: new Date(data.created_at),
        };
    }

    /**
     * Delete a password
     */
    async deletePassword(userId: string, passwordId: string): Promise<boolean> {
        this.ensureSupabase();
        const { error } = await this.supabase!
            .from('user_pdf_passwords')
            .delete()
            .eq('id', passwordId)
            .eq('user_id', userId);

        if (error) {
            logger.error('[PdfPasswordService] Error deleting password:', error);
            throw error;
        }

        return true;
    }

    /**
     * Update password priority
     */
    async updatePriority(userId: string, passwordId: string, priority: number): Promise<void> {
        this.ensureSupabase();

        const { error } = await this.supabase!
            .from('user_pdf_passwords')
            .update({ priority, updated_at: new Date().toISOString() })
            .eq('id', passwordId)
            .eq('user_id', userId);

        if (error) {
            logger.error('[PdfPasswordService] Error updating priority:', error);
            throw error;
        }
    }

    /**
     * Get all passwords to try for PDF parsing (user saved + bank fallbacks)
     */
    async getAllPasswordsForParsing(
        userId: string,
        userProfile?: UserProfile,
        bankHint?: string
    ): Promise<string[]> {
        // 1. User saved passwords (highest priority)
        let userPasswords: string[] = [];
        if (this.supabase) {
            try {
                userPasswords = await this.getDecryptedPasswords(userId);
            } catch (e) {
                logger.warn('[PdfPasswordService] Failed to fetch user passwords', e);
            }
        }

        // 2. Bank-standard passwords from profile
        let bankPasswords: GeneratedPassword[] = [];
        if (userProfile) {
            if (bankHint) {
                bankPasswords = BankPasswordFormats.generateForBank(bankHint, userProfile);
            } else {
                bankPasswords = BankPasswordFormats.generateFromProfile(userProfile);
            }
        }

        // 3. Common default passwords
        const commonPasswords = BankPasswordFormats.getCommonPasswords();

        // Combine and dedupe
        const allPasswords = [
            ...userPasswords,
            ...bankPasswords.map(p => p.password),
            ...commonPasswords.map(p => p.password),
        ];

        return [...new Set(allPasswords)];
    }
}
