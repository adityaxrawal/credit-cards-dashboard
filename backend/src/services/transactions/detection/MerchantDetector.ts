import logger from '../../utils/infrastructure/logger';
import { BANK_PATTERNS, isKnownBankSender } from '../../data/transaction-patterns';

/**
 * Merchant category codes for common merchant types
 */
export const MERCHANT_CATEGORIES: Record<string, { displayName: string; category: string }> = {
    // E-commerce
    amazon: { displayName: 'Amazon', category: 'Shopping' },
    flipkart: { displayName: 'Flipkart', category: 'Shopping' },
    myntra: { displayName: 'Myntra', category: 'Shopping' },
    ajio: { displayName: 'AJIO', category: 'Shopping' },
    meesho: { displayName: 'Meesho', category: 'Shopping' },
    nykaa: { displayName: 'Nykaa', category: 'Shopping' },

    // Food & Dining
    swiggy: { displayName: 'Swiggy', category: 'Food & Dining' },
    zomato: { displayName: 'Zomato', category: 'Food & Dining' },
    dominos: { displayName: "Domino's Pizza", category: 'Food & Dining' },
    mcdonalds: { displayName: "McDonald's", category: 'Food & Dining' },
    starbucks: { displayName: 'Starbucks', category: 'Food & Dining' },

    // Travel
    makemytrip: { displayName: 'MakeMyTrip', category: 'Travel' },
    goibibo: { displayName: 'Goibibo', category: 'Travel' },
    irctc: { displayName: 'IRCTC', category: 'Travel' },
    uber: { displayName: 'Uber', category: 'Travel' },
    ola: { displayName: 'Ola', category: 'Travel' },
    rapido: { displayName: 'Rapido', category: 'Travel' },

    // Entertainment & Streaming
    netflix: { displayName: 'Netflix', category: 'Entertainment' },
    hotstar: { displayName: 'Disney+ Hotstar', category: 'Entertainment' },
    prime: { displayName: 'Amazon Prime', category: 'Entertainment' },
    spotify: { displayName: 'Spotify', category: 'Entertainment' },
    youtube: { displayName: 'YouTube Premium', category: 'Entertainment' },

    // Utilities & Bills
    jio: { displayName: 'Jio', category: 'Utilities' },
    airtel: { displayName: 'Airtel', category: 'Utilities' },
    vodafone: { displayName: 'Vodafone', category: 'Utilities' },
    bsnl: { displayName: 'BSNL', category: 'Utilities' },

    // Grocery
    bigbasket: { displayName: 'BigBasket', category: 'Groceries' },
    grofers: { displayName: 'Blinkit', category: 'Groceries' },
    blinkit: { displayName: 'Blinkit', category: 'Groceries' },
    zepto: { displayName: 'Zepto', category: 'Groceries' },
    dmart: { displayName: 'DMart', category: 'Groceries' },

    // Healthcare
    pharmeasy: { displayName: 'PharmEasy', category: 'Healthcare' },
    netmeds: { displayName: 'Netmeds', category: 'Healthcare' },
    oneMg: { displayName: '1mg', category: 'Healthcare' },
    practo: { displayName: 'Practo', category: 'Healthcare' },

    // Education
    udemy: { displayName: 'Udemy', category: 'Education' },
    coursera: { displayName: 'Coursera', category: 'Education' },
    byjus: { displayName: "BYJU'S", category: 'Education' },
    unacademy: { displayName: 'Unacademy', category: 'Education' },
};

export interface MerchantResult {
    merchantName: string;
    category: string;
    confidence: number;
    source: 'sender' | 'text_pattern' | 'fuzzy' | 'unknown';
}

/**
 * MerchantDetector - Extract and categorize merchants from email content
 */
export class MerchantDetector {
    /**
     * Detect merchant from email content
     */
    static detect(email: {
        subject: string;
        snippet: string;
        cleanedBody?: string;
        senderEmail?: string;
    }): MerchantResult {
        // 1. Try to extract from sender email domain
        const senderMerchant = this.extractFromSender(email.senderEmail);
        if (senderMerchant && senderMerchant.confidence >= 0.85) {
            return senderMerchant;
        }

        // 2. Try to extract from text patterns
        const fullText = `${email.subject} ${email.snippet} ${email.cleanedBody || ''}`;
        const textMerchant = this.extractFromText(fullText);
        if (textMerchant && textMerchant.confidence >= 0.7) {
            return textMerchant;
        }

        // 3. Combine results if both have partial matches
        if (senderMerchant && textMerchant) {
            // Prefer text pattern if confidence is similar
            return textMerchant.confidence >= senderMerchant.confidence - 0.1
                ? textMerchant
                : senderMerchant;
        }

        // 4. Return best single result
        if (textMerchant) return textMerchant;
        if (senderMerchant) return senderMerchant;

        // 5. Fallback: try to extract any merchant name from text
        const fallbackMerchant = this.extractFallbackMerchant(fullText);
        return fallbackMerchant;
    }

