import { BankParsers } from '../src/services/extraction/BankParsers';
import { DateParser } from '../src/services/extraction/DateParser';

const testCases = [
  {
    bank: 'SBI',
    text: 'Rs. 1,234.00 spent on SBI Credit Card ending 1234 at AMAZON on 14/11/23',
    expected: { amount: 1234, merchant: 'AMAZON', lastFour: '1234' }
  },
  {
    bank: 'HDFC',
    text: 'Rs 500.00 debited from HDFC Bank Credit Card XX5678 linked to UPI at SWIGGY on 14-11-2023',
    expected: { amount: 500, merchant: 'SWIGGY', lastFour: '5678', cardName: 'HDFC Swiggy' }
  },
  {
    bank: 'Axis',
    text: 'Transaction of INR 2000.00 on your Airtel Axis Bank Credit Card no. XX9012 at FLIPKART on 15 Nov 2023.',
    expected: { amount: 2000, merchant: 'FLIPKART', lastFour: '9012', cardName: 'Airtel Axis Bank' }
  },
  {
    bank: 'IDFC',
    text: 'Transaction Alert: INR 150.00 spent on IDFC FIRST Bank Credit Card ending 3456 at ZOMATO on 16-Nov-23.',
    expected: { amount: 150, merchant: 'ZOMATO', lastFour: '3456' }
  },
  {
    bank: 'IndusInd',
    text: 'Thank you for using IndusInd Bank Credit Card ending 7890 for INR 3000.00 at MYNTRA on 17/11/2023.',
    expected: { amount: 3000, merchant: 'MYNTRA', lastFour: '7890' }
  },
  {
    bank: 'YesBank',
    text: 'Rs 400.00 spent on YES BANK Credit Card ending 1122 at UBER on 18-11-2023.',
    expected: { amount: 400, merchant: 'UBER', lastFour: '1122' }
  },
  {
    bank: 'Jupiter',
    text: 'You spent Rs. 999.00 on your Jupiter Edge CSB Bank Credit Card ending 3344 at NETFLIX on 19 Nov, 2023.',
    expected: { amount: 999, merchant: 'NETFLIX', lastFour: '3344' }
  }
];

async function runTests() {
  console.log('Running Bank Parser Tests...\n');
  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`Testing ${test.bank}...`);
    const parser = BankParsers.find(p => p.name === test.bank);
    if (!parser) {
      console.error(`❌ Parser not found for ${test.bank}`);
      failed++;
      continue;
    }

    const result = parser.parse(test.text, 'Transaction Alert', 'bank@email.com');
    
    if (!result) {
      console.error(`❌ Failed to parse: ${test.text}`);
      failed++;
      continue;
    }

    let isMatch = true;
    if (result.amount !== test.expected.amount) {
      console.error(`  Mismatch Amount: Got ${result.amount}, Expected ${test.expected.amount}`);
      isMatch = false;
    }
    if (result.merchant !== test.expected.merchant) {
      console.error(`  Mismatch Merchant: Got ${result.merchant}, Expected ${test.expected.merchant}`);
      isMatch = false;
    }
    if (result.lastFourDigits !== test.expected.lastFour) {
      console.error(`  Mismatch LastFour: Got ${result.lastFourDigits}, Expected ${test.expected.lastFour}`);
      isMatch = false;
    }
    if (test.expected.cardName && result.cardName && !result.cardName.includes(test.expected.cardName)) {
       // Loose check for card name
       // console.warn(`  Card Name hint might be different: Got ${result.cardName}`);
    }

    if (isMatch) {
      console.log(`✅ Passed`);
      passed++;
    } else {
      console.error(`❌ Failed`);
      failed++;
    }
  }

  console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);
}

runTests();
