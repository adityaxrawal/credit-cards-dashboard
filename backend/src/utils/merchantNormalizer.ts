/**
 * Merchant Normalizer
 * 
 * Normalizes merchant names from various formats to standard names.
 * Based on the spec's 50+ merchant database.
 */

// Merchant normalization database - maps variations to canonical names
const MERCHANT_DATABASE: Record<string, string[]> = {
    // Food & Dining
    'SWIGGY': ['SWIGGY', 'SWIGGY FOOD', 'SWIGGY INSTAMART', 'CAS*SWIGGY', 'PAYU*SWIGGY', 'BUNDL*SWIGGY'],
    'ZOMATO': ['ZOMATO', 'ZOMATO ONLINE', 'ZOMATO ORDER', 'PAYU*ZOMATO', 'BLINKIT'],
    'UBER EATS': ['UBER EATS', 'UBEREATS'],
    'DOMINOS': ['DOMINOS', 'DOMINO', 'DOMINOS PIZZA', 'JUBILANT FOODWORKS'],
    'MCDONALDS': ['MCDONALDS', 'MCDONALD', 'MCD', 'MCDONALD\'S'],
    'BURGER KING': ['BURGER KING', 'BK', 'BURGER KING INDIA'],
    'KFC': ['KFC', 'KENTUCKY FRIED'],
    'STARBUCKS': ['STARBUCKS', 'STARBUCKS COFFEE', 'TATA STARBUCK'],
    'CAFE COFFEE DAY': ['CAFE COFFEE DAY', 'CCD', 'COFFEE DAY'],

    // Travel & Transportation
    'UBER': ['UBER', 'UBER INDIA', 'UBER INDIA SYSTEM', 'UBER TRIP', 'UBER*'],
    'OLA': ['OLA', 'OLA CABS', 'ANI TECHNOLOGIES'],
    'RAPIDO': ['RAPIDO', 'RAPIDO BIKE'],
    'INDIGO': ['INDIGO', 'INDIGO AIRLINE', 'INTERGLOBE AVIATION', '6E'],
    'AIR INDIA': ['AIR INDIA', 'AIRINDIA', 'AI*'],
    'SPICEJET': ['SPICEJET', 'SPICE JET'],
    'VISTARA': ['VISTARA', 'TATA SIA'],
    'MAKEMYTRIP': ['MAKEMYTRIP', 'MMT', 'MAKE MY TRIP'],
    'GOIBIBO': ['GOIBIBO', 'GO IBIBO'],
    'CLEARTRIP': ['CLEARTRIP', 'CLEAR TRIP'],
    'BOOKING.COM': ['BOOKING', 'BOOKING.COM', 'BOOKINGCOM'],
    'OYO': ['OYO', 'OYO ROOMS', 'ORAVEL'],
    'IRCTC': ['IRCTC', 'INDIAN RAILWAY', 'RAILWAY'],

    // Shopping & E-commerce
    'AMAZON': ['AMAZON', 'AMAZON PAY', 'AMAZON PRIME', 'AMZ*', 'AMZN*', 'AMAZON.IN'],
    'FLIPKART': ['FLIPKART', 'FLIPKART P', 'FLIPKART PRIVATE', 'FK*'],
    'MYNTRA': ['MYNTRA', 'MYNTRA DESIGNS'],
    'AJIO': ['AJIO', 'RELIANCE AJIO'],
    'MEESHO': ['MEESHO', 'FASHNEAR'],
    'NYKAA': ['NYKAA', 'NYKAA FASHION', 'NYKAA E-RETAIL'],
    'RELIANCE': ['RELIANCE', 'RELIANCE RETAIL', 'RELIANCE DIGITAL', 'JIO MART', 'JIOMART'],
    'DMART': ['DMART', 'D MART', 'AVENUE SUPERMARTS'],
    'BIG BAZAAR': ['BIG BAZAAR', 'BIGBAZAAR', 'FUTURE RETAIL'],
    'CROMA': ['CROMA', 'INFINITI RETAIL'],

    // Entertainment & Subscriptions
    'NETFLIX': ['NETFLIX', 'NETFLIX.COM', 'NETFLIX INC'],
    'AMAZON PRIME': ['AMAZON PRIME', 'PRIME VIDEO', 'AMAZON PRIME VIDEO'],
    'HOTSTAR': ['HOTSTAR', 'DISNEY HOTSTAR', 'DISNEY+', 'DISNEY PLUS'],
    'YOUTUBE': ['YOUTUBE', 'YOUTUBE INC', 'GOOGLE YOUTUBE', 'YOUTUBE PREMIUM'],
    'SPOTIFY': ['SPOTIFY', 'SPOTIFY AB', 'SPOTIFY PREMIUM'],
    'APPLE': ['APPLE', 'APPLE.COM', 'APPLE INC', 'ITUNES', 'APP STORE'],
    'GOOGLE': ['GOOGLE', 'GOOGLE PLAY', 'GOOGLE ONE', 'GOOGLE*', 'GOOGLE SERVICES'],
    'BOOKMYSHOW': ['BOOKMYSHOW', 'BOOK MY SHOW', 'BMS'],
    'PVR': ['PVR', 'PVR CINEMAS', 'PVR INOX'],
    'INOX': ['INOX', 'INOX LEISURE'],

    // Finance & Investment
    'ZERODHA': ['ZERODHA', 'ZERODHA BROKING'],
    'GROWW': ['GROWW', 'NEXTBILLION'],
    'UPSTOX': ['UPSTOX', 'RKSV'],
    'LINKEDIN': ['LINKEDIN', 'IND*LINKEDIN', 'LINKEDIN CORP'],
    'PAYTM': ['PAYTM', 'PAYTM PAYMENTS', 'ONE97'],
    'PHONEPE': ['PHONEPE', 'PHONE PE'],
    'GPAY': ['GPAY', 'GOOGLE PAY', 'GOOGLEPAY'],

    // Utilities & Services
    'AIRTEL': ['AIRTEL', 'BHARTI AIRTEL', 'AIRTEL PAYMENTS'],
    'JIO': ['JIO', 'RELIANCE JIO', 'JIO PAYMENTS'],
    'VODAFONE': ['VODAFONE', 'VODAFONE IDEA', 'VI'],
    'BSNL': ['BSNL', 'BHARAT SANCHAR'],
    'BESCOM': ['BESCOM', 'BANGALORE ELECTRICITY'],
    'TATA POWER': ['TATA POWER', 'TATAPOWER'],

    // Fuel & Auto
    'INDIAN OIL': ['INDIAN OIL', 'IOCL', 'INDIANOIL'],
    'BHARAT PETROLEUM': ['BHARAT PETROLEUM', 'BPCL', 'BP'],
    'HINDUSTAN PETROLEUM': ['HINDUSTAN PETROLEUM', 'HPCL', 'HP'],
    'SHELL': ['SHELL', 'SHELL INDIA'],
};

