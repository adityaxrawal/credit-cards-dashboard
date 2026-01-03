
import { UniversalTransactionPipeline, universalPipeline } from '../src/modules/transactions/services/pipeline/UniversalTransactionPipeline';
import { InstrumentAutoService } from '../src/modules/cards/instrument-auto.service';
import { CleanEmail, SimplifiedEmail } from '../src/shared/types/transaction.types';
import logger from '../src/shared/utils/infrastructure/logger';
import { query } from '../src/shared/database/db';
import * as crypto from 'crypto';

const mockFetchContents = async () => Buffer.from('');

const testPipelineReal = async (userId: string) => {
    console.log("Starting End-to-End Pipeline Test...\n");

    const email1: SimplifiedEmail = {
        messageId: "msg_001_e2e_" + Date.now(),
        internalDate: new Date().getTime(),
        subject: "Transaction Alert",
        from: "alerts@hdfcbank.net",
        snippet: "Rs.330.00 debited...",
        body: "Rs.330.00 is debited from your HDFC Bank Credit Card ending 0364 towards PYU*Swiggy Food on 27 Dec, 2025.",
        authResults: "pass"
    };

    const jobId = crypto.randomUUID();
    console.log(`[TEST 1] Processing: ${email1.body}`);
    const res1 = await universalPipeline.processEmail(userId, email1, jobId, mockFetchContents as any);
    console.log(`Result 1: Status=${res1.status}, TxnId=${res1.transactionId}`);

    const email2: SimplifiedEmail = {
        messageId: "msg_002_e2e_" + Date.now(),
        internalDate: new Date().getTime(),
        subject: "Transaction Alert",
        from: "alerts@sbi.co.in",
        snippet: "Rs.178.45 spent...",
        body: "Rs.178.45 spent on your SBI Credit Card ending 7603 at ZOMATOLIMITED on 27/12/25.",
        authResults: "pass"
    };

    console.log(`[TEST 2] Processing: ${email2.body}`);
    const res2 = await universalPipeline.processEmail(userId, email2, jobId, mockFetchContents as any);
    console.log(`Result 2: Status=${res2.status}, TxnId=${res2.transactionId}`);

    // Allow logs to flush
    await new Promise(r => setTimeout(r, 2000));
}

// Wrapper
(async () => {
    try {
        const userRes = await query("SELECT id FROM users LIMIT 1");
        if (userRes.rows.length > 0) {
            await testPipelineReal(userRes.rows[0].id);
            process.exit(0);
        } else {
            console.log("No user found in DB. Please seed a user first.");
            process.exit(1);
        }
    } catch (err) {
        console.error("Test Failed:", err);
        process.exit(1);
    }
})();
