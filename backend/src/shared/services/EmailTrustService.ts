
/**
 * Email Trust Service
 * Evaluates email authenticity using SPF, DKIM, and DMARC results.
 */

export class EmailTrustService {
    /**
     * Calculate a trust score (0-3) based on authentication headers.
     * 
     * Score Meaning:
     * 3: High Trust (SPF PASS + DKIM PASS) - Valid bank email
     * 2: Medium Trust (One of SPF/DKIM PASS) - Likely valid
     * 1: Low Trust (SoftFail / None) - Manual review needed
     * 0: Untrusted (Fail / HardFail) - Reject / Flag High Risk
     */
    static calculateTrustScore(authHeader: string, from: string): number {
        if (!authHeader) return 1; // Neutral if no header (legacy/internal)

        const details = this.extractAuthDetails(authHeader);
        let score = 0;

        // SPF Check
        if (details.spf === 'pass') score += 1;
        else if (details.spf === 'softfail') score += 0.5;

        // DKIM Check
        if (details.dkim === 'pass') score += 2;
        else if (details.dkim === 'neutral') score += 0.5;

        // DMARC Bonus (if present and pass)
        if (details.dmarc === 'pass') score += 1;

        // Domain matching check (From vs SPF domain) would go here

        // Cap score at 3
        return Math.min(Math.floor(score), 3);
    }

    /**
     * Extract structured auth results from the raw header string.
     * header format example: "dkim=pass header.i=@google.com; spf=pass (google.com: domain of ...)"
     */
    static extractAuthDetails(header: string): { spf: string; dkim: string; dmarc: string } {
        const lower = header.toLowerCase();

        const result = {
            spf: 'none',
            dkim: 'none',
            dmarc: 'none'
        };

        // Extract SPF
        const spfMatch = lower.match(/spf=([a-z]+)/);
        if (spfMatch) result.spf = spfMatch[1];

        // Extract DKIM
        const dkimMatch = lower.match(/dkim=([a-z]+)/);
        if (dkimMatch) result.dkim = dkimMatch[1];

        // Extract DMARC
        const dmarcMatch = lower.match(/dmarc=([a-z]+)/);
        if (dmarcMatch) result.dmarc = dmarcMatch[1];

        return result;
    }
}
