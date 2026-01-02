/**
 * Migration: Add timezone column to users table
 * Run with: npx ts-node -r tsconfig-paths/register src/scripts/migrate_timezone.ts
 */

import { query } from '../shared/database/db';
import logger from '../shared/utils/infrastructure/logger';

async function migrate() {
    try {
        logger.info('Starting migration: Adding timezone column to users table...');

        // Add timezone column with default value
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
        `);
        logger.info('Added timezone column to users table');

        // Add comment for documentation
        await query(`
            COMMENT ON COLUMN users.timezone IS 'User timezone for display purposes (IANA timezone format, e.g., Asia/Kolkata, America/New_York)';
        `);
        logger.info('Added column comment');

        logger.info('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed', error);
        process.exit(1);
    }
}

migrate();
