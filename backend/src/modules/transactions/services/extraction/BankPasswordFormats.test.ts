
import { BankPasswordFormats, UserProfile } from './BankPasswordFormats';

describe('BankPasswordFormats', () => {
    const mockProfile: UserProfile = {
        firstName: 'Aditya',
        lastName: 'Rawal',
        dateOfBirth: new Date('2000-05-23'), // 23 May 2000
        pan: 'ABCDE1234F',
        mobileNumber: '9876543210',
        customerId: '123456789',
        instruments: [
            { account_number_masked: 'XXXXXX1234' }, // Card 1
            { account_number_masked: 'XXXXXX5678' }  // Card 2
        ]
    };

    it('should generate DOB based passwords', () => {
        const passwords = BankPasswordFormats.generateFromProfile(mockProfile);
        const passwordValues = passwords.map(p => p.password);

        expect(passwordValues).toContain('23052000'); // DDMMYYYY
        expect(passwordValues).toContain('230500');   // DDMMYY
        expect(passwordValues).toContain('05232000'); // MMDDYYYY
        expect(passwordValues).toContain('23-05-2000'); // DD-MM-YYYY
    });

    it('should generate Name + DOB combinations', () => {
        const passwords = BankPasswordFormats.generateFromProfile(mockProfile);
        const passwordValues = passwords.map(p => p.password);

        // Name4 = ADIT
        expect(passwordValues).toContain('ADIT2305'); // NAME4 + DDMM
        expect(passwordValues).toContain('adit2305'); // name4 + ddmm (lower)
        expect(passwordValues).toContain('ADIT23052000'); // NAME4 + DDMMYYYY
        expect(passwordValues).toContain('ADIT2000'); // NAME4 + YYYY
    });

    it('should generate PAN based passwords', () => {
        const passwords = BankPasswordFormats.generateFromProfile(mockProfile);
        const passwordValues = passwords.map(p => p.password);

        // PAN4 = ABCD
        expect(passwordValues).toContain('ABCD230500'); // PAN4 + DDMMYY
        expect(passwordValues).toContain('abcd230500'); // pan4 + ddmmYY
        expect(passwordValues).toContain('ABCDE1234F'); // Full PAN
    });

    it('should generate Mobile based passwords', () => {
        const passwords = BankPasswordFormats.generateFromProfile(mockProfile);
        const passwordValues = passwords.map(p => p.password);

        // Last 4 Mobile = 3210
        expect(passwordValues).toContain('3210');
        expect(passwordValues).toContain('321023052000'); // Last4 + DDMMYYYY (Axis)
    });

    it('should generate Instrument Last 4 digits', () => {
        const passwords = BankPasswordFormats.generateFromProfile(mockProfile);
        const passwordValues = passwords.map(p => p.password);

        expect(passwordValues).toContain('1234');
        expect(passwordValues).toContain('5678');
        expect(passwordValues).toContain('ADIT1234'); // Name + Last4
    });

    it('should filter by bank name if provided', () => {
        const passwords = BankPasswordFormats.generateForBank('HDFC', mockProfile);
        // HDFC specifics should be first
        expect(passwords[0].bank).toContain('HDFC');
    });

    it('should handle missing profile data gracefully', () => {
        const minimalProfile: UserProfile = {
            firstName: 'Aditya'
        };
        const passwords = BankPasswordFormats.generateFromProfile(minimalProfile);
        // Should contain no date formats, only maybe name stuff if logic allows (logic checks for DOB mostly)
        // Name logic requires DOB for most parts.
        // It has no passwords generated if only Name is present (as logic combined Name+Date)
        expect(passwords.length).toBe(0);
    });
});
