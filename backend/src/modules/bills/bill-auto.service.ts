/**
 * Bill Auto-Generation Service
 * Detects statements in emails and auto-creates bills
 */

import { BillRepository } from '@modules/bills/bills.repository';
import logger from '@shared/utils/infrastructure/logger';
import { CleanEmailContent } from '@services/gmail/sanitize/sanitizer';

interface DetectedStatement {
    bankName: string;
    cardLast4?: string;
    billAmount: number;
    minDueAmount?: number;
    dueDate: Date;
    statementDate: Date;
    statementMonth: number;
    statementYear: number;
}

interface CreatedBill {
    id: string;
    userId: string;
    instrumentId?: string;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
}

// Statement detection patterns
const STATEMENT_PATTERNS = {
    // Subject patterns indicating a statement
    subjectPatterns: [
        /statement\s+(for|of)\s+/i,
        /your\s+.*statement/i,
        /credit\s+card\s+statement/i,
        /e-?statement/i,
        /monthly\s+statement/i,
        /account\s+statement/i,
        /billing\s+statement/i,
    ],

    // Sender domains for statement emails
    statementSenders: [
        'alerts.hdfcbank.com',
        'axisbank.com',
        'icicibank.com',
        'sbicard.com',
        'sc.com',
        'americanexpress.com',
        'indusind.com',
        'kotak.com',
        'yesbank.in',
        'rblbank.com',
    ],

    // Amount extraction patterns
    amountPatterns: [
        /total\s+(?:amount\s+)?due[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
        /amount\s+payable[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
        /outstanding\s+(?:amount|balance)[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
        /bill\s+amount[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
        /current\s+balance[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
    ],

    // Minimum due patterns
    minDuePatterns: [
        /min(?:imum)?\s+(?:amount\s+)?due[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
        /min\s+due[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
    ],

    // Due date patterns
    dueDatePatterns: [
        /due\s+(?:date|on)[:\s]+(\d{1,2}[\s\-\/]\w{3,9}[\s\-\/]\d{2,4})/i,
        /payment\s+due[:\s]+(\d{1,2}[\s\-\/]\w{3,9}[\s\-\/]\d{2,4})/i,
        /pay\s+by[:\s]+(\d{1,2}[\s\-\/]\w{3,9}[\s\-\/]\d{2,4})/i,
        /due:\s*(\d{1,2}[\s\-\/]\d{1,2}[\s\-\/]\d{2,4})/i,
    ],
};

export class BillAutoService {

    /**
     * Detect if an email is a statement email
     */
    static isStatementEmail(email: CleanEmailContent): boolean {
        // Check sender domain
        const senderDomain = email.from.split('@')[1]?.toLowerCase() || '';
        const isSenderMatch = STATEMENT_PATTERNS.statementSenders.some(
            domain => senderDomain.includes(domain.toLowerCase())
        );

        // Check subject patterns
        const isSubjectMatch = STATEMENT_PATTERNS.subjectPatterns.some(
            pattern => pattern.test(email.subject)
        );

        // Check for attachment (statements usually have PDF)
        const hasAttachment = email.hasAttachments ||
            email.subject.toLowerCase().includes('attached') ||
            email.cleanedBody.toLowerCase().includes('attached statement');

        // Statement if sender matches AND (subject matches OR has attachment)
        return isSenderMatch && (isSubjectMatch || hasAttachment);
    }

    /**
     * Extract statement details from email content
     */
    static extractStatementDetails(email: CleanEmailContent): DetectedStatement | null {
        const content = `${email.subject}\n${email.cleanedBody}`;

        // Extract bill amount
        let billAmount = 0;
        for (const pattern of STATEMENT_PATTERNS.amountPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                billAmount = parseFloat(match[1].replace(/,/g, ''));
                break;
            }
        }

        if (billAmount <= 0) {
            logger.debug('No bill amount found in statement email');
            return null;
        }

        // Extract minimum due
        let minDueAmount: number | undefined;
        for (const pattern of STATEMENT_PATTERNS.minDuePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                minDueAmount = parseFloat(match[1].replace(/,/g, ''));
                break;
            }
        }

        // Extract due date
        let dueDate: Date | null = null;
        for (const pattern of STATEMENT_PATTERNS.dueDatePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                dueDate = this.parseDueDate(match[1]);
                break;
            }
        }

        const emailDate = new Date(email.internalDate);
        // Default due date to 20 days from statement
        if (!dueDate) {
            dueDate = new Date(emailDate);
            dueDate.setDate(dueDate.getDate() + 20);
        }

        // Extract bank name from sender
        const bankName = this.extractBankName(email.from);

        // Extract card last 4 if present
        const cardMatch = content.match(/card\s+(?:ending\s+(?:in|with)|xx+)\s*(\d{4})/i);
        const cardLast4 = cardMatch ? cardMatch[1] : undefined;

        return {
            bankName,
            cardLast4,
            billAmount,
            minDueAmount,
            dueDate,
            statementDate: emailDate,
            statementMonth: emailDate.getMonth() + 1,
            statementYear: emailDate.getFullYear(),
        };
    }

    /**
     * Create a bill from detected statement
     */
    static async createBillFromStatement(
        userId: string,
        statement: DetectedStatement
    ): Promise<CreatedBill | null> {
        try {
            // Find matching instrument (credit card)
            let instrumentId: string | null = null;

            if (statement.cardLast4) {
                instrumentId = await BillRepository.findInstrumentByLast4(userId, statement.cardLast4);
            }

            // Check for duplicate bill
            const existingBillId = await BillRepository.findExistingBill(
                userId,
                instrumentId,
                statement.dueDate.getMonth() + 1,
                statement.dueDate.getFullYear()
            );

            if (existingBillId) {
                logger.info(`Bill already exists for ${statement.bankName} - ${statement.cardLast4}`);
                return null;
            }

            // Create the bill
            const bill = await BillRepository.create({
                userId,
                instrumentId,
                name: `${statement.bankName} Credit Card Statement`,
                amount: statement.billAmount,
                minDueAmount: statement.minDueAmount,
                dueDate: statement.dueDate,
                category: 'Credit Card Payment',
                autoGenerated: true,
            });

            logger.info(`Auto-created bill: ${bill.id} for ${statement.bankName} - ₹${statement.billAmount}`);

            return {
                id: bill.id,
                userId: bill.user_id,
                instrumentId: bill.instrument_id ?? undefined,
                amount: bill.amount,
                dueDate: bill.due_date,
                status: bill.status,
            };
        } catch (error) {
            logger.error('Failed to create bill from statement', error);
            return null;
        }
    }

    /**
     * Process email for auto-bill creation
     * Called from email pipeline
     */
    static async processEmailForBill(
        userId: string,
        email: CleanEmailContent
    ): Promise<CreatedBill | null> {
        // Check if it's a statement email
        if (!this.isStatementEmail(email)) {
            return null;
        }

        // Extract statement details
        const statement = this.extractStatementDetails(email);
        if (!statement) {
            return null;
        }

        // Create bill
        return this.createBillFromStatement(userId, statement);
    }

    /**
     * Parse various date formats
     */
    private static parseDueDate(dateStr: string): Date | null {
        try {
            // Try standard Date parsing
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }

            // Try DD-MMM-YYYY format
            const match = dateStr.match(/(\d{1,2})[\s\-\/](\w{3,9})[\s\-\/](\d{2,4})/);
            if (match) {
                const day = parseInt(match[1]);
                const month = this.monthNameToNumber(match[2]);
                let year = parseInt(match[3]);
                if (year < 100) year += 2000;

                if (month !== -1) {
                    return new Date(year, month, day);
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    private static monthNameToNumber(name: string): number {
        const months: Record<string, number> = {
            jan: 0, january: 0,
            feb: 1, february: 1,
            mar: 2, march: 2,
            apr: 3, april: 3,
            may: 4,
            jun: 5, june: 5,
            jul: 6, july: 6,
            aug: 7, august: 7,
            sep: 8, september: 8,
            oct: 9, october: 9,
            nov: 10, november: 10,
            dec: 11, december: 11,
        };
        return months[name.toLowerCase()] ?? -1;
    }

    private static extractBankName(sender: string): string {
        const domain = sender.split('@')[1]?.toLowerCase() || '';

        if (domain.includes('hdfc')) return 'HDFC';
        if (domain.includes('axis')) return 'Axis';
        if (domain.includes('icici')) return 'ICICI';
        if (domain.includes('sbi')) return 'SBI';
        if (domain.includes('kotak')) return 'Kotak';
        if (domain.includes('indusind')) return 'IndusInd';
        if (domain.includes('amex') || domain.includes('americanexpress')) return 'American Express';
        if (domain.includes('sc.com')) return 'Standard Chartered';
        if (domain.includes('yes')) return 'Yes Bank';
        if (domain.includes('rbl')) return 'RBL';

        return 'Unknown Bank';
    }
}
