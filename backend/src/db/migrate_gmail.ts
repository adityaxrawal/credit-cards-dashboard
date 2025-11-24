import pool from './index';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting Gmail migration...');
    await client.query('BEGIN');

    // Add refresh_token column to users table
    await client.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'refresh_token') THEN
              ALTER TABLE users ADD COLUMN refresh_token TEXT;
          END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('Gmail migration completed successfully.');
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
