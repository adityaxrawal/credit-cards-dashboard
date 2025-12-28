import { CleanEmail } from '../../../types/transaction.types';
import { Instrument, InstrumentType, Bank, UUID } from '../../../types/instruments.types';
import { InstrumentRepository } from '../../../repositories/InstrumentRepository';
import { BankService } from './BankService';
import { InstrumentRegistry } from './InstrumentRegistry';
import logger from '../../../utils/infrastructure/logger';

/**
 * Bank email domain mapping for auto-detection
 */
const BANK_EMAIL_DOMAINS: Record<string, string> = {
    'hdfcbank.com': 'HDFC Bank',
    'hdfcbank.net': 'HDFC Bank',
    'icicibank.com': 'ICICI Bank',
    'axisbank.com': 'Axis Bank',
    'sbi.co.in': 'State Bank of India',
    'onlinesbi.com': 'State Bank of India',
    'kotak.com': 'Kotak Mahindra Bank',
    'kotakbank.com': 'Kotak Mahindra Bank',
    'indusind.com': 'IndusInd Bank',
    'yesbank.in': 'Yes Bank',
    'idfcfirstbank.com': 'IDFC First Bank',
    'rbl.com': 'RBL Bank',
    'rblbank.com': 'RBL Bank',
    'sc.com': 'Standard Chartered',
    'standardchartered.com': 'Standard Chartered',
    'citi.com': 'Citi Bank',
    'citibank.com': 'Citi Bank',
    'americanexpress.com': 'American Express',
    'aexp.com': 'American Express',
    'pnb.co.in': 'Punjab National Bank',
    'bankofbaroda.co.in': 'Bank of Baroda',
    'unionbankofindia.co.in': 'Union Bank of India',
    'federalbank.co.in': 'Federal Bank',
    'lvb.com': 'Lakshmi Vilas Bank',
    'hsbc.co.in': 'HSBC India',
    'dbs.com': 'DBS Bank',
};

/**
 * UPI handle suffix to bank mapping
 */
const UPI_BANK_MAPPING: Record<string, string> = {
    '@okaxis': 'Axis Bank',
    '@oksbi': 'State Bank of India',
    '@okicici': 'ICICI Bank',
    '@okhdfcbank': 'HDFC Bank',
    '@ybl': 'Axis Bank',
    '@paytm': 'Paytm Payments Bank',
    '@ibl': 'ICICI Bank',
    '@upi': 'Generic UPI',
    '@apl': 'Amazon Pay',
    '@fbl': 'Federal Bank',
    '@kotak': 'Kotak Mahindra Bank',
    '@indus': 'IndusInd Bank',
    '@rbl': 'RBL Bank',
    '@sbi': 'State Bank of India',
    '@hdfc': 'HDFC Bank',
    '@icici': 'ICICI Bank',
    '@axisbank': 'Axis Bank',
    '@axisb': 'Axis Bank',
    '@dbs': 'DBS Bank',
    '@hsbc': 'HSBC India',
    '@citi': 'Citi Bank',
    '@sc': 'Standard Chartered',
    '@airtel': 'Airtel Payments Bank',
    '@jio': 'Jio Payments Bank',
    '@slice': 'Slice',
    '@jupiter': 'Jupiter',
    '@fi': 'Fi Money',
    '@niyo': 'Niyo',
};

/**
 * Bank name patterns to look for in email body
 */
const BANK_NAME_PATTERNS: Array<{ pattern: RegExp; bankName: string }> = [
    { pattern: /hdfc\s*(bank)?/i, bankName: 'HDFC Bank' },
    { pattern: /icici\s*(bank)?/i, bankName: 'ICICI Bank' },
    { pattern: /axis\s*(bank)?/i, bankName: 'Axis Bank' },
    { pattern: /state\s*bank\s*(of\s*india)?|sbi/i, bankName: 'State Bank of India' },
    { pattern: /kotak\s*(mahindra)?\s*(bank)?/i, bankName: 'Kotak Mahindra Bank' },
    { pattern: /indusind\s*(bank)?/i, bankName: 'IndusInd Bank' },
    { pattern: /yes\s*(bank)?/i, bankName: 'Yes Bank' },
    { pattern: /idfc\s*(first)?\s*(bank)?/i, bankName: 'IDFC First Bank' },
    { pattern: /rbl\s*(bank)?/i, bankName: 'RBL Bank' },
    { pattern: /standard\s*chartered|sc\s*bank/i, bankName: 'Standard Chartered' },
    { pattern: /citi\s*(bank)?/i, bankName: 'Citi Bank' },
    { pattern: /american\s*express|amex/i, bankName: 'American Express' },
    { pattern: /punjab\s*national\s*bank|pnb/i, bankName: 'Punjab National Bank' },
    { pattern: /bank\s*of\s*baroda|bob\s/i, bankName: 'Bank of Baroda' },
    { pattern: /union\s*bank(\s*of\s*india)?/i, bankName: 'Union Bank of India' },
    { pattern: /federal\s*bank/i, bankName: 'Federal Bank' },
    { pattern: /hsbc/i, bankName: 'HSBC India' },
    { pattern: /dbs\s*(bank)?/i, bankName: 'DBS Bank' },
    { pattern: /jupiter/i, bankName: 'Jupiter' },
    { pattern: /slice/i, bankName: 'Slice' },
    { pattern: /fi\s*money/i, bankName: 'Fi Money' },
    { pattern: /niyo/i, bankName: 'Niyo' },
    { pattern: /paytm\s*(payments)?\s*(bank)?/i, bankName: 'Paytm Payments Bank' },
];

