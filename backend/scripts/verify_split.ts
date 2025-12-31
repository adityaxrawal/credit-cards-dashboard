
import { createManualTransaction, getTransaction } from '../src/services/transactions/TransactionService';
import pool from '../src/lib/db';
import { InstrumentType } from '../src/types/transaction.types';

async function verifySplitTransactions() {
    console.log('Verifying Split Transactions...');

    // 1. Create a parent transaction
    // Ideally need a valid user ID. I'll pick one from the DB or use a hardcoded testing one if available.
    // For this script to work, I need a real user ID.
    const client = await pool.connect();
    let userId: string;
    let instrumentId: string;

    try {
        const userRes = await client.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length === 0) {
            console.error('No users found to test with.');
            return;
        }
        userId = userRes.rows[0].id;

        const instRes = await client.query('SELECT id FROM instruments WHERE user_id = $1 LIMIT 1', [userId]);
        if (instRes.rows.length === 0) {
            console.error('No instruments found to test with.');
            return;
        }
        instrumentId = instRes.rows[0].id;
    } finally {
        client.release();
    }

    const parent = await createManualTransaction({
        userId,
        instrumentType: InstrumentType.CREDIT_CARD,
        instrumentId,
        transactionDate: new Date(),
        merchant: 'Test Parent Transaction',
        category: 'Shopping',
        amount: 1000,
        transactionType: 'debit',
        direction: 'debit',
        description: 'Parent of splits'
    });

    if (!parent) {
        console.error('Failed to create parent transaction');
        return;
    }
    console.log('Parent created:', parent.id);

    // 2. Create a child transaction linked to parent
    const child = await createManualTransaction({
        userId,
        instrumentType: InstrumentType.CREDIT_CARD,
        instrumentId,
        transactionDate: new Date(),
        merchant: 'Test Child Split',
        category: 'Food',
        amount: 400,
        transactionType: 'debit',
        direction: 'debit',
        description: 'Split 1',
        parentTransactionId: parent.id
    });

    if (!child) {
        console.error('Failed to create child transaction');
        return;
    }
    console.log('Child created:', child.id);

    // 3. Verify linkage
    const fetchedChild = await getTransaction(userId, child.id);
    // Note: getTransactionById currently returns raw row, checking if parent_transaction_id is present.
    // I need to check the raw row or typed object.
    // @ts-ignore
    if (fetchedChild && fetchedChild.parent_transaction_id === parent.id) {
        console.log('Verification SUCCESS: Child is linked to Parent');
    } else {
        console.error('Verification FAILED: linkage missing', fetchedChild);
    }

    process.exit(0);
}

verifySplitTransactions().catch(console.error);
