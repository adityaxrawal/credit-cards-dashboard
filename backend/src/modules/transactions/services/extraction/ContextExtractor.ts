/**
 * ContextExtractor - New Architecture Transaction Detection
 * 
 * Extracts contextual information from transaction text:
 * - Transaction location
 * - Balance after transaction
 * - Payee/Payer names
 */

export interface ExtractedContext {
    location?: string;
    balanceAfter?: number;
    payeeName?: string;
    payerName?: string;
    city?: string;
    country?: string;
}

export class ContextExtractor {
    // ============================================
    // Location Patterns
    // ============================================

    private static readonly LOCATION_PATTERNS: RegExp[] = [
        // "at MUMBAI" or "Location: Mumbai"
        /(?:at|location|place|city)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        // "POS at XYZ Store, Mumbai"
        /(?:pos\s+at|merchant)[:\s]+[^,]+,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        // International: "at Amazon US" or "at London, UK"
        /at\s+[^,\n]+,?\s+([A-Z]{2,})/i,
    ];

    private static readonly CITY_PATTERNS: RegExp[] = [
        /(?:mumbai|delhi|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad|jaipur|lucknow|kanpur|nagpur|indore|thane|bhopal|patna|vadodara|ghaziabad|ludhiana|coimbatore|agra|madurai|nashik|faridabad|meerut|rajkot|varanasi|srinagar|aurangabad|dhanbad|amritsar|allahabad|ranchi|howrah|gwalior|jabalpur|vijayawada|jodhpur|raipur|kota|chandigarh|guwahati|solapur|hubli|mysore|tiruchirappalli|bareilly|aligarh|tiruppur|moradabad|jalandhar|bhubaneswar|salem|warangal|guntur|bhiwandi|saharanpur|gorakhpur|bikaner|amravati|noida|jamshedpur|bhilai|cuttack|firozabad|kochi|nellore|bhavnagar|dehradun|durgapur|asansol|nanded|kolhapur|ajmer|akola|gulbarga|jamnagar|ujjain|loni|siliguri|jhansi|ulhasnagar|jammu|sangli|mangalore|erode|belgaum|ambattur|tirunelveli|malegaon|gaya|jalgaon|udaipur|maheshtala|davanagere|kozhikode|kurnool|rajpur|rajahmundry|bokaro|south\s+dumdum|bellary|patiala|gopalpur|agartala|bhagalpur|muzaffarnagar|bhatpara|panihati|latur|dhule|rohtak|korba|bhilwara|berhampur|muzaffarpur|ahmednagar|mathura|kollam|avadi|kadapa|kamarhati|bilaspur|sambalpur|shahjahanpur|satara|bijapur|rampur|shimoga|chandrapur|junagadh|thrissur|alwar|bardhaman|kulti|nizamabad|parbhani|tumkur|khammam|ozhukarai|bihar|darbhanga|ichalkaranji|tirupati|karnal|bathinda|rampur|panaji)/i,
    ];

    // ============================================
    // Balance Patterns
    // ============================================

    private static readonly BALANCE_PATTERNS: RegExp[] = [
        // "Available Balance: INR 12,345.67" or "Avail Bal: Rs. 12345"
        /(?:avail(?:able)?\s+bal(?:ance)?|bal(?:ance)?\s+after|closing\s+bal(?:ance)?|running\s+bal(?:ance)?)[:\s]*(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
        // "Balance: 12,345.67 INR"
        /(?:balance|bal)[:\s]*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)?/i,
    ];

    // ============================================
    // Payee/Payer Patterns
    // ============================================

    private static readonly PAYEE_PATTERNS: RegExp[] = [
        // "to XYZ" or "Paid to XYZ"
        /(?:paid\s+to|transferred\s+to|sent\s+to|to\s+beneficiary)[:\s]+([A-Za-z][A-Za-z0-9\s]+)/i,
        // "Beneficiary: XYZ"
        /(?:beneficiary|payee|recipient)[:\s]+([A-Za-z][A-Za-z0-9\s]+)/i,
        // "at Merchant Name"
        /(?:at|merchant)[:\s]+([A-Z][A-Za-z0-9\s&']+)/i,
    ];

    private static readonly PAYER_PATTERNS: RegExp[] = [
        // "from XYZ" or "Received from XYZ"
        /(?:received\s+from|transferred\s+from|from\s+sender)[:\s]+([A-Za-z][A-Za-z0-9\s]+)/i,
        // "Sender: XYZ"
        /(?:sender|payer|remitter)[:\s]+([A-Za-z][A-Za-z0-9\s]+)/i,
    ];

    /**
     * Extract all contextual information from text
     */
    static extractAll(text: string): ExtractedContext {
        const context: ExtractedContext = {};

        // Extract location
        for (const pattern of this.LOCATION_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                context.location = match[1].trim();
                break;
            }
        }

        // Try to detect city if location not found
        if (!context.location) {
            for (const pattern of this.CITY_PATTERNS) {
                const match = text.match(pattern);
                if (match) {
                    context.city = match[0].trim();
                    context.location = context.city;
                    break;
                }
            }
        }

        // Extract balance after transaction
        for (const pattern of this.BALANCE_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const balanceStr = match[1].replace(/,/g, '');
                const balanceNum = parseFloat(balanceStr);
                if (!isNaN(balanceNum) && balanceNum >= 0) {
                    context.balanceAfter = balanceNum;
                    break;
                }
            }
        }

        // Extract payee name
        for (const pattern of this.PAYEE_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const payee = match[1].trim();
                // Filter out common noise words
                if (!this.isNoiseWord(payee)) {
                    context.payeeName = payee.substring(0, 100); // Limit length
                    break;
                }
            }
        }

        // Extract payer name
        for (const pattern of this.PAYER_PATTERNS) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const payer = match[1].trim();
                if (!this.isNoiseWord(payer)) {
                    context.payerName = payer.substring(0, 100);
                    break;
                }
            }
        }

        return context;
    }

    /**
     * Check if text is a noise word to filter out
     */
    private static isNoiseWord(text: string): boolean {
        const noiseWords = [
            'your', 'the', 'account', 'bank', 'card', 'transaction', 'payment',
            'amount', 'balance', 'available', 'reference', 'id', 'number'
        ];
        return noiseWords.some(w => text.toLowerCase() === w);
    }

    /**
     * Extract location from text
     */
    static extractLocation(text: string): string | undefined {
        return this.extractAll(text).location;
    }

    /**
     * Extract balance after transaction
     */
    static extractBalanceAfter(text: string): number | undefined {
        return this.extractAll(text).balanceAfter;
    }
}
