
export class UPIParser {

    /**
     * Extracts a VPA from text.
     * Patterns: 
     * - "paid to example@okaxis"
     * - "UPI usage at example@ybl"
     */
    static extractVPA(text: string): string | null {
        // Broad VPA regex: user@handle
        // Must be at least 3 chars user, 2 chars handle
        // Filter out email addresses somewhat by context keyowrds or just structure?
        // UPI handles don't have top-level domains like .com usually, but some banks use them?
        // Actually usually just @okaxis, @okhdfc, @ybl, @paytm, @icici

        // Regex: 
        // [a-zA-Z0-9.-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}
        // But excluding common email domains if possible?
        // Let's rely on finding standard UPI handles.

        const vpaRegex = /\b([a-zA-Z0-9.-]+@[a-zA-Z][a-zA-Z0-9]+)\b/g;

        const matches = text.match(vpaRegex);
        if (!matches) return null;

        // Filter out likely emails (end in .com, .net, .org, .co.in)
        // Most UPI handles do NOT have dots in the handle part (suffix)
        // e.g. @okaxis is valid. @gmail.com is email.
        // Exception: @upi (generic)

        const candidates = matches.filter(m => {
            const parts = m.split('@');
            if (parts.length !== 2) return false;
            const handle = parts[1].toLowerCase();

            // Reject common email TLDs
            if (handle.includes('.')) {
                // Check if it ends with common TLDs
                if (/\.(com|net|org|edu|gov|io|co|in|us|uk)$/i.test(handle)) return false;
            }
            return true;
        });

        return candidates.length > 0 ? candidates[0] : null;
    }

    /**
     * Maps a VPA to a likely Merchant Name.
     */
    static getMerchantFromVPA(vpa: string): string | null {
        if (!vpa) return null;

        const lowerVpa = vpa.toLowerCase();

        // Dictionary of known VPA prefixes/matches
        const vpaMap: Record<string, string> = {
            'swiggy': 'Swiggy',
            'zomato': 'Zomato',
            'uber': 'Uber',
            'ola': 'Ola',
            'flipkart': 'Flipkart',
            'amazon': 'Amazon',
            'razorpay': 'Razorpay',
            'bharatpe': 'BharatPe',
            'paytm': 'Paytm',
            'googlepay': 'Google Pay',
            'phonepe': 'PhonePe',
            'zerodha': 'Zerodha',
            'groww': 'Groww',
            'blinkit': 'Blinkit',
            'dunzo': 'Dunzo',
            'bigbasket': 'BigBasket',
            'jio': 'Jio',
            'airtel': 'Airtel',
            'vi': 'Vi',
            'bescom': 'BESCOM'
        };

        for (const [key, name] of Object.entries(vpaMap)) {
            if (lowerVpa.includes(key)) {
                return name;
            }
        }

        // Heuristic: user part of VPA might be merchant
        // e.g. "starbucks@hdfc" -> "Starbucks"
        const userPart = lowerVpa.split('@')[0];
        if (userPart.length > 3 && !/^\d+$/.test(userPart)) {
            // Remove numbers if mixed? "starbucks123" -> "starbucks"
            const name = userPart.replace(/[0-9.-]/g, ' ').trim();
            if (name.length > 2) {
                // Capitalize
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
        }

        return null;
    }
}
