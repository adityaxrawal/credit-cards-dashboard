import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

export async function migrate() {
    const client = await pool.connect();

    try {
        logger.info('Starting migration: Fix gmail_sync_jobs schema');

        await client.query('BEGIN');

        // 1. Add emails_fetched column
        const hasEmailsFetched = await client.query(
            `SELECT EXISTS(
          SELECT FROM information_schema.columns 
          WHERE table_name = 'gmail_sync_jobs' AND column_name = 'emails_fetched'
        )`
        );

        if (!hasEmailsFetched.rows[0].exists) {
            await client.query(`
          ALTER TABLE gmail_sync_jobs ADD COLUMN emails_fetched INTEGER DEFAULT 0
        `);
            logger.info('Added emails_fetched column');
        }

        // 2. Add progress column
        const hasProgress = await client.query(
            `SELECT EXISTS(
          SELECT FROM information_schema.columns 
          WHERE table_name = 'gmail_sync_jobs' AND column_name = 'progress'
        )`
        );

        if (!hasProgress.rows[0].exists) {
            await client.query(`
          ALTER TABLE gmail_sync_jobs ADD COLUMN progress INTEGER DEFAULT 0
        `);
            logger.info('Added progress column');
        }

        // 3. Create index on status if not exists
        await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gmail_sync_jobs_status 
        ON gmail_sync_jobs(status)
      `);
        logger.info('Verified index on status');

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
