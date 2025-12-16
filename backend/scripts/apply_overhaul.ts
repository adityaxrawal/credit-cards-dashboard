import fs from 'fs';
import path from 'path';
import pool from '../src/lib/db';

async function runMigration() {
    try {
        const migrationFile = path.join(__dirname, '../migrations/20251216_schema_overhaul.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('Running migration: 20251216_schema_overhaul...');
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