    /**
     * Extract merchant from sender email domain
     */
    private static extractFromSender(senderEmail?: string): MerchantResult | null {
        if (!senderEmail) return null;

        const emailLower = senderEmail.toLowerCase();

        // Check if it's from a known bank (not a merchant)
        const bankCheck = isKnownBankSender(senderEmail);
        if (bankCheck.isKnown) {
            return {
                merchantName: bankCheck.bankName || 'Bank',
                category: 'Banking',
                confidence: 0.9,
                source: 'sender'
            };
        }

        // Extract domain
        const domainMatch = emailLower.match(/@([a-z0-9-]+)\./);
        if (!domainMatch) return null;

        const domain = domainMatch[1].toLowerCase();

        // Check against known merchants
        const knownMerchant = MERCHANT_CATEGORIES[domain];
        if (knownMerchant) {
            return {
                merchantName: knownMerchant.displayName,
                category: knownMerchant.category,
                confidence: 0.9,
                source: 'sender'
            };
        }

        // General domain extraction with lower confidence
        const cleanDomain = domain
            .replace(/^(mail|email|no-?reply|info|support|notification)s?$/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

        if (cleanDomain && cleanDomain.length > 2) {
            return {
                merchantName: this.titleCase(cleanDomain),
                category: 'Others',
                confidence: 0.5,
                source: 'sender'
            };
        }

        return null;
    }

    /**
     * Extract merchant from email text using patterns
     */
    private static extractFromText(text: string): MerchantResult | null {
        const lowerText = text.toLowerCase();

        // Pattern 1: "at <Merchant>" or "from <Merchant>"
        const atFromPatterns = [
            /(?:at|from|via|to|with)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40})(?:\s+for|\s+of|\s+on|\.|,|$)/g,
            /(?:purchase|payment|order|transaction)\s+(?:at|from|with)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40})/gi,
            /(?:paid|sent|transferred)\s+(?:to|at)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40})/gi,
        ];

        for (const pattern of atFromPatterns) {
            const match = pattern.exec(text);
            if (match) {
                const merchantName = match[1].trim();
                if (this.isValidMerchantName(merchantName)) {
                    // Check if this matches a known merchant
                    const knownMatch = this.matchKnownMerchant(merchantName);
                    if (knownMatch) {
                        return { ...knownMatch, source: 'text_pattern' };
                    }
                    return {
                        merchantName: merchantName,
                        category: 'Others',
                        confidence: 0.7,
                        source: 'text_pattern'
                    };
                }
            }
        }

        // Pattern 2: Check for known merchant names in text
        for (const [key, merchant] of Object.entries(MERCHANT_CATEGORIES)) {
            if (lowerText.includes(key)) {
                return {
                    merchantName: merchant.displayName,
                    category: merchant.category,
                    confidence: 0.85,
                    source: 'text_pattern'
                };
            }
        }

        // Pattern 3: Brand names (capitalized words that look like names)
        const brandPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:pvt|ltd|inc|llc|limited|private|india)/gi;
        const brandMatch = brandPattern.exec(text);
        if (brandMatch) {
            return {
                merchantName: brandMatch[1].trim(),
                category: 'Others',
                confidence: 0.6,
                source: 'text_pattern'
            };
        }

        return null;
    }

    /**
     * Fallback merchant extraction for ambiguous cases
     */
    private static extractFallbackMerchant(text: string): MerchantResult {
        // Try to extract any meaningful merchant name
        const subjectMatch = text.match(/^([A-Z][A-Za-z0-9\s&'.-]{2,30}?)(?:\s*[-:|])?\s/);
        if (subjectMatch && this.isValidMerchantName(subjectMatch[1])) {
            return {
                merchantName: subjectMatch[1].trim(),
                category: 'Others',
                confidence: 0.4,
                source: 'fuzzy'
            };
        }

        return {
            merchantName: 'Unknown Merchant',
            category: 'Others',
            confidence: 0,
            source: 'unknown'
        };
    }

    /**
     * Check if a known merchant matches the extracted name
     */
    private static matchKnownMerchant(name: string): MerchantResult | null {
        const nameLower = name.toLowerCase().replace(/\s+/g, '');

        for (const [key, merchant] of Object.entries(MERCHANT_CATEGORIES)) {
            if (nameLower.includes(key) || key.includes(nameLower)) {
                return {
                    merchantName: merchant.displayName,
                    category: merchant.category,
                    confidence: 0.85,
                    source: 'fuzzy'
                };
            }
        }

        return null;
    }

    /**
     * Validate if a string is a valid merchant name
     */
    private static isValidMerchantName(name: string): boolean {
        if (!name || name.length < 2 || name.length > 50) return false;

        // Reject common false positives
        const invalidPatterns = [
            /^(the|and|for|with|your|our|this|that|from|thank|dear|hi|hello)$/i,
            /^(account|transaction|payment|credit|debit|card|bank|amount)$/i,
            /^(you|we|it|is|has|have|been|was|were)$/i,
            /^\d+$/,
            /^[^a-zA-Z]+$/,
        ];

        for (const pattern of invalidPatterns) {
            if (pattern.test(name.trim())) return false;
        }

        return true;
    }

    /**
     * Convert string to title case
     */
    private static titleCase(str: string): string {
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
