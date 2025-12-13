import pool from '../lib/db';
import * as transactionsQueries from '../db/queries/transactions.queries';

async function reproduceFix3() {
    console.log('--- Starting Fix 3 Reproduction ---');

    const userIdRes = await pool.query('SELECT id FROM users LIMIT 1');
    let userId = userIdRes.rows[0]?.id;
    if (!userId) {
        // Create dummy user
        console.log('Creating dummy user...');
        const newUser = await pool.query(`INSERT INTO users (google_id, email, name) VALUES ('dummy-google-id-fix3', 'dummy-fix3@test.com', 'Dummy User') RETURNING id`);
        userId = newUser.rows[0].id;
    }

    // We need a valid card_id
    const cardRes = await pool.query('SELECT id FROM credit_cards WHERE user_id = $1 LIMIT 1', [userId]);
    let cardId = cardRes.rows[0]?.id;

    if (!cardId) {
        console.log('Creating dummy card...');
        const newCard = await pool.query(`
            INSERT INTO credit_cards (user_id, card_name, bank_name, card_number_last4, bill_date, due_date) 
            VALUES ($1, 'Test Card Fix 3', 'Test Bank', '1234', 1, 20) 
            RETURNING id`,
            [userId]
        );
        cardId = newCard.rows[0].id;
    }

    const testId = `repro-fix3-${Date.now()}`;
    const fingerprint = `fp-${testId}`;

    const txnData = {
        userId,
        cardId,
        transactionDate: new Date(),
        merchant: 'Test Merchant',
        category: 'Test',
        amount: 100,
        transactionType: 'debit',
        emailMessageId: testId,
        txnFingerprint: fingerprint
    };

    try {
        console.log('Attempting Insert 1...');
        await transactionsQueries.createTransaction(txnData);
        console.log('✅ Insert 1 Success');

        console.log('Attempting Insert 2 (Duplicate)...');
        await transactionsQueries.createTransaction(txnData);
        console.log('✅ Insert 2 Success (Ignored/Handled)');

        console.log('❌ Failed to reproduce failure: ON CONFLICT worked? (Constraint might exist?)');

    } catch (err: any) {
        if (err.message.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
            console.log('✅ Reproduction SUCCESS: Captured missing constraint error.');
        } else {
            console.error('❌ Unexpected error:', err);
        }
    } finally {
        // Cleanup
        await pool.query('DELETE FROM transactions WHERE email_message_id = $1', [testId]);
        await pool.end();
    }
}

reproduceFix3();
