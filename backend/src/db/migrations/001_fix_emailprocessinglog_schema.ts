import pool from '../lib/db';
import logger from '../utils/logger';

export async function migrate() {
    const client = await pool.connect();

    try {
        logger.info('Starting migration: Fix emailprocessinglog schema');

        await client.query('BEGIN');

        // 1. Check if table exists
        const tableExists = await client.query(
            `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'emailprocessinglog')`
        );

        if (!tableExists.rows[0].exists) {
            logger.info('emailprocessinglog table does not exist, creating...');

            await client.query(`
        CREATE TABLE IF NOT EXISTS emailprocessinglog (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          email_message_id VARCHAR(255) NOT NULL,
          processing_status VARCHAR(50) DEFAULT 'pending',
          error_message TEXT,
          processed_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, email_message_id)
        );
      `);

            logger.info('Created emailprocessinglog table');
        } else {
            // 2. Add missing columns
            const hasUpdatedAt = await client.query(
                `SELECT EXISTS(
          SELECT FROM information_schema.columns 
          WHERE table_name = 'emailprocessinglog' AND column_name = 'updated_at'
        )`
            );

            if (!hasUpdatedAt.rows[0].exists) {
                await client.query(`
          ALTER TABLE emailprocessinglog ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()
        `);
                logger.info('Added updated_at column');
            }

            const hasCreatedAt = await client.query(
                `SELECT EXISTS(
          SELECT FROM information_schema.columns 
          WHERE table_name = 'emailprocessinglog' AND column_name = 'created_at'
        )`
            );

            if (!hasCreatedAt.rows[0].exists) {
                await client.query(`
          ALTER TABLE emailprocessinglog ADD COLUMN created_at TIMESTAMP DEFAULT NOW()
        `);
                logger.info('Added created_at column');
            }

            // 3. Create indexes
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_emailprocessinglog_status 
        ON emailprocessinglog(user_id, processing_status)
      `);

            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_emailprocessinglog_timestamp 
        ON emailprocessinglog(user_id, updated_at DESC)
      `);
        }

        await client.query('COMMIT');
        logger.info('Migration completed successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
