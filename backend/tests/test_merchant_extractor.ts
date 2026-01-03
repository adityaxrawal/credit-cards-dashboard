
import { MerchantExtractor } from '../src/modules/transactions/services/extraction/MerchantExtractor';

const testCases = [
    {
        name: "Example 1: HDFC Credit Card via Gateway",
        body: "Rs.330.00 is debited from your HDFC Bank Credit Card ending 0364 towards PYU*Swiggy Food on 27 Dec, 2025",
        subject: "Transaction Alert",
        expected: "Swiggy Food",
        minConf: 0.9
    },
    {
        name: "Example 2: SBI Card at Zomato",
        body: "Rs.178.45 spent on your SBI Credit Card ending 7603 at ZOMATOLIMITED on 27/12/25",
        subject: "Transaction Alert",
        expected: "ZOMATOLIMITED",
        minConf: 0.8
    },
    {
        name: "Example 3: Jupiter UPI Payment (Messy)",
        body: "You paid ₹120.00 Paid to Flipkart Internet PrivaBANGALORE KAIN",
        subject: "UPI Alert",
        expected: "Flipkart Internet Priva", // Sanitizer should strip BANGALORE KAIN
        minConf: 0.9
    },
    {
        name: "Example 4: Razorpay Composite",
        body: "Your transaction at Razorpay * Netflix was successful",
        subject: "Transaction",
        expected: "Netflix", // Gateway composite
        minConf: 0.95
    },
    {
        name: "Example 5: Simple Spent At",
        body: "Spent Rs 500 at Starbucks on 12th Jan",
        subject: "Alert",
        expected: "Starbucks",
        minConf: 0.85
    }
];

const runTests = () => {
    console.log("Running MerchantExtractor Tests...\n");
    let passed = 0;

    testCases.forEach((test, idx) => {
        const candidates = MerchantExtractor.extract(test.body, test.subject);
        const best = candidates[0]; // Logic picks highest confidence

        // Check match
        const isMatch = best && best.rawName.toLowerCase() === test.expected.toLowerCase();
        const isConf = best && best.confidence >= test.minConf;

        if (isMatch && isConf) {
            console.log(`[PASS] ${test.name}`);
            passed++;
        } else {
            console.log(`[FAIL] ${test.name}`);
            console.log(`   Expected: "${test.expected}" (Conf >= ${test.minConf})`);
            console.log(`   Got:      "${best?.rawName}" (Conf: ${best?.confidence}, Source: ${best?.source})`);
        }
    });

    console.log(`\nPassed ${passed}/${testCases.length}`);
};

runTests();
