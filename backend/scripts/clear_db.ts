
import { Client } from 'pg';
import { env } from '../src/config/env';

const clearDatabase = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database for cleanup...');

        // 1. Get all public tables
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE';
        `);

        const tables = res.rows.map(row => row.table_name);

        if (tables.length === 0) {
            console.log('No tables found in public schema.');
            return;
        }

        console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

        // 2. Truncate all tables
        // We use CASCADE to handle foreign key constraints automatically
        const truncateQuery = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} CASCADE;`;

        console.log('Executing TRUNCATE CASCADE on all tables...');
        await client.query(truncateQuery);

        console.log('✅ Successfully cleared all data from tables.');

    } catch (err) {
        console.error('❌ Database cleanup failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

// Execute if run directly
if (require.main === module) {
    clearDatabase();
}
