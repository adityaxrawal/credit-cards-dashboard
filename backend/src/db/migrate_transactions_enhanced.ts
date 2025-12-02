import pool from '../lib/db';

export async function migrateTransactionsEnhanced() {
  const client = await pool.connect();
  try {
    console.log('Starting transactions table enhancement migration...');
    await client.query('BEGIN');

    // Add exact_timestamp
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'exact_timestamp') THEN
          ALTER TABLE transactions ADD COLUMN exact_timestamp TIMESTAMP;
        END IF;
      END $$;
    `);

    // Add email_subject
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'email_subject') THEN
          ALTER TABLE transactions ADD COLUMN email_subject TEXT;
        END IF;
      END $$;
    `);

    // Add gmail_thread_id
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'gmail_thread_id') THEN
          ALTER TABLE transactions ADD COLUMN gmail_thread_id VARCHAR(255);
        END IF;
      END $$;
    `);

    // Add gmail_account_index
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'gmail_account_index') THEN
          ALTER TABLE transactions ADD COLUMN gmail_account_index INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    // Add currency_code
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'currency_code') THEN
          ALTER TABLE transactions ADD COLUMN currency_code VARCHAR(10) DEFAULT 'INR';
        END IF;
      END $$;
    `);

    // Add original_amount
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'original_amount') THEN
          ALTER TABLE transactions ADD COLUMN original_amount DECIMAL(10, 2);
        END IF;
      END $$;
    `);

    // Add reference_number
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'reference_number') THEN
          ALTER TABLE transactions ADD COLUMN reference_number VARCHAR(100);
        END IF;
      END $$;
    `);

    // Add transaction_subtype
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'transaction_subtype') THEN
          ALTER TABLE transactions ADD COLUMN transaction_subtype VARCHAR(50);
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('Transactions table enhancement migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  migrateTransactionsEnhanced()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
