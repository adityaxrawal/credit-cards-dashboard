export interface MerchantRule {
    canonicalName: string;
    aliases: string[];
    fuzzyPatterns: string[];
    category: string;
}

export const MERCHANT_RULES: MerchantRule[] = [
    // === FOOD & GROCERY ===
    {
        canonicalName: 'Swiggy',
        aliases: ['swiggy', 'swiggy bangalore', 'swiggy sas', 'swiggy upi', 'bundl technologies'],
        fuzzyPatterns: ['swiggy', 'bundl tech'],
        category: 'Food Delivery'
    },
    {
        canonicalName: 'Zomato',
        aliases: ['zomato', 'zomato media', 'zomato ltd', 'zomato pay'],
        fuzzyPatterns: ['zomato'],
        category: 'Food Delivery'
    },
    {
        canonicalName: 'Blinkit',
        aliases: ['blinkit', 'blinkit pay', 'grofers', 'grofers india'],
        fuzzyPatterns: ['blinkit', 'grofers'],
        category: 'Grocery'
    },
    {
        canonicalName: 'Zepto',
        aliases: ['zepto', 'kiranakart'],
        fuzzyPatterns: ['zepto', 'kiranakart'],
        category: 'Grocery'
    },
    {
        canonicalName: 'Swiggy Instamart',
        aliases: ['swiggy instamart', 'instamart'],
        fuzzyPatterns: ['instamart'],
        category: 'Grocery'
    },
    {
        canonicalName: 'BigBasket',
        aliases: ['bigbasket', 'supermarket grocery supplies'],
        fuzzyPatterns: ['bigbasket'],
        category: 'Grocery'
    },

    // === TRAVEL & COMMUTE ===
    {
        canonicalName: 'Uber',
        aliases: ['uber', 'uber india', 'uber bv', 'uber trip', 'uber ride'],
        fuzzyPatterns: ['uber'],
        category: 'Travel'
    },
    {
        canonicalName: 'Ola',
        aliases: ['ola', 'ola cabs', 'ani technologies', 'olamoney'],
        fuzzyPatterns: ['ola cabs', 'ani tech'],
        category: 'Travel'
    },
    {
        canonicalName: 'Rapido',
        aliases: ['rapido', 'roppen transportation'],
        fuzzyPatterns: ['rapido'],
        category: 'Travel'
    },
    {
        canonicalName: 'IRCTC',
        aliases: ['irctc', 'indian railway', 'irctc ipay'],
        fuzzyPatterns: ['irctc', 'indian rail'],
        category: 'Travel'
    },
    {
        canonicalName: 'MakeMyTrip',
        aliases: ['makemytrip', 'mmt', 'makemytrip india'],
        fuzzyPatterns: ['makemytrip'],
        category: 'Travel'
    },

    // === SHOPPING ===
    {
        canonicalName: 'Amazon',
        aliases: ['amazon', 'amazon seller services', 'amazon pay', 'amazon.in', 'amzn'],
        fuzzyPatterns: ['amazon', 'amzn'],
        category: 'Shopping'
    },
    {
        canonicalName: 'Flipkart',
        aliases: ['flipkart', 'flipkart internet', 'flipkart pay'],
        fuzzyPatterns: ['flipkart'],
        category: 'Shopping'
    },
    {
        canonicalName: 'Myntra',
        aliases: ['myntra', 'myntra designs'],
        fuzzyPatterns: ['myntra'],
        category: 'Shopping'
    },
    {
        canonicalName: 'Ajio',
        aliases: ['ajio', 'reliance retail'],
        fuzzyPatterns: ['ajio'],
        category: 'Shopping'
    },

    // === UTILITIES ===
    {
        canonicalName: 'Jio',
        aliases: ['jio', 'reliance jio', 'jio prepaid', 'jio fiber'],
        fuzzyPatterns: ['reliance jio', 'jio'],
        category: 'Utilities'
    },
    {
        canonicalName: 'Airtel',
        aliases: ['airtel', 'bharti airtel', 'airtel payments bank'],
        fuzzyPatterns: ['airtel'],
        category: 'Utilities'
    },
    {
        canonicalName: 'Vi',
        aliases: ['vodafone', 'idea', 'vi', 'vodafone idea'],
        fuzzyPatterns: ['vodafone idea', 'vi'],
        category: 'Utilities'
    },
    {
        canonicalName: 'BESCOM',
        aliases: ['bescom', 'bangalore electricity'],
        fuzzyPatterns: ['bescom'],
        category: 'Utilities'
    },

    // === PAYMENTS & WALLETS ===
    {
        canonicalName: 'CRED',
        aliases: ['cred', 'dreamplug', 'cred club'],
        fuzzyPatterns: ['cred'],
        category: 'Credit Card Bill'
    },
    {
        canonicalName: 'Paytm',
        aliases: ['paytm', 'one97 communications', 'paytm wallet'],
        fuzzyPatterns: ['paytm'],
        category: 'Wallet' // Context dependent, but good default
    },
    {
        canonicalName: 'PhonePe',
        aliases: ['phonepe', 'phonepe private limited'],
        fuzzyPatterns: ['phonepe'],
        category: 'UPI'
    },
    {
        canonicalName: 'Google Pay',
        aliases: ['gpay', 'google pay', 'google india digital'],
        fuzzyPatterns: ['gpay', 'google pay'],
        category: 'UPI'
    },
    {
        canonicalName: 'Razorpay',
        aliases: ['razorpay', 'razorpay software'],
        fuzzyPatterns: ['razorpay'],
        category: 'Payment Gateway'
    },
    {
        canonicalName: 'BillDesk',
        aliases: ['billdesk', 'indiaideas'],
        fuzzyPatterns: ['billdesk'],
        category: 'Payment Gateway'
    }
];