// Build reverse lookup map for O(1) normalization
const REVERSE_LOOKUP: Map<string, string> = new Map();
for (const [canonical, variations] of Object.entries(MERCHANT_DATABASE)) {
    for (const variant of variations) {
        REVERSE_LOOKUP.set(variant.toUpperCase(), canonical);
    }
}

// Prefixes to strip
const STRIP_PREFIXES = ['PAYU*', 'CAS*', 'AMZ*', 'AMZN*', 'BUNDL*', 'FK*', 'UBER*', 'GOOGLE*', '6E'];

// Suffixes to strip
const STRIP_SUFFIXES = [
    'PVT LTD', 'PRIVATE LIMITED', 'PRIVATE LTD', 'PVT', 'LTD', 'LIMITED',
    'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'LLC', 'CO',
    'INDIA', 'INDIA PVT', 'INDIA PRIVATE', 'SYSTEMS', 'SYSTEM', 'SERVICES', 'SERVICE'
];

/**
 * Normalize a merchant name to its canonical form
 */
export function normalizeMerchant(rawMerchant: string): string {
    if (!rawMerchant || rawMerchant.trim().length === 0) {
        return 'UNKNOWN';
    }

    let merchant = rawMerchant.toUpperCase().trim();

    // Strip known prefixes
    for (const prefix of STRIP_PREFIXES) {
        if (merchant.startsWith(prefix)) {
            merchant = merchant.substring(prefix.length).trim();
            break;
        }
    }

    // Strip known suffixes
    for (const suffix of STRIP_SUFFIXES) {
        if (merchant.endsWith(suffix)) {
            merchant = merchant.substring(0, merchant.length - suffix.length).trim();
        }
    }

    // Clean up special characters but keep alphanumeric and spaces
    merchant = merchant.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Direct lookup
    if (REVERSE_LOOKUP.has(merchant)) {
        return REVERSE_LOOKUP.get(merchant)!;
    }

    // Fuzzy matching: Check if any known merchant is contained
    for (const [canonical, variations] of Object.entries(MERCHANT_DATABASE)) {
        for (const variant of variations) {
            if (merchant.includes(variant.toUpperCase()) || variant.toUpperCase().includes(merchant)) {
                return canonical;
            }
        }
    }

    // Try matching first word only (handles "SWIGGY INSTAMART ON 15-11-24" type cases)
    const firstWord = merchant.split(' ')[0];
    if (firstWord.length >= 3 && REVERSE_LOOKUP.has(firstWord)) {
        return REVERSE_LOOKUP.get(firstWord)!;
    }

    // Return cleaned merchant name if no match
    return merchant || 'UNKNOWN';
}

