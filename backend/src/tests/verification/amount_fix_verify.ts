
import pool from '@shared/database/db';

async function main() {
    try {
        console.log('Verifying zero amount insertion...');
        // Insert a dummy transaction with amount 0 using correct schema columns
        const result = await pool.query(`
            INSERT INTO transactions (
                user_id, amount, transaction_date, merchant, transaction_type, is_settled
            ) VALUES (
                (SELECT id FROM users LIMIT 1), 
                0, 
                NOW(), 
                'Zero Amount Test', 
                'expense',
                true
            ) RETURNING id
        `);
        console.log('Successfully inserted transaction with id:', result.rows[0].id);

        // Clean up
        await pool.query('DELETE FROM transactions WHERE id = $1', [result.rows[0].id]);
        console.log('Verification successful.');
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

main();
