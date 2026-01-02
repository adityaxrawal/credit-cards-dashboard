import { Instrument } from '@shared/types/transaction.types';

export interface PasswordContext {
    firstName?: string;
    lastName?: string;
    dob?: Date;
    pan?: string;
    instruments?: Instrument[];
    mobile?: string;
    email?: string;
}

export class BankPDFPasswordResolver {
    /**
     * Generate potential passwords for bank statements based on user context
     */
    static generateCandidates(context: PasswordContext): string[] {
        const candidates: Set<string> = new Set();

        const { firstName, lastName, dob, pan, mobile } = context;

        // Helper to format dates
        const dateFormats = (date: Date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = String(date.getFullYear());
            const yy = yyyy.slice(-2);

            return { dd, mm, yyyy, yy };
        };

        // 1. Name + Date Combinations (Common: HDFC, SBI, Axis, ICICI)
        // Usually First 4 chars of Name (Upper) + DDMM or DDMMYYYY
        if (firstName && dob) {
            const { dd, mm, yyyy, yy } = dateFormats(dob);
            const namePart = firstName.substring(0, 4).toUpperCase();

            candidates.add(`${namePart}${dd}${mm}`); // ADIT2305
            candidates.add(`${namePart}${dd}${mm}${yy}`); // ADIT230500
            candidates.add(`${namePart}${dd}${mm}${yyyy}`); // ADIT23052000
            candidates.add(`${namePart.toLowerCase()}${dd}${mm}`); // adit2305
        }

        // 2. PAN + Date (Common: Axis, others)
        // Usually First 4 chars of Name + DDMM of DOB? Or PAN specific?
        // Some use PAN (Upper) + DDMMYYYY
        if (pan && dob) {
            const { dd, mm, yyyy } = dateFormats(dob);
            candidates.add(`${pan.toUpperCase()}${dd}${mm}${yyyy}`);
            candidates.add(`${pan.toUpperCase()}`);
        }

        // 3. Instrument Specific (Credit Cards usually use last 4 digits logic internally)
        // But some banks use Last 4 Card + Last 4 Mobile
        if (context.instruments && context.instruments.length > 0) {
            for (const inst of context.instruments) {
                // Check instrument specific logic using account_number_masked
                // e.g. XXXXXX1234 -> 1234
                const last4 = inst.account_number_masked?.slice(-4);
                if (last4 && last4.length === 4) {
                    candidates.add(last4);
                    if (mobile && mobile.length >= 4) {
                        const last4Mobile = mobile.slice(-4);
                        candidates.add(`${last4}${last4Mobile}`);
                    }
                }
            }
        }

        // 4. DOB only
        if (dob) {
            const { dd, mm, yyyy } = dateFormats(dob);
            candidates.add(`${dd}${mm}${yyyy}`);
            candidates.add(`${dd}${mm}${yyyy.slice(-2)}`);
        }

        // 5. Mobile only
        if (mobile) {
            candidates.add(mobile);
        }

        return Array.from(candidates);
    }
}
