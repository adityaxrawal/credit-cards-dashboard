import { RegexCache, BankParserPatterns } from '../utils/regexCache';

const testCases = [
    // POSITIVE CASES (Should Match)
    { text: "ending in 1234", expected: "1234" },
    { text: "Card XX1234", expected: "1234" },
    { text: "Credit Card ending 4321", expected: "4321" },
    { text: "Card No: XX8888", expected: "8888" },
    { text: "last 4 digits 9999", expected: "9999" },
    { text: "your card ************1111", expected: "1111" },

    // NEGATIVE CASES (Should NOT Match)
    { text: "Account 12345678", expected: null },
    { text: "Ac 1234", expected: null },
    { text: "A/C 1234", expected: null },
    { text: "Order 1234", expected: null },
    { text: "Ref 1234", expected: null },
    { text: "OTP 1234", expected: null },
    { text: "Rs. 1234", expected: null },
    { text: "Phone 9876543210", expected: null },
    { text: "random number 1234 inside text", expected: null }
];

function extractCardDigits(text: string): string | null {
    const patterns = [
        BankParserPatterns.CARD_XX_DIGITS,
        BankParserPatterns.CARD_ENDING,
        BankParserPatterns.CARD_NUMBER,
        BankParserPatterns.CARD_MASKED,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

console.log("=== Verifying Card Number Regex Logic ===");
let passed = 0;
let failed = 0;

for (const test of testCases) {
    const result = extractCardDigits(test.text);
    if (result === test.expected) {
        console.log(`[PASS] "${test.text}" -> ${result}`);
        passed++;
    } else {
        console.error(`[FAIL] "${test.text}" -> Expected ${test.expected}, Got ${result}`);
        failed++;
    }
}

console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
if (failed > 0) process.exit(1);
