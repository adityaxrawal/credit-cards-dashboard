export interface EmailPattern {
  bank: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  cardRegex: RegExp;
  amountRegex: RegExp;
  merchantRegex: RegExp;
  dateRegex: RegExp;
  typeKeywords: {
    debit: string[];
    credit: string[];
    reversal: string[];
  };
}

export const EMAIL_PATTERNS: EmailPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [
      /sbicard\.com$/i,
      /sbicardservices\.com$/i,
      /alerts\.sbicard\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'purchase', 'debited', 'credited'],
    cardRegex: /X{4,}(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid', 'withdrawn', 'debit'],
      credit: ['credited', 'cashback', 'refund', 'reward', 'reversal', 'credit'],
      reversal: ['reversed', 'chargeback', 'refund']
    }
  },
  {
    bank: 'HDFC',
    senderRegex: [
      /hdfcbank\.com$/i,
      /alerts\.hdfcbank\.com$/i,
      /hdfcbank\.net$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'update', 'spent', 'debited', 'credited'],
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2}|\d{2}\/\d{2}\/\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid'],
      credit: ['credited', 'cashback', 'refund', 'reward'],
      reversal: ['reversed', 'chargeback']
    }
  },
  {
    bank: 'Axis',
    senderRegex: [
      /axisbank\.com$/i,
      /alerts\.axisbank\.com$/i,
      /axis\.co\.in$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'debited', 'credited'],
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid'],
      credit: ['credited', 'cashback', 'refund', 'reward'],
      reversal: ['reversed', 'chargeback']
    }
  },
  {
    bank: 'ICICI',
    senderRegex: [
      /icicibank\.com$/i,
      /alerts\.icicibank\.com$/i,
      /icici\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'debited', 'credited', 'purchase'],
    cardRegex: /\*\*\*\*(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+(?:on|dated)/i,
    dateRegex: /(?:on|dated)\s+(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid', 'withdrawn'],
      credit: ['credited', 'cashback', 'refund', 'reward', 'deposit'],
      reversal: ['reversed', 'chargeback', 'refund']
    }
  },
  {
    bank: 'Kotak',
    senderRegex: [
      /kotak\.com$/i,
      /alerts\.kotak\.com$/i,
      /kotakbank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'debited', 'credited'],
    cardRegex: /\*\*\*\*(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /on\s+(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid'],
      credit: ['credited', 'cashback', 'refund', 'reward'],
      reversal: ['reversed', 'chargeback']
    }
  }
];

export const STATEMENT_PATTERNS: EmailPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [
      /statements\.sbicard\.com$/i,
      /sbicard\.com$/i
    ],
    subjectKeywords: ['statement', 'credit card statement', 'monthly statement', 'bill'],
    cardRegex: /X{4,}(\d{4})/,
    amountRegex: /(?:Total Due|Amount Due|Outstanding).*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    merchantRegex: /.*/, // Not applicable for statements
    dateRegex: /(?:Due Date|Payment Due).*?(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i,
    typeKeywords: {
      debit: [],
      credit: [],
      reversal: []
    }
  },
  {
    bank: 'HDFC',
    senderRegex: [
      /hdfcbank\.com$/i,
      /statements\.hdfcbank\.com$/i
    ],
    subjectKeywords: ['statement', 'credit card statement', 'monthly statement', 'bill'],
    cardRegex: /xx(\d{4})/i,
    amountRegex: /(?:Total Amount Due|Outstanding).*?INR\s?([0-9,]+\.?\d{0,2})/i,
    merchantRegex: /.*/,
    dateRegex: /(?:Due Date|Payment Due).*?(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i,
    typeKeywords: {
      debit: [],
      credit: [],
      reversal: []
    }
  },
  {
    bank: 'Axis',
    senderRegex: [
      /axisbank\.com$/i,
      /statements\.axisbank\.com$/i
    ],
    subjectKeywords: ['statement', 'credit card statement', 'monthly statement', 'bill'],
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /(?:Total Due|Amount Due).*?Rs\.?\s?([0-9,]+\.?\d{0,2})/i,
    merchantRegex: /.*/,
    dateRegex: /(?:Due Date|Payment Due).*?(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i,
    typeKeywords: {
      debit: [],
      credit: [],
      reversal: []
    }
  },
  {
    bank: 'ICICI',
    senderRegex: [
      /icicibank\.com$/i,
      /statements\.icicibank\.com$/i
    ],
    subjectKeywords: ['statement', 'credit card statement', 'monthly statement', 'bill'],
    cardRegex: /\*\*\*\*(\d{4})/,
    amountRegex: /(?:Total Amount Due|Outstanding).*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    merchantRegex: /.*/,
    dateRegex: /(?:Due Date|Payment Due).*?(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i,
    typeKeywords: {
      debit: [],
      credit: [],
      reversal: []
    }
  },
  {
    bank: 'Kotak',
    senderRegex: [
      /kotak\.com$/i,
      /statements\.kotak\.com$/i
    ],
    subjectKeywords: ['statement', 'credit card statement', 'monthly statement', 'bill'],
    cardRegex: /\*\*\*\*(\d{4})/,
    amountRegex: /(?:Total Due|Amount Due).*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    merchantRegex: /.*/,
    dateRegex: /(?:Due Date|Payment Due).*?(\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i,
    typeKeywords: {
      debit: [],
      credit: [],
      reversal: []
    }
  }
];

// Transaction categories for auto-categorization
export const TRANSACTION_CATEGORIES = {
  'Food & Dining': [
    'restaurant', 'cafe', 'food', 'dining', 'pizza', 'burger', 'coffee', 'tea',
    'swiggy', 'zomato', 'uber eats', 'dominos', 'mcdonalds', 'kfc', 'subway',
    'starbucks', 'cafe coffee day', 'barista', 'dunkin', 'taco bell'
  ],
  'Travel': [
    'airline', 'flight', 'hotel', 'booking', 'travel', 'uber', 'ola', 'taxi',
    'bus', 'train', 'metro', 'irctc', 'makemytrip', 'goibibo', 'cleartrip',
    'yatra', 'expedia', 'agoda', 'oyo', 'treebo', 'fab hotels'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'shopping', 'mall',
    'store', 'retail', 'fashion', 'clothing', 'shoes', 'electronics',
    'mobile', 'laptop', 'appliances', 'furniture', 'home decor'
  ],
  'Bills & Utilities': [
    'electricity', 'water', 'gas', 'internet', 'broadband', 'mobile bill',
    'phone bill', 'recharge', 'paytm', 'phonepe', 'gpay', 'utility',
    'insurance', 'premium', 'emi', 'loan', 'credit card bill'
  ],
  'Entertainment': [
    'movie', 'cinema', 'theatre', 'netflix', 'amazon prime', 'hotstar',
    'spotify', 'youtube', 'gaming', 'games', 'entertainment', 'music',
    'streaming', 'subscription', 'pvr', 'inox', 'multiplex'
  ],
  'Fuel': [
    'petrol', 'diesel', 'fuel', 'gas station', 'hp', 'bharat petroleum',
    'indian oil', 'reliance', 'shell', 'essar', 'filling station'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'medical', 'pharmacy', 'medicine',
    'health', 'dental', 'lab', 'diagnostic', 'apollo', 'fortis',
    'max healthcare', 'manipal', 'narayana', 'practo'
  ],
  'Groceries': [
    'grocery', 'supermarket', 'big bazaar', 'dmart', 'reliance fresh',
    'more', 'spencer', 'food bazaar', 'easyday', 'star bazaar',
    'vegetables', 'fruits', 'milk', 'bread', 'provisions'
  ],
  'Education': [
    'school', 'college', 'university', 'education', 'course', 'training',
    'tuition', 'coaching', 'books', 'stationery', 'fees', 'admission'
  ],
  'ATM Withdrawal': [
    'atm', 'cash withdrawal', 'withdrawal', 'cash'
  ]
};