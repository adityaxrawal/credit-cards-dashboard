
import fs from 'fs';
import path from 'path';
import pool from '../src/lib/db';
import logger from '../src/utils/infrastructure/logger';

async function runMigration() {
    const file = process.argv[2];
    if (!file) {
        console.error('Please provide a migration file path');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), file);
    console.log(`Reading migration from: ${filePath}`);

    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log('Executing SQL...');
        await pool.query(sql);
        console.log('Migration executed successfully.');
        await pool.end();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
