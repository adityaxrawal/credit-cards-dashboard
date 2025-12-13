import pool from '../lib/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    const args = process.argv.slice(2);
    const fileArgIndex = args.indexOf('--file');
    const migrationFile = fileArgIndex !== -1 ? args[fileArgIndex + 1] : args[0];

    if (!migrationFile) {
        console.error('Usage: ts-node run_migration.ts --file <filename>');
        process.exit(1);
    }

    const migrationPath = path.join(__dirname, '../../migrations', migrationFile);

    console.log(`Reading migration file: ${migrationPath}`);
    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Executing migration SQL...');

        await pool.query(sql);

        console.log('✅ Migration executed successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
