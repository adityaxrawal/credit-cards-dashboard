import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
// Ensure key is 32 bytes. If hex string provided, parse it.
// If plain string provided, hash it or pad it. 
// For simplicity assuming ENCRYPTION_KEY is a 32-char string or hex.
// Let's use a robust derivation or just Buffer.from if it's hex, or raw utf8 if 32 chars.
// Given the default '0000...' (32 chars), let's just use it as is if length 32, or hash if not?
// Better: Helper to get buffer.
function getKey(): Buffer {
    const keyStr = env.ENCRYPTION_KEY;
    if (keyStr.length === 64) {
        // Assume hex
        return Buffer.from(keyStr, 'hex');
    }
    if (keyStr.length === 32) {
        return Buffer.from(keyStr, 'utf8');
    }
    // Fallback/Error - or just hash it to get 32 bytes
    return crypto.createHash('sha256').update(keyStr).digest();
}

const KEY = getKey();

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
    // Graceful fallback: Check if text matches encrypted format
    const parts = text.split(':');
    if (parts.length !== 3) {
        // Not encrypted or legacy plain text
        return text;
    }

    try {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // Decryption failed (maybe key changed or processed wrong)
        console.warn('[Encryption] Decryption failed, returning original text.', error);
        return text;
    }
}
