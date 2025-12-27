export class PIIRedactor {
    // Regex patterns - Basic PII
    private static readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    private static readonly PAN_REGEX = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
    private static readonly PHONE_REGEX = /(?:\+?91|0)?[6-9]\d{9}/g;
    // Generic Card regex: 13-19 digits, with handled separators
    private static readonly CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

    // OAuth and Authorization patterns
    private static readonly OAUTH_CODE_REGEX = /(?:code|authorization_code|auth_code)[=:]\s*([a-zA-Z0-9_\-\.\/]{20,100})/gi;

    // OTP patterns (4-8 digit codes)
    private static readonly OTP_REGEX = /\b(?:OTP|otp|code|Code|PIN|pin)[:\s]+(\d{4,8})\b/g;

    // Bank Account patterns (8-18 digits)
    private static readonly ACCOUNT_REGEX = /\b(?:A\/C|Account|Acct)[:\s#]*(\d{8,18})\b/gi;

    // Aadhaar pattern (12 digits, often spaced)
    private static readonly AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

    /**
     * Redact PII from the input.
     * Handles strings, objects, and arrays recursively.
     */
    static redact(input: any): any {
        if (typeof input === 'string') {
            return PIIRedactor.redactString(input);
        }

        if (Array.isArray(input)) {
            return input.map(item => PIIRedactor.redact(item));
        }

        if (input !== null && typeof input === 'object') {
            const redactedObject: any = {};
            for (const key of Object.keys(input)) {
                // Redact potentially sensitive keys entirely? 
                // For now, let's just redact values, but we could add key-based redaction later.
                redactedObject[key] = PIIRedactor.redact(input[key]);
            }
            return redactedObject;
        }

        return input;
    }

    private static redactString(str: string): string {
        let redacted = str;

        // Email
        redacted = redacted.replace(PIIRedactor.EMAIL_REGEX, (match) => {
            const parts = match.split('@');
            if (parts.length === 2) {
                return `${parts[0][0]}***@${parts[1]}`;
            }
            return '[EMAIL]';
        });

        // PAN
        redacted = redacted.replace(PIIRedactor.PAN_REGEX, (match) => {
            return `${match.substring(0, 2)}******${match.substring(match.length - 2)}`;
        });

        // Phone (10 digits)
        redacted = redacted.replace(PIIRedactor.PHONE_REGEX, (match) => {
            // Keep last 4 digits
            const clean = match.replace(/\D/g, '');
            if (clean.length >= 10) {
                return `******${clean.substring(clean.length - 4)}`;
            }
            return '******';
        });

        // Credit Card (Luhn check would be expensive here, doing simple pattern matching)
        // We only want to redact if it looks like a card number sequence
        redacted = redacted.replace(PIIRedactor.CARD_REGEX, (match) => {
            // Remove non-digit chars to check length
            const digits = match.replace(/\D/g, '');
            if (digits.length >= 13 && digits.length <= 19) {
                return `****-****-****-${digits.substring(digits.length - 4)}`;
            }
            return match;
        });

        // OAuth/Authorization codes
        redacted = redacted.replace(PIIRedactor.OAUTH_CODE_REGEX, (match, code) => {
            return match.replace(code, '[REDACTED]');
        });

        // OTP codes
        redacted = redacted.replace(PIIRedactor.OTP_REGEX, (match, otp) => {
            return match.replace(otp, '****');
        });

        // Bank Account numbers
        redacted = redacted.replace(PIIRedactor.ACCOUNT_REGEX, (match, account) => {
            if (account.length >= 8) {
                return match.replace(account, `****${account.substring(account.length - 4)}`);
            }
            return match.replace(account, '[ACCOUNT]');
        });

        // Aadhaar numbers (12 digits)
        redacted = redacted.replace(PIIRedactor.AADHAAR_REGEX, (match) => {
            const digits = match.replace(/\s/g, '');
            return `XXXX-XXXX-${digits.substring(digits.length - 4)}`;
        });

        return redacted;
    }
}
