import pool from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cleanup script for Gmail logs
 * - Removes local log files
 * - Clears gmail_scanned_emails table
 * - Clears gmail_sync_jobs table
 */
async function cleanup() {
  console.log('🧹 Starting Gmail logs cleanup...\n');

  // 1. Clean up local log files
  const logsDir = path.join(__dirname, '../logs/scanned_emails');
  console.log(`[1] Cleaning up log files in: ${logsDir}`);
  
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir);
    console.log(`   Found ${files.length} log files`);
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      fs.unlinkSync(filePath);
      console.log(`   ✓ Deleted: ${file}`);
    }
  } else {
    console.log(`   ⚠ Directory not found: ${logsDir}`);
  }

  // 2. Clean up database tables
  console.log('\n[2] Cleaning up database tables...');
  
  try {
    // Clear g mail_scanned_emails
    const scannedResult = await pool.query('DELETE FROM gmail_scanned_emails');
    console.log(`   ✓ Deleted ${scannedResult.rowCount} rows from gmail_scanned_emails`);

    // Clear gmail_sync_jobs
    const jobsResult = await pool.query('DELETE FROM gmail_sync_jobs');
    console.log(`   ✓ Deleted ${jobsResult.rowCount} rows from gmail_sync_jobs`);

  } catch (error) {
    console.error('   ✗ Database cleanup failed:', error);
    throw error;
  }

  console.log('\n✅ Cleanup complete!');
  process.exit(0);
}

cleanup().catch(error => {
  console.error('💥 Cleanup failed:', error);
  process.exit(1);
});
