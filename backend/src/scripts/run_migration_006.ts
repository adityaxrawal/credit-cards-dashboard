
import pool from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Running migration 006_update_processing_log.sql...');
        const sql = fs.readFileSync(path.join(__dirname, '../../migrations/006_update_processing_log.sql'), 'utf8');
        await client.query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
