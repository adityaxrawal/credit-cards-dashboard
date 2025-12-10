
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { CreditCardMailDetector } from '../src/services/CreditCardMailDetector';
import { OllamaService } from '../src/services/ollama.service';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyML() {
    const fixturePath = process.argv[2] || path.join(__dirname, '../fixtures/hdfc_debit.eml');

    if (!fs.existsSync(fixturePath)) {
        console.error(`Fixture not found: ${fixturePath}`);
        process.exit(1);
    }

    console.log(`Testing ML on: ${fixturePath}`);
    const rawEmail = fs.readFileSync(fixturePath, 'utf-8');
    // Extract body from EML (simple split on double newline)
    const bodyContent = rawEmail.split('\n\n').slice(1).join('\n\n');

    // Mock Gmail Message structure
    const mockMessage: any = {
        id: 'test-msg-id',
        threadId: 'test-thread-id',
        snippet: bodyContent.substring(0, 100),
        payload: {
            headers: [
                { name: 'Subject', value: 'Alert: Rs. 1,299.00 debited from HDFC Bank Card ending 1234' }, // Simplified parser
                { name: 'From', value: 'alerts@hdfcbank.net' }
            ],
            body: {
                data: Buffer.from(bodyContent).toString('base64')
            }
        }
    };

    try {
        // Check Ollama Health
        console.log('Checking Ollama health...');
        const healthy = await OllamaService.healthCheck();
        if (!healthy) {
            console.error('Ollama is not healthy/connected. Skipping test.');
            process.exit(1);
        }

        console.log('Running Detection...');
        const result = await CreditCardMailDetector.detect(mockMessage);

        console.log('\n--- ML Result ---');
        console.log(JSON.stringify(result, null, 2));

        // Assertion
        if (result.isTransaction && result.merchant?.toLowerCase().includes('amazon') && result.amount === 1299) {
            console.log('\n✅ Verification PASSED: Detected correct Merchant and Amount.');
            process.exit(0);
        } else {
            console.error('\n❌ Verification FAILED: Incorrect extraction.');
            if (!result.isTransaction) console.error('Expected isTransaction=true');
            if (!result.merchant?.toLowerCase().includes('amazon')) console.error(`Expected merchant Amazon, got ${result.merchant}`);
            if (result.amount !== 1299) console.error(`Expected amount 1299, got ${result.amount}`);
            process.exit(1);
        }

    } catch (err) {
        console.error('Test failed with error:', err);
        process.exit(1);
    }
}

verifyML();
