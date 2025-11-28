import pool from './index';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting Scan Jobs update migration...');
    await client.query('BEGIN');

    // Add current_step column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scan_jobs' AND column_name = 'current_step') THEN
              ALTER TABLE scan_jobs ADD COLUMN current_step VARCHAR(50);
          END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('Scan Jobs update migration completed successfully.');
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
