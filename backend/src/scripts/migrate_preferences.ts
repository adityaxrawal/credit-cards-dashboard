
import { query } from '../shared/database/db';
import logger from '../shared/utils/infrastructure/logger';

async function migrate() {
  try {
    logger.info('Starting migration for notification_preferences table...');

    // Add budget_warning_threshold
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS budget_warning_threshold INTEGER DEFAULT 80;
    `);
    logger.info('Added budget_warning_threshold column');

    // Add large_transaction_threshold
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS large_transaction_threshold INTEGER DEFAULT 10000;
    `);
    logger.info('Added large_transaction_threshold column');

    // Add bill_reminder_days
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS bill_reminder_days INTEGER DEFAULT 3;
    `);
    logger.info('Added bill_reminder_days column');

    // Add quiet_hours_start
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR(5);
    `);
    logger.info('Added quiet_hours_start column');

    // Add quiet_hours_end
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR(5);
    `);
    logger.info('Added quiet_hours_end column');

    // Add payment_alerts
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS payment_alerts BOOLEAN DEFAULT TRUE;
    `);
    logger.info('Added payment_alerts column');

    // Add spending_alerts
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS spending_alerts BOOLEAN DEFAULT TRUE;
    `);
    logger.info('Added spending_alerts column');

    // Add weekly_summary
    await query(`
      ALTER TABLE notification_preferences 
      ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN DEFAULT TRUE;
    `);
    logger.info('Added weekly_summary column');

    logger.info('Migration completed successfully'); process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

migrate();
