
import { query } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import logger from '../src/utils/infrastructure/logger';

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../src/db/migrations/001_notification_queue.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        logger.info('Running migration: 001_notification_queue.sql');
        await query(sql);
        logger.info('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed', error);
        process.exit(1);
    }
}

runMigration();
