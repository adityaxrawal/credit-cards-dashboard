import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16 bytes
const TAG_LENGTH = 16; // For GCM, this is always 16 bytes

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format 'iv:authTag:encrypted'
 */
export function encrypt(text: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Convert hex key to buffer
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte (64 character) hex string');
  }

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from('gmail-token-encryption', 'utf8'));
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Return in format 'iv:authTag:encrypted'
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param encryptedData - Encrypted string in format 'iv:authTag:encrypted'
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Convert hex key to buffer
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte (64 character) hex string');
  }

  // Split the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected format: iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  
  // Convert hex strings back to buffers
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from('gmail-token-encryption', 'utf8'));
  decipher.setAuthTag(authTag);
  
  // Decrypt the text
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generates a random 32-byte encryption key in hex format
 * This is a utility function for generating the ENCRYPTION_KEY
 * @returns 64-character hex string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Type definitions for better TypeScript support
export interface EncryptionResult {
  encrypted: string;
  success: boolean;
  error?: string;
}

export interface DecryptionResult {
  decrypted: string;
  success: boolean;
  error?: string;
}

/**
 * Safe encrypt function that returns a result object instead of throwing
 * @param text - The plaintext to encrypt
 * @returns EncryptionResult object
 */
export function safeEncrypt(text: string): EncryptionResult {
  try {
    const encrypted = encrypt(text);
    return { encrypted, success: true };
  } catch (error) {
    return { 
      encrypted: '', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown encryption error' 
    };
  }
}

/**
 * Safe decrypt function that returns a result object instead of throwing
 * @param encryptedData - Encrypted string to decrypt
 * @returns DecryptionResult object
 */
export function safeDecrypt(encryptedData: string): DecryptionResult {
  try {
    const decrypted = decrypt(encryptedData);
    return { decrypted, success: true };
  } catch (error) {
    return { 
      decrypted: '', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown decryption error' 
    };
  }
}