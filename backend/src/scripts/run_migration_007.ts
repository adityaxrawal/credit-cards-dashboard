
import pool from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Running migration 007_fix_log_schema.sql...');
        const sql = fs.readFileSync(path.join(__dirname, '../../migrations/007_fix_log_schema.sql'), 'utf8');
        await client.query(sql);
        console.log('Migration 007 completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end(); // Close functionality script pool
    }
}

runMigration();
