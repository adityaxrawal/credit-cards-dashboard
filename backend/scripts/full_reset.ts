
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
// Determine path to env based on typical structure.
// If scripts/ is in root or backend/scripts? 
// Provided metadata shows /Users/adityarawal/A-B/Projects/Codes/Credit Card/vscode/backend/scripts/clear_db.ts
// So ../src/config/env is correct if running from there.
import { env } from '../src/config/env';

const resetDb = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Supabase often requires this or compatible SSL
    });

    try {
        await client.connect();
        console.log('Connected to database.');
        console.log('Dropping schema public CASCADE...');

        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO postgres');
        await client.query('GRANT ALL ON SCHEMA public TO public');

        console.log('Public schema recreated.');
        console.log('Reading and applying src/db/schema.sql...');

        const schemaPath = join(__dirname, '../src/db/schema.sql');
        const schemaSql = readFileSync(schemaPath, 'utf8');

        await client.query(schemaSql);
        console.log('✅ Schema applied successfully.');

    } catch (err) {
        console.error('❌ Database reset failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

if (require.main === module) {
    resetDb();
}
