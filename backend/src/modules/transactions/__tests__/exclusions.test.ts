
import { EnhancedRuleClassifier } from '../services/classification/EnhancedRuleClassifier';
import { CleanEmail } from '@shared/types/transaction.types';

describe('EnhancedRuleClassifier - Exclusions', () => {

    const createMockEmail = (subject: string, body: string): CleanEmail => ({
        id: 'msg_123',
        subject,
        cleanedBody: body,
        from: 'alerts@bank.com',
        internalDate: new Date().getTime(),
        hasAttachments: false,
        attachments: []
    });

    describe('checkExclusions', () => {
        it('should exclude OTP emails', () => {
            const email = createMockEmail('OTP for Transaction', 'Your One Time Password is 123456');
            const result = EnhancedRuleClassifier.checkExclusions(email);
            expect(result.isExcluded).toBe(true);
            expect(result.matchedPattern).toMatch(/global_exclusion|OTP_EXCLUSION/);
        });

        it('should exclude Login Alerts', () => {
            const email = createMockEmail('New Device Detected', 'Login alert for your account');
            const result = EnhancedRuleClassifier.checkExclusions(email);
            expect(result.isExcluded).toBe(true);
        });

        it('should exclude Statement Ready notifications', () => {
            const email = createMockEmail('Statement Available', 'Your monthly statement is ready to view');
            const result = EnhancedRuleClassifier.checkExclusions(email);
            expect(result.isExcluded).toBe(true);
        });

        it('should exclude Declined Transactions', () => {
            const email = createMockEmail('Transaction Declined', 'Your payment of Rs 500 failed due to insufficient funds');
            const result = EnhancedRuleClassifier.checkExclusions(email);
            expect(result.isExcluded).toBe(true);
        });

        it('should NOT exclude Valid Transactions', () => {
            const email = createMockEmail('Transaction Alert', 'Rs 500 debit from your account for Swiggy');
            const result = EnhancedRuleClassifier.checkExclusions(email);
            expect(result.isExcluded).toBe(false);
        });
    });

    describe('classify - Pending/Failed Logic', () => {
        it('should reject Payment Pending emails', () => {
            // These contain "processing" or "pending" which are now in PENDING_FAILED_PATTERNS
            const email = createMockEmail('Payment Pending', 'Your payment of Rs 1000 is unavailable or processing');
            const result = EnhancedRuleClassifier.classify(email);

            // If excluded via pattern exclusion list, it won't match the transaction pattern
            // So checks should return non_financial or null (if minimal confidence not met) or unclassified

            // OR if pattern matches but has explicit exclusions, scorePattern returns null
            // So classify should return non_financial or unclassified (financial unknown)

            // In this case, "Payment Pending" might match noise or generic patterns
            // Just verifying it's NOT a valid confirmed transaction
            if (result && result.type !== 'non_financial' && result.type !== 'unclassified') {
                // Fail if it thinks it is a valid transaction
                expect(result.type).toBe('non_financial');
            }
        });

        it('should NOT classify Job Offers as Salary', () => {
            const email = createMockEmail('Job Offer: Senior Engineer', 'We are pleased to offer you a salary of Rs 25,00,000 per annum');
            const result = EnhancedRuleClassifier.classify(email);

            // Should NOT be 'salary'
            if (result && result.type === 'salary') {
                expect(result.type).not.toBe('salary');
            }
        });
    });
});
