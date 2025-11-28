import pool from '../lib/db';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting Scan Jobs migration...');
    await client.query('BEGIN');

    // Create scan_jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scan_jobs (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        total INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        inserted INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        current_step VARCHAR(50),
        from_date TIMESTAMP,
        to_date TIMESTAMP,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON scan_jobs(user_id);
    `);

    await client.query('COMMIT');
    console.log('Scan Jobs migration completed successfully.');
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
