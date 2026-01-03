/**
 * BankPasswordFormats - Standard password format generators
 * 
 * Banks use standard password formats for encrypted PDF statements:
 * - HDFC: DOB in DDMMYYYY format, Name + Date combos
 * - ICICI: First 4 chars of PAN + DOB in DDMMYY
 * - SBI: Customer ID, Name + Date
 * - Axis: Last 4 digits of mobile + DOB
 * - Kotak: DOB in DDMMYYYY
 * - AMEX: Cardholder's DOB in DDMMYYYY
 */

export interface UserProfile {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    pan?: string;
    mobileNumber?: string;
    customerId?: string;
    instruments?: Array<{ account_number_masked?: string }>; // For card/account last 4
}

export interface GeneratedPassword {
    password: string;
    source: string;
    bank?: string;
}

export class BankPasswordFormats {
    /**
     * Generate all possible bank-standard passwords from user profile
     */
    static generateFromProfile(profile: UserProfile): GeneratedPassword[] {
        const passwords: GeneratedPassword[] = [];

        // 1. DOB formats (Base)
        if (profile.dateOfBirth) {
            const dob = profile.dateOfBirth;
            const dd = String(dob.getDate()).padStart(2, '0');
            const mm = String(dob.getMonth() + 1).padStart(2, '0');
            const yyyy = String(dob.getFullYear());
            const yy = yyyy.slice(-2);

            // DDMMYYYY - HDFC, Kotak, AMEX, many others
            passwords.push({ password: `${dd}${mm}${yyyy}`, source: 'DOB (DDMMYYYY)', bank: 'HDFC/Kotak/AMEX' });
            passwords.push({ password: `${dd}${mm}${yy}`, source: 'DOB (DDMMYY)' });
            passwords.push({ password: `${mm}${dd}${yyyy}`, source: 'DOB (MMDDYYYY)' });
            passwords.push({ password: `${yyyy}${mm}${dd}`, source: 'DOB (YYYYMMDD)' });
            passwords.push({ password: `${dd}-${mm}-${yyyy}`, source: 'DOB (DD-MM-YYYY)' });
            passwords.push({ password: `${dd}/${mm}/${yyyy}`, source: 'DOB (DD/MM/YYYY)' });

            // 2. Name + Date Combinations (Common: HDFC, SBI, Axis, ICICI)
            // ADIT2305, ADIT2000
            if (profile.firstName) {
                const name4 = profile.firstName.trim().substring(0, 4);
                if (name4.length >= 3) { // At least 3 chars
                    const nameUpper = name4.toUpperCase();
                    const nameLower = name4.toLowerCase();
                    const nameTitle = nameUpper.charAt(0) + nameLower.slice(1);

                    // Name + DDMM
                    passwords.push({ password: `${nameUpper}${dd}${mm}`, source: 'NAME4 + DDMM (UPPER)', bank: 'SBI/HDFC' });
                    passwords.push({ password: `${nameLower}${dd}${mm}`, source: 'NAME4 + DDMM (lower)' });
                    passwords.push({ password: `${nameTitle}${dd}${mm}`, source: 'NAME4 + DDMM (Title)' });

                    // Name + DDMMYYYY
                    passwords.push({ password: `${nameUpper}${dd}${mm}${yyyy}`, source: 'NAME4 + DDMMYYYY (UPPER)' });
                    passwords.push({ password: `${nameLower}${dd}${mm}${yyyy}`, source: 'NAME4 + DDMMYYYY (lower)' });

                    // Name + YYYY
                    passwords.push({ password: `${nameUpper}${yyyy}`, source: 'NAME4 + YYYY' });
                }
            }
        }

        // 3. PAN-based passwords
        if (profile.pan && profile.dateOfBirth) {
            const pan4 = profile.pan.substring(0, 4).toUpperCase();
            const dob = profile.dateOfBirth;
            const dd = String(dob.getDate()).padStart(2, '0');
            const mm = String(dob.getMonth() + 1).padStart(2, '0');
            const yy = String(dob.getFullYear()).slice(-2);
            const yyyy = String(dob.getFullYear());

            passwords.push({ password: `${pan4}${dd}${mm}${yy}`, source: 'PAN4 + DDMMYY', bank: 'ICICI' });
            passwords.push({ password: `${pan4.toLowerCase()}${dd}${mm}${yy}`, source: 'pan4 + DDMMYY' });
            passwords.push({ password: `${pan4}${dd}${mm}${yyyy}`, source: 'PAN4 + DDMMYYYY' });
            passwords.push({ password: `${pan4}${dd}${mm}`, source: 'PAN4 + DDMM' });

            // Full PAN
            passwords.push({ password: profile.pan.toUpperCase(), source: 'PAN (UPPER)' });
            passwords.push({ password: profile.pan.toLowerCase(), source: 'PAN (lower)' });
        }

        // 4. Mobile-based passwords
        if (profile.mobileNumber) {
            const last4 = profile.mobileNumber.slice(-4);

            passwords.push({ password: last4, source: 'Mobile last 4' });

            // With DOB
            if (profile.dateOfBirth) {
                const dob = profile.dateOfBirth;
                const dd = String(dob.getDate()).padStart(2, '0');
                const mm = String(dob.getMonth() + 1).padStart(2, '0');
                const yyyy = String(dob.getFullYear());

                passwords.push({ password: `${last4}${dd}${mm}${yyyy}`, source: 'Mobile last 4 + DOB', bank: 'Axis' });
            }
        }

        // 5. Customer ID
        if (profile.customerId) {
            passwords.push({ password: profile.customerId, source: 'Customer ID', bank: 'SBI' });
        }

        // 6. Instrument Last 4 Digits (Credit Cards)
        if (profile.instruments && profile.instruments.length > 0) {
            for (const inst of profile.instruments) {
                const last4 = inst.account_number_masked?.slice(-4);
                if (last4 && last4.length === 4 && /^\d+$/.test(last4)) {
                    passwords.push({ password: last4, source: 'Card/Acc Last 4' });

                    // Sometimes combined with name: ADIT1234
                    if (profile.firstName) {
                        const name4 = profile.firstName.trim().substring(0, 4).toUpperCase();
                        passwords.push({ password: `${name4}${last4}`, source: 'NAME4 + LAST4' });
                        passwords.push({ password: `${name4.toLowerCase()}${last4}`, source: 'name4 + last4' });
                    }
                }
            }
        }

        // Filter out empty or too short passwords
        return passwords.filter(p => p.password && p.password.length >= 4);
    }

    /**
     * Get common static passwords (user-agnostic)
     */
    static getCommonPasswords(): GeneratedPassword[] {
        return [
            { password: 'password', source: 'Common default' },
            { password: '123456', source: 'Common default' },
            { password: '1234', source: 'Common default' },
            { password: '', source: 'No password' },
        ];
    }

    /**
     * Generate passwords for a specific bank
     */
    static generateForBank(bank: string, profile: UserProfile): GeneratedPassword[] {
        const allPasswords = this.generateFromProfile(profile);

        // Filter for bank-specific passwords first
        const bankSpecific = allPasswords.filter(p =>
            p.bank?.toLowerCase().includes(bank.toLowerCase())
        );

        if (bankSpecific.length > 0) {
            return [...bankSpecific, ...allPasswords.filter(p => !bankSpecific.includes(p))];
        }

        return allPasswords;
    }
}
