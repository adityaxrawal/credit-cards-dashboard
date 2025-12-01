import pool from '../lib/db';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting unique cards migration...');
    await client.query('BEGIN');

    // Create unique index on user_id, bank_name, and card_number_last4
    // We use LOWER(bank_name) to ensure case-insensitive uniqueness for the bank name
    // We only enforce this for active cards (is_active = true)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_cards 
      ON credit_cards (user_id, LOWER(bank_name), card_number_last4) 
      WHERE is_active = true;
    `);

    await client.query('COMMIT');
    console.log('Unique cards migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
