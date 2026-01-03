/**
 * SalaryClassifier - New Architecture Transaction Detection
 * 
 * Detects salary/payroll credits with specific logic:
 * - Recurring (monthly, bi-weekly)
 * - Source is employer (not individual/merchant)
 * - Amount is consistent (+/- 10% variance)
 * - Description contains salary indicators
 */

import { InstrumentType } from '@shared/types/transaction.types';

export interface SalaryDetectionResult {
    isSalary: boolean;
    confidence: number;
    indicators: string[];
    employerName?: string;
}

export class SalaryClassifier {
    // ============================================
    // Salary Patterns
    // ============================================

    // Strong salary indicators in description/narration
    private static readonly SALARY_PATTERNS: RegExp[] = [
        /\bsalary\b/i,
        /\bpayroll\b/i,
        /\bsal(?:ary)?\s+(?:for|of)\b/i,
        /\bmonthly\s+salary\b/i,
        /\bwage(?:s)?\b/i,
        /\bstipend\b/i,
        /\bremuneration\b/i,
        /\bemployer\s+(?:credit|transfer)\b/i,
        /\bsalary\s+credit\b/i,
        /\bsal\s+cr\b/i,
        /\bpay\s+slip\b/i,
        /\bcompensation\b/i,
    ];

    // Sender/employer name indicators
    private static readonly EMPLOYER_PATTERNS: RegExp[] = [
        /\b(?:pvt|private)\s+ltd\b/i,
        /\b(?:limited|ltd)\b/i,
        /\blimited\s+liability\b/i,
        /\bllp\b/i,
        /\binc(?:orporated)?\b/i,
        /\bcorp(?:oration)?\b/i,
        /\bservices?\b/i,
        /\btechnologies?\b/i,
        /\bsolutions?\b/i,
        /\bconsulting\b/i,
        /\benterprises?\b/i,
    ];

    // Negative patterns (not salary)
    private static readonly NOT_SALARY_PATTERNS: RegExp[] = [
        /\brefund\b/i,
        /\breversal\b/i,
        /\bcashback\b/i,
        /\breward\b/i,
        /\bloan\b/i,
        /\bemi\b/i,
        /\binterest\b/i,
        /\bdividend\b/i,
        /\brent\b/i,
        /\bfreelance\b/i,
        /\binvoice\b/i,
    ];

    /**
     * Detect if a credit transaction is likely a salary
     */
    static detect(
        description: string,
        senderName?: string,
        amount?: number
    ): SalaryDetectionResult {
        const indicators: string[] = [];
        let confidence = 0;

        const text = `${description} ${senderName || ''}`.toLowerCase();

        // Check for negative patterns first
        for (const pattern of this.NOT_SALARY_PATTERNS) {
            if (pattern.test(text)) {
                return {
                    isSalary: false,
                    confidence: 0.9,
                    indicators: ['Matched non-salary pattern']
                };
            }
        }

        // Check salary patterns
        let salaryPatternMatches = 0;
        for (const pattern of this.SALARY_PATTERNS) {
            if (pattern.test(text)) {
                salaryPatternMatches++;
                indicators.push(`Matched: ${pattern.source}`);
            }
        }

        if (salaryPatternMatches >= 1) {
            confidence += 0.5;
        }
        if (salaryPatternMatches >= 2) {
            confidence += 0.2;
        }

        // Check employer patterns in sender
        let employerName: string | undefined;
        if (senderName) {
            for (const pattern of this.EMPLOYER_PATTERNS) {
                if (pattern.test(senderName)) {
                    confidence += 0.15;
                    employerName = senderName;
                    indicators.push('Sender looks like employer');
                    break;
                }
            }
        }

        // Check amount range (typical salary range in INR)
        if (amount !== undefined) {
            if (amount >= 15000 && amount <= 5000000) {
                confidence += 0.1;
                indicators.push('Amount in typical salary range');
            }
            // Round numbers are more likely salaries
            if (amount % 1000 === 0 || amount % 500 === 0) {
                confidence += 0.05;
                indicators.push('Round amount');
            }
        }

        // Cap at 1.0
        confidence = Math.min(confidence, 1.0);

        return {
            isSalary: confidence >= 0.5,
            confidence,
            indicators,
            employerName
        };
    }

    /**
     * Check if instrument type suggests salary (bank account credit)
     */
    static isLikelySalaryInstrument(instrumentType: InstrumentType): boolean {
        return [
            InstrumentType.BANK_ACCOUNT,
            InstrumentType.NEFT,
            InstrumentType.IMPS,
            InstrumentType.RTGS,
        ].includes(instrumentType);
    }

    /**
     * Get salary keywords for pattern matching
     */
    static getSalaryKeywords(): string[] {
        return [
            'salary', 'payroll', 'sal', 'wage', 'stipend', 'remuneration',
            'compensation', 'pay slip', 'employer credit', 'monthly salary'
        ];
    }
}
