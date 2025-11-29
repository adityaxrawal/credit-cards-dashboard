
import pool from './src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function cleanup() {
  console.log('Starting cleanup...');

  try {
    // 1. Clear Database
    console.log('Clearing database tables...');
    await pool.query('DELETE FROM gmail_scanned_emails');
    await pool.query('DELETE FROM gmail_sync_jobs');
    console.log('Database tables cleared.');

    // 2. Clear Local Logs
    const logsDir = path.join(__dirname, 'logs/scanned_emails');
    if (fs.existsSync(logsDir)) {
      console.log('Clearing local logs...');
      const files = fs.readdirSync(logsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(logsDir, file));
      }
      console.log('Local logs cleared.');
    }

  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await pool.end();
  }
}

cleanup();
