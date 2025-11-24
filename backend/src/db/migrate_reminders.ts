import pool from './index';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting reminders migration...');
    await client.query('BEGIN');

    // Create bill_reminders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_reminders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        amount DECIMAL(10, 2),
        due_date TIMESTAMP NOT NULL,
        reminder_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        is_recurring BOOLEAN DEFAULT false,
        recurrence_pattern VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('Reminders migration completed successfully.');
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
