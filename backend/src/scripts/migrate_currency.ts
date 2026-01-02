
import { query } from '../shared/database/db';
import logger from '../shared/utils/infrastructure/logger';

async function migrate() {
    try {
        logger.info('Starting migration for users table (currency preferences)...');

        // Add base_currency
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) DEFAULT 'INR';
        `);
        logger.info('Added base_currency column');

        // Add secondary_currencies
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS secondary_currencies TEXT[] DEFAULT '{}';
        `);
        logger.info('Added secondary_currencies column');

        logger.info('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed', error);
        process.exit(1);
    }
}

migrate();
