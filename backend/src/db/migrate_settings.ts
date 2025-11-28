import pool from '../lib/db';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting settings migration...');
    await client.query('BEGIN');

    // Add email_notifications column
    const checkEmailNotif = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_notifications'"
    );
    if (checkEmailNotif.rows.length === 0) {
      console.log('Adding email_notifications column...');
      await client.query('ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT true');
    }

    // Add notification_preferences column
    const checkNotifPref = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notification_preferences'"
    );
    if (checkNotifPref.rows.length === 0) {
      console.log('Adding notification_preferences column...');
      await client.query(
        `ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{"bill_reminders": true, "spending_alerts": true, "weekly_summary": true}'`
      );
    }
    
    // Add alert_threshold column (mentioned in frontend settings)
    const checkAlertThreshold = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'alert_threshold'"
      );
      if (checkAlertThreshold.rows.length === 0) {
        console.log('Adding alert_threshold column...');
        await client.query('ALTER TABLE users ADD COLUMN alert_threshold INTEGER DEFAULT 80');
      }

    await client.query('COMMIT');
    console.log('Settings migration completed successfully.');
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
