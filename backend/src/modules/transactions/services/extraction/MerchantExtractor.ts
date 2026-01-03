export interface ExtractionCandidate {
    rawName: string;
    confidence: number;
    source: string;
}

export class MerchantExtractor {

    private static PATTERNS = {
        // 1. GATEWAY COMPOSITE (Highest Confidence)
        // Matches: "Razorpay * Netflix", "PAYU: Swiggy"
        // Fix: Added '\s+on' to terminator group
        GATEWAY_COMPOSITE: [
            { regex: /(?:razorpay|payu|pyu|ccavenue|billdesk|cashfree)\s*[\*:]\s*([a-z0-9\s.&'-]+?)(?:\s+was|\s+is|\.|\s+on|$)/i, conf: 0.95, type: 'gateway_composite' }
        ],

        // 2. STRICT PREFIX (High Confidence)
        // Matches: "Paid to Zomato", "Sent to Swiggy", "Debited ... towards Swiggy"
        // Fix: Added '*' and ':' to allowed chars just in case
        STRICT_PREFIX: [
            { regex: /(?:paid|sent|transfer)\s+to\s+([a-z0-9\s.&'*:-]+?)(?:\s+using|\s+on|\s+via|\s+from|\.|$)/i, conf: 0.9, type: 'paid_to' },
            { regex: /debited\s+from.+?\s+towards\s+([a-z0-9\s.&'*:-]+?)(?:\s+on|\s+using|\.|$)/i, conf: 0.9, type: 'towards_merchant' }
        ],

        // 3. SPENT AT/ON (Medium-High)
        // Matches: "Spent Rs 100 at Starbucks", "Spent on Card at Zomato"
        SPENT_AT: [
            { regex: /spent\s+(?:Rs\.?|INR)?\s*[\d,.]+\s+(?:at|on)\s+([a-z0-9\s.&'-]+?)(?:\s+on|\s+using|\s+via|\.|$)/i, conf: 0.85, type: 'spent_at_amount' },
            { regex: /spent\s+on.+?\s+at\s+([a-z0-9\s.&'-]+?)(?:\s+on|\.|$)/i, conf: 0.85, type: 'spent_on_card_at' },
            { regex: /purchase\s+(?:at|from)\s+([a-z0-9\s.&'-]+?)(?:\s+on|\s+amounting|\.|$)/i, conf: 0.8, type: 'purchase_at' }
        ],

        // 4. POS/CARD INDICATORS (Medium)
        POS_INDICATOR: [
            { regex: /at\s+([a-z0-9\s.&'-]+?)\s+(?:pos|terminal|store|outlet)/i, conf: 0.8, type: 'pos_suffix' },
            { regex: /info:\s*([a-z0-9\s.&'-]+?)\s*\/[\d\s]+(?:\/|$)/i, conf: 0.8, type: 'statement_info' }
        ],

        // 5. SUBJECT SPECIFIC (Medium)
        SUBJECT_PATTERNS: [
            { regex: /transaction\s+(?:alert|update).+?\s+at\s+([a-z0-9\s.&'-]+)/i, conf: 0.75, type: 'subject_at' },
            { regex: /debit\s+alert.+?\s+for\s+([a-z0-9\s.&'-]+)/i, conf: 0.7, type: 'subject_for' }
        ]
    };

    private static NOISE_TOKENS = [
        'private limited', 'pvt ltd', 'ltd', 'limited', 'llp', 'inc', 'corp', 'services', 'technologies',
        'solutions', 'enterprises', 'store', 'shop', 'mart', 'india', 'bangalore', 'mumbai', 'delhi',
        'gurgaon', 'hyderabad', 'pune', 'chennai', 'kolkata', 'noida', 'purchase', 'payment', 'transaction',
        'bank', 'upi', 'neft', 'imps', 'rtgs'
    ];

    static extract(text: string, subject?: string): ExtractionCandidate[] {
        const candidates: ExtractionCandidate[] = [];
        const normalizedText = this.preProcess(text);
        const normalizedSubject = subject ? this.preProcess(subject) : '';

        // A. Subject Harvesting
        if (normalizedSubject) {
            this.runPatterns(normalizedSubject, this.PATTERNS.SUBJECT_PATTERNS, candidates);
            this.runPatterns(normalizedSubject, this.PATTERNS.GATEWAY_COMPOSITE, candidates);
            // Also try strict prefix on subject
            this.runPatterns(normalizedSubject, this.PATTERNS.STRICT_PREFIX, candidates);
        }

        // B. Body Harvesting
        this.runPatterns(normalizedText, this.PATTERNS.GATEWAY_COMPOSITE, candidates);
        this.runPatterns(normalizedText, this.PATTERNS.STRICT_PREFIX, candidates);
        this.runPatterns(normalizedText, this.PATTERNS.SPENT_AT, candidates);
        this.runPatterns(normalizedText, this.PATTERNS.POS_INDICATOR, candidates);

        // C. Fallback: Loose 'at' regex
        const looseMatch = normalizedText.match(/\sat\s+([a-z0-9\s.&'-]{3,25}?)(?:\s+on\s+\d|\.|$)/i);
        if (looseMatch && looseMatch[1]) {
            this.addCandidate(candidates, looseMatch[1], 0.3, 'loose_at');
        }

        return this.deduplicateAndClean(candidates);
    }

    private static runPatterns(text: string, patterns: Array<{ regex: RegExp, conf: number, type: string }>, list: ExtractionCandidate[]) {
        for (const p of patterns) {
            const match = text.match(p.regex);
            if (match && match[1]) {
                this.addCandidate(list, match[1], p.conf, p.type);
            }
        }
    }

    private static addCandidate(list: ExtractionCandidate[], raw: string, conf: number, source: string) {
        const cleaned = this.cleanName(raw);
        if (this.isValidCandidate(cleaned)) {
            list.push({ rawName: cleaned, confidence: conf, source });
        }
    }

    // --- STAGE A & D: Sanitization & Filtering ---

    private static preProcess(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    public static cleanName(raw: string): string {
        let name = raw.trim();

        // 1. Remove common noise prefixes/suffixes
        const suffixes = ['private limited', 'pvt ltd', 'ltd', 'limited', 'llp', 'inc', 'corp', 'services', 'technologies', 'solutions'];
        const lower = name.toLowerCase();

        for (const suffix of suffixes) {
            // Check if name ends with suffix (with word boundary)
            // Or if suffix is attached (CASE: ZOMATOLIMITED) - Dangerous?
            // "ZOMATOLIMITED" -> "ZOMATO". 
            // We can check if name ends with suffix case-insensitive.
            if (lower.endsWith(suffix)) {
                // Remove it
                name = name.slice(0, name.length - suffix.length).trim();
                break; // One suffix usually
            }
        }

        // 2. Remove Location Suffixes
        // Refined regex to handle attached strings "PrivaBANGALORE" -> "Priva"
        const cities = 'mumbai|bangalore|delhi|gurgaon|pune|chennai|kolkata|noida|india|ind|kar|mh';
        const locationRegex = new RegExp(`(?:\\s+|(?<=[a-z]))(?:${cities})\\b.*$`, 'i');
        name = name.replace(locationRegex, '');

        // 3. Remove trailing special chars
        name = name.replace(/[.,\-:*]+$/, '');

        // 4. Remove Gateway Prefix if captured (Safe cleanup)
        const gatewayPrefix = /^(?:razorpay|payu|pyu|ccavenue|billdesk|cashfree)\s*[\*:]\s*/i;
        name = name.replace(gatewayPrefix, '');

        return name.trim();
    }

    private static isValidCandidate(name: string): boolean {
        if (name.length < 3) return false;
        if (name.length > 50) return false;

        const lower = name.toLowerCase();

        // Blocklist checks
        if (lower.includes('credit card')) return false;
        if (lower.includes('debit card')) return false;
        if (lower.includes('account ending')) return false;
        if (lower.includes('transaction')) return false;
        if (/^\d+$/.test(lower)) return false; // All numbers

        return true;
    }

    private static deduplicateAndClean(list: ExtractionCandidate[]): ExtractionCandidate[] {
        const unique = new Map<string, ExtractionCandidate>();

        for (const item of list) {
            const key = item.rawName.toLowerCase();
            const existing = unique.get(key);

            if (!existing || item.confidence > existing.confidence) {
                unique.set(key, item);
            }
        }

        return Array.from(unique.values()).sort((a, b) => b.confidence - a.confidence);
    }
}