/**
 * InstrumentAutoService - Handles automatic detection and creation of financial instruments
 */
export class InstrumentAutoService {
    /**
     * Detect bank from email sender and body
     */
    static async detectBankFromEmail(email: CleanEmail): Promise<Bank | null> {
        let bankName: string | null = null;

        // 1. Try email domain first (most reliable)
        const fromDomain = this.extractDomainFromEmail(email.from);
        if (fromDomain && BANK_EMAIL_DOMAINS[fromDomain]) {
            bankName = BANK_EMAIL_DOMAINS[fromDomain];
            logger.debug(`[InstrumentAutoService] Detected bank from email domain: ${bankName}`);
        }

        // 2. Try extracting from email body
        if (!bankName) {
            bankName = this.extractBankFromText(email.subject + ' ' + email.cleanedBody);
            if (bankName) {
                logger.debug(`[InstrumentAutoService] Detected bank from email text: ${bankName}`);
            }
        }

        if (!bankName) {
            logger.debug(`[InstrumentAutoService] Could not detect bank from email`);
            return null;
        }

        // Get or create the bank
        return BankService.getOrCreateBank(bankName);
    }

    /**
     * Find or create a credit/debit card instrument
     */
    static async findOrCreateCard(
        userId: string,
        type: 'credit_card' | 'debit_card',
        last4: string,
        email: CleanEmail
    ): Promise<Instrument> {
        // Normalize last4
        const normalizedLast4 = last4.replace(/\D/g, '').slice(-4);

        // Try to find existing card with same last4 for this user
        const existingInstruments = await InstrumentRegistry.getUserInstruments(userId);
        const existingCard = existingInstruments.find(
            i => i.type === type && i.last4 === normalizedLast4
        );

        if (existingCard) {
            logger.debug(`[InstrumentAutoService] Found existing ${type}: ${existingCard.id} (ending ${normalizedLast4})`);
            return existingCard;
        }

        // Detect bank from email
        const bank = await this.detectBankFromEmail(email);

        // Create new instrument
        const newInstrument = await InstrumentRepository.create({
            userId,
            type,
            bankId: bank?.id,
            name: bank ? `${bank.name} ${type === 'credit_card' ? 'Credit Card' : 'Debit Card'}` : `${type === 'credit_card' ? 'Credit Card' : 'Debit Card'} ending ${normalizedLast4}`,
            identifier: `XXXX${normalizedLast4}`,
            last4: normalizedLast4,
            status: 'active',
            isPrimary: false,
            metadata: {
                autoCreated: true,
                createdFromEmail: email.id,
                createdAt: new Date().toISOString()
            }
        });

        // Clear cache to include new instrument
        InstrumentRegistry.clearCache(userId);

        logger.info(`[InstrumentAutoService] Created new ${type}: ${newInstrument.id} (ending ${normalizedLast4}, bank: ${bank?.name || 'Unknown'})`);
        return newInstrument;
    }

    /**
     * Find or create a bank account instrument
     */
    static async findOrCreateAccount(
        userId: string,
        last4: string,
        email: CleanEmail
    ): Promise<Instrument> {
        // Normalize last4
        const normalizedLast4 = last4.replace(/\D/g, '').slice(-4);

        // Try to find existing account with same last4 for this user
        const existingInstruments = await InstrumentRegistry.getUserInstruments(userId);
        const existingAccount = existingInstruments.find(
            i => i.type === 'bank_account' && i.last4 === normalizedLast4
        );

        if (existingAccount) {
            logger.debug(`[InstrumentAutoService] Found existing bank account: ${existingAccount.id} (ending ${normalizedLast4})`);
            return existingAccount;
        }

        // Detect bank from email
        const bank = await this.detectBankFromEmail(email);

        // Create new instrument
        const newInstrument = await InstrumentRepository.create({
            userId,
            type: 'bank_account' as InstrumentType,
            bankId: bank?.id,
            name: bank ? `${bank.name} Account` : `Bank Account ending ${normalizedLast4}`,
            identifier: `XXXXXX${normalizedLast4}`,
            last4: normalizedLast4,
            status: 'active',
            isPrimary: false,
            metadata: {
                autoCreated: true,
                createdFromEmail: email.id,
                createdAt: new Date().toISOString()
            }
        });

        // Clear cache
        InstrumentRegistry.clearCache(userId);

        logger.info(`[InstrumentAutoService] Created new bank account: ${newInstrument.id} (ending ${normalizedLast4}, bank: ${bank?.name || 'Unknown'})`);
        return newInstrument;
    }

