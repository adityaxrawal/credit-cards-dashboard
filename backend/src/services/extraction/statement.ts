import { PdfParser } from './pdfParser';
import { StatementExtractor } from './statement.extractor';
import { CleanEmailContent } from '../sanitize/sanitizer';

// Types for Transaction result (aligning with new schema)
import { ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../types/transaction.types';

export class StatementProcessor {

    // Config for Password Logic (In real app, fetch from User Profile)
    private static readonly PROFILE = {
        firstName: 'ADITYA',
        dobDDMM: '2305',
        dobDDMMYYYY: '23052000', // inferred from existing code
        pan: ''
    };

    /**
     * Process a Statement Email
     */
    static async process(
        email: CleanEmailContent,
        attachmentBuffer: Buffer,
        knownCardLast4?: string
    ): Promise<ExtractedTransaction[]> {

        // 1. Generate Candidate Passwords
        const passwords = this.generatePasswords(knownCardLast4);

        // 2. Parse PDF
        // We need to modify PdfParser to accept dynamic passwords or we just rely on its internal list?
        // Best to try our specific ones first.
        // Since we can't easily change PdfParser signature in this step without a separate tool call,
        // we'll assume we can call a new method or we'll wrap it. 
        // BUT checking PdfParser code: it uses a hardcoded list.
        // I will use PdfParser.parsePdf directly if I can, or I should update PdfParser.
        // For now, let's assume I'll update PdfParser in next step. I'll pass passwords to a new method `parseWithPasswords`.

        const pdfData = await PdfParser.parseWithPasswords(attachmentBuffer, passwords);

        if (!pdfData || !pdfData.text) {
            console.warn('[StatementProcessor] Failed to parse PDF or empty text');
            return [];
        }

        // 3. Extract Transactions from Text
        // Use the existing (but wrapped) logic
        const extractor = new StatementExtractor();
        // Default bank name? We can guess from Sender or just generic.
        const bankName = this.guessBank(email.from);

        // We need an exact date for transactions. PDF usually has a range.
        // StatementExtractor needs a default date for year inference.
        const defaultDate = email.date.toISOString().split('T')[0];

        const rawRows = extractor.extract(pdfData.text, bankName, defaultDate);

        // 4. Map to Standard ExtractedTransaction
        return rawRows.map(row => ({
            type: TransactionType.STATEMENT_TRANSACTION,
            direction: TransactionDirection.DEBIT, // Usually debit for statement lines
            amount: row.amount,
            currency: 'INR',
            merchant: row.merchant,
            transactionDate: new Date(row.date),
            instrumentType: InstrumentType.CREDIT_CARD, // Logic assumes credit card statements for now
            instrumentId: knownCardLast4,
            fingerprint: `${row.date}-${row.amount}-${row.merchant}`
        }));
    }

    private static generatePasswords(cardLast4?: string): string[] {
        const p = this.PROFILE;
        const candidates: string[] = [];

        // Pattern 1: FIRST4NAME + DOB (DDMM)
        if (p.firstName && p.dobDDMM) {
            candidates.push((p.firstName.slice(0, 4) + p.dobDDMM).toUpperCase());
            candidates.push((p.firstName.slice(0, 4) + p.dobDDMM).toLowerCase());
        }

        // Pattern 2: FIRST4NAME + LAST4CARD
        if (p.firstName && cardLast4) {
            candidates.push((p.firstName.slice(0, 4) + cardLast4).toUpperCase());
            candidates.push((p.firstName.slice(0, 4) + cardLast4).toLowerCase());
        }

        // Pattern 3: DOB (DDMMYYYY)
        if (p.dobDDMMYYYY) {
            candidates.push(p.dobDDMMYYYY);
        }

        // Add existing known ones just in case
        // candidates.push('ADIT2305'); 

        return [...new Set(candidates)];
    }

    private static guessBank(sender: string): string {
        if (sender.includes('hdfc')) return 'HDFC';
        if (sender.includes('sbi')) return 'SBI';
        if (sender.includes('axis')) return 'Axis';
        if (sender.includes('icici')) return 'ICICI';
        if (sender.includes('amex')) return 'Amex';
        return 'Unknown Bank';
    }
}
