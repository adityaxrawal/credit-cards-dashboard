
import { EmailTrustService } from '../EmailTrustService';

describe('EmailTrustService', () => {
    describe('extractAuthDetails', () => {
        it('should extract simple SPF and DKIM passes', () => {
            const header = 'dkim=pass header.i=@google.com; spf=pass (google.com: domain of ...)';
            const result = EmailTrustService.extractAuthDetails(header);

            expect(result.spf).toBe('pass');
            expect(result.dkim).toBe('pass');
        });

        it('should handle missing fields', () => {
            const header = 'spf=softfail (google.com: domain of ...)';
            const result = EmailTrustService.extractAuthDetails(header);

            expect(result.spf).toBe('softfail');
            expect(result.dkim).toBe('none');
        });

        it('should be case insensitive', () => {
            const header = 'DKIM=PASS; SPF=PASS';
            const result = EmailTrustService.extractAuthDetails(header);

            expect(result.spf).toBe('pass');
            expect(result.dkim).toBe('pass');
        });
    });

    describe('calculateTrustScore', () => {
        it('should return 3 for SPF PASS + DKIM PASS', () => {
            const header = 'dkim=pass; spf=pass';
            const score = EmailTrustService.calculateTrustScore(header, 'test@example.com');
            expect(score).toBe(3);
        });

        it('should return 2 for DKIM PASS only', () => {
            const header = 'dkim=pass; spf=softfail';
            const score = EmailTrustService.calculateTrustScore(header, 'test@example.com');
            // 2 + 0.5 = 2.5 -> floored to 2? No, floor logic is at end.
            // Wait, implementation: 
            // spf=softfail -> +0.5
            // dkim=pass -> +2
            // total = 2.5
            // Math.floor(2.5) = 2.
            expect(score).toBe(2);
        });

        it('should return 1 for No Auth Header', () => {
            const score = EmailTrustService.calculateTrustScore('', 'test@example.com');
            expect(score).toBe(1);
        });

        it('should return 0 for Failures', () => {
            const header = 'dkim=fail; spf=fail';
            const score = EmailTrustService.calculateTrustScore(header, 'test@example.com');
            expect(score).toBe(0);
        });

        it('should includes DMARC bonus', () => {
            const header = 'dkim=pass; spf=pass; dmarc=pass';
            const score = EmailTrustService.calculateTrustScore(header, 'test@example.com');
            // 2 (DKIM) + 1 (SPF) + 1 (DMARC) = 4 -> Min(4, 3) = 3
            expect(score).toBe(3);
        });
    });
});
