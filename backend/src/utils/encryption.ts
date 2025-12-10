import crypto from 'crypto';

export class TokenEncryption {
    private static algorithm = 'aes-256-gcm';

    static encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            this.algorithm,
            Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
            iv
        ) as crypto.CipherGCM; // Cast to CipherGCM for getAuthTag
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    }

    static decrypt(encryptedText: string): string {
        const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
        const decipher = crypto.createDecipheriv(
            this.algorithm,
            Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
            Buffer.from(ivHex, 'hex')
        ) as crypto.DecipherGCM; // Cast to DecipherGCM for setAuthTag
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
    }
}
