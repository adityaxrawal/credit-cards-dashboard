
import { extractTransactionFromEmail } from '../backend/src/services/extraction.service';
import { GmailMessage } from '../backend/src/lib/gmailClient';

// Mock data
const mockEmails: GmailMessage[] = [
  {
    id: '1',
    threadId: 't1',
    subject: 'Transaction Alert: Rs. 1,234.00 spent on your SBI Card ending 1234',
    from: 'alerts@sbi.co.in',
    date: new Date(),
    bodyText: 'Dear Customer, Rs. 1,234.00 was spent on your SBI Credit Card ending 1234 at AMAZON INDIA on 01-Nov-2023.',
    bodyHtml: '',
    snippet: 'Transaction Alert...',
  },
  {
    id: '2',
    threadId: 't2',
    subject: 'Alert: Transaction of INR 500.00 on HDFC Bank Credit Card',
    from: 'alerts@hdfcbank.net',
    date: new Date(),
    bodyText: 'Rs. 500.00 was spent on your HDFC Bank Credit Card ending 5678 towards SWIGGY on 02 Nov, 2023.',
    bodyHtml: '',
    snippet: 'Transaction Alert...',
  },
  {
    id: '3',
    threadId: 't3',
    subject: 'Transaction Alert',
    from: 'alerts@icicibank.com',
    date: new Date(),
    bodyText: 'Transaction of INR 2,000.00 has been done on your ICICI Bank Credit Card XX9012 at FLIPKART.',
    bodyHtml: '',
    snippet: 'Transaction Alert...',
  },
    {
    id: '4',
    threadId: 't4',
    subject: 'Transaction Alert',
    from: 'alerts@axisbank.com',
    date: new Date(),
    bodyText: 'INR 1,500.00 debited from Axis Bank Credit Card XX3456 at UBER RIDES.',
    bodyHtml: '',
    snippet: 'Transaction Alert...',
  }
];

async function runTest() {
  console.log('Starting extraction test...');
  
  // Mock userId
  const userId = 'test-user-id';

  for (const email of mockEmails) {
    console.log(`\nTesting email: ${email.subject}`);
    const result = await extractTransactionFromEmail(userId, email);
    console.log('Result:', JSON.stringify(result, null, 2));
  }
}

// Mock DB queries if needed (but extraction service imports them, so we might need to mock the module or ensure DB connection is not required for just parsing if we refactor)
// For now, let's see if it runs. The extraction service imports cardsQueries. 
// If it fails due to DB connection, we will need to mock it.

runTest().catch(console.error);
