
import pool from '../src/lib/db';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running migration: Create classification_rules table');
        await client.query(`
      CREATE TABLE IF NOT EXISTS classification_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        criteria JSONB NOT NULL,
        action JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_rules_user_priority ON classification_rules(user_id, priority DESC);
    `);
        console.log('Migration successful');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
