/**
 * Merchant category codes for common merchant types
 */
export const MERCHANT_CATEGORIES: Record<string, { displayName: string; category: string }> = {
    // E-commerce
    amazon: { displayName: 'Amazon', category: 'Shopping' },
    flipkart: { displayName: 'Flipkart', category: 'Shopping' },
    myntra: { displayName: 'Myntra', category: 'Shopping' },
    ajio: { displayName: 'AJIO', category: 'Shopping' },
    meesho: { displayName: 'Meesho', category: 'Shopping' },
    nykaa: { displayName: 'Nykaa', category: 'Shopping' },

    // Food & Dining
    swiggy: { displayName: 'Swiggy', category: 'Food & Dining' },
    zomato: { displayName: 'Zomato', category: 'Food & Dining' },
    dominos: { displayName: "Domino's Pizza", category: 'Food & Dining' },
    mcdonalds: { displayName: "McDonald's", category: 'Food & Dining' },
    starbucks: { displayName: 'Starbucks', category: 'Food & Dining' },

    // Travel
    makemytrip: { displayName: 'MakeMyTrip', category: 'Travel' },
    goibibo: { displayName: 'Goibibo', category: 'Travel' },
    irctc: { displayName: 'IRCTC', category: 'Travel' },
    uber: { displayName: 'Uber', category: 'Travel' },
    ola: { displayName: 'Ola', category: 'Travel' },
    rapido: { displayName: 'Rapido', category: 'Travel' },

    // Entertainment & Streaming
    netflix: { displayName: 'Netflix', category: 'Entertainment' },
    hotstar: { displayName: 'Disney+ Hotstar', category: 'Entertainment' },
    prime: { displayName: 'Amazon Prime', category: 'Entertainment' },
    spotify: { displayName: 'Spotify', category: 'Entertainment' },
    youtube: { displayName: 'YouTube Premium', category: 'Entertainment' },

    // Utilities & Bills
    jio: { displayName: 'Jio', category: 'Utilities' },
    airtel: { displayName: 'Airtel', category: 'Utilities' },
    vodafone: { displayName: 'Vodafone', category: 'Utilities' },
    bsnl: { displayName: 'BSNL', category: 'Utilities' },

    // Grocery
    bigbasket: { displayName: 'BigBasket', category: 'Groceries' },
    grofers: { displayName: 'Blinkit', category: 'Groceries' },
    blinkit: { displayName: 'Blinkit', category: 'Groceries' },
    zepto: { displayName: 'Zepto', category: 'Groceries' },
    dmart: { displayName: 'DMart', category: 'Groceries' },

    // Healthcare
    pharmeasy: { displayName: 'PharmEasy', category: 'Healthcare' },
    netmeds: { displayName: 'Netmeds', category: 'Healthcare' },
    oneMg: { displayName: '1mg', category: 'Healthcare' },
    practo: { displayName: 'Practo', category: 'Healthcare' },

    // Education
    udemy: { displayName: 'Udemy', category: 'Education' },
    coursera: { displayName: 'Coursera', category: 'Education' },
    byjus: { displayName: "BYJU'S", category: 'Education' },
    unacademy: { displayName: 'Unacademy', category: 'Education' },
};
