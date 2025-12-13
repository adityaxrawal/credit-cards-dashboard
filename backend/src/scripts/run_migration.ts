import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const migrationPath = path.join(__dirname, '../../migrations/add_parallel_processing_columns.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        await client.query(migrationSql);
        console.log('Migration executed successfully');

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

runMigration();