/**
 * Get category for a merchant
 */
export function getCategoryForMerchant(merchant: string): string {
    const normalized = normalizeMerchant(merchant);

    const CATEGORY_MAP: Record<string, string[]> = {
        'Food & Dining': ['SWIGGY', 'ZOMATO', 'UBER EATS', 'DOMINOS', 'MCDONALDS', 'BURGER KING', 'KFC', 'STARBUCKS', 'CAFE COFFEE DAY'],
        'Travel': ['UBER', 'OLA', 'RAPIDO', 'INDIGO', 'AIR INDIA', 'SPICEJET', 'VISTARA', 'MAKEMYTRIP', 'GOIBIBO', 'CLEARTRIP', 'BOOKING.COM', 'OYO', 'IRCTC'],
        'Shopping': ['AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO', 'NYKAA', 'RELIANCE', 'DMART', 'BIG BAZAAR', 'CROMA'],
        'Entertainment': ['NETFLIX', 'AMAZON PRIME', 'HOTSTAR', 'YOUTUBE', 'SPOTIFY', 'APPLE', 'GOOGLE', 'BOOKMYSHOW', 'PVR', 'INOX'],
        'Finance': ['ZERODHA', 'GROWW', 'UPSTOX', 'LINKEDIN', 'PAYTM', 'PHONEPE', 'GPAY'],
        'Utilities': ['AIRTEL', 'JIO', 'VODAFONE', 'BSNL', 'BESCOM', 'TATA POWER'],
        'Fuel': ['INDIAN OIL', 'BHARAT PETROLEUM', 'HINDUSTAN PETROLEUM', 'SHELL'],
    };

    for (const [category, merchants] of Object.entries(CATEGORY_MAP)) {
        if (merchants.includes(normalized)) {
            return category;
        }
    }

    return 'Other';
}

/**
 * Calculate confidence penalty for merchant extraction
 * Returns 0 if merchant is known, -20 if unknown
 */
export function getMerchantConfidencePenalty(merchant: string): number {
    const normalized = normalizeMerchant(merchant);
    return normalized === 'UNKNOWN' ? -20 : 0;
}