    /**
     * Find or create a UPI handle instrument
     */
    static async findOrCreateUPI(
        userId: string,
        upiHandle: string,
        email: CleanEmail
    ): Promise<Instrument> {
        // Normalize UPI handle
        const normalizedHandle = upiHandle.toLowerCase().trim();

        // Try to find existing UPI handle for this user
        const existingInstruments = await InstrumentRegistry.getUserInstruments(userId);
        const existingUPI = existingInstruments.find(
            i => i.type === 'upi_handle' && i.identifier?.toLowerCase() === normalizedHandle
        );

        if (existingUPI) {
            logger.debug(`[InstrumentAutoService] Found existing UPI handle: ${existingUPI.id} (${normalizedHandle})`);
            return existingUPI;
        }

        // Try to detect bank from UPI handle suffix
        let bank: Bank | null = null;
        for (const [suffix, bankName] of Object.entries(UPI_BANK_MAPPING)) {
            if (normalizedHandle.includes(suffix)) {
                bank = await BankService.getOrCreateBank(bankName);
                break;
            }
        }

        // If no bank from UPI suffix, try email
        if (!bank) {
            bank = await this.detectBankFromEmail(email);
        }

        // Create new instrument
        const newInstrument = await InstrumentRepository.create({
            userId,
            type: 'upi_handle' as InstrumentType,
            bankId: bank?.id,
            name: normalizedHandle,
            identifier: normalizedHandle,
            status: 'active',
            isPrimary: false,
            metadata: {
                upiHandle: normalizedHandle,
                provider: this.detectUPIProvider(normalizedHandle) ?? undefined,
                autoCreated: true,
                createdFromEmail: email.id,
                createdAt: new Date().toISOString()
            }
        });

        // Clear cache
        InstrumentRegistry.clearCache(userId);

        logger.info(`[InstrumentAutoService] Created new UPI handle: ${newInstrument.id} (${normalizedHandle}, bank: ${bank?.name || 'Unknown'})`);
        return newInstrument;
    }

    /**
     * Extract bank name from text content
     */
    static extractBankFromText(text: string): string | null {
        for (const { pattern, bankName } of BANK_NAME_PATTERNS) {
            if (pattern.test(text)) {
                return bankName;
            }
        }
        return null;
    }

    /**
     * Extract domain from email address
     */
    private static extractDomainFromEmail(email: string): string | null {
        const match = email.match(/@([a-zA-Z0-9.-]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Detect UPI provider from handle
     */
    private static detectUPIProvider(handle: string): string | null {
        if (handle.includes('@ybl') || handle.includes('@axisbank')) return 'PhonePe';
        if (handle.includes('@ok') || handle.includes('@upi')) return 'GooglePay';
        if (handle.includes('@paytm')) return 'Paytm';
        if (handle.includes('@apl')) return 'AmazonPay';
        if (handle.includes('@ibl')) return 'iMobile';
        return null;
    }

    /**
     * Extract account last 4 digits from text
     */
    static extractAccountLast4(text: string): string | undefined {
        const patterns = [
            /a\/c\s*(?:no\.?|number)?[:\s]*(?:xx+|\*+|x-)?(\d{4})/i,
            /account\s*(?:no\.?|number)?[:\s]*(?:xx+|\*+|x-)?(\d{4})/i,
            /ac\s*(?:no\.?)?[:\s]*(?:xx+|\*+|x-)?(\d{4})/i,
            /(?:saving|current|salary)\s*a\/c[:\s]*(?:xx+|\*+|x-)?(\d{4})/i,
            /(?:ending|ending\s+with|ending\s+in)\s*(?:xx+|\*+|x-|no\.|card\s+no\.)?\s*(\d{4})/i,
            /card\s*(?:no\.?|number)?\s*(?:ending)?[\s:]*(?:xx+|\*+|x-)?(\d{4})/i,
            /(?:xx+|\*+|x-)(\d{4})/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return undefined;
    }

    /**
     * Extract UPI handle from text
     */
    static extractUPIHandle(text: string): string | undefined {
        // Full UPI ID pattern: user@provider
        const patterns = [
            /(?:vpa|upi|to|from)[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i,
            /([a-zA-Z0-9._-]+@(?:ybl|paytm|oksbi|okicici|okaxis|okhdfcbank|upi|apl|ibl|axisbank|sbi|hdfc|icici|kotak|indus|rbl))/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].toLowerCase();
            }
        }
        return undefined;
    }
}
