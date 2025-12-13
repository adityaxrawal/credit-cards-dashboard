import pool from '../lib/db';

async function applyConstraints() {
    const client = await pool.connect();
    try {
        console.log('Applying database constraints...');

        await client.query('BEGIN');

        // 1. Add Unique Index for transactions (User + Fingerprint)
        // Prevents duplicates even if logic fails
        // Using IF NOT EXISTS to avoid errors if re-run
        // Note: CREATE UNIQUE INDEX IF NOT EXISTS is valid in recent Postgres

        // Check if index exists first to be safe across versions or use IF NOT EXISTS syntax
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_fingerprint 
      ON transactions (user_id, txn_fingerprint);
    `);
        console.log('Ensure unique index: idx_transactions_user_fingerprint');

        // 2. Add Constraint for Check Amount > 0 (if valid transaction)
        // But refunds can be positive? Actually standard is positive for debit, negative for credit?
        // User requested "transaction filtering" in Issue 3.
        // Issue 4 mentions "Add constraints". Implicitly uniqueness.

        // We will stick to the requested Uniqueness constraint.
        // Also, verify 'txn_fingerprint' column exists? It should.

        await client.query('COMMIT');
        console.log('Constraints applied successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error applying constraints:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

applyConstraints();
