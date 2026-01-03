
import { Client } from 'pg';
import { env } from '../src/shared/config/env';

const nuclear = async () => {
    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        console.log('Dropping merchant_aliases table...');
        await client.query('DROP TABLE IF EXISTS merchant_aliases CASCADE');

        console.log('Resetting migration history for 007...');
        await client.query("DELETE FROM _migrations WHERE name = '007_merchant_architecture.sql'");

        console.log('Done. You can now re-run migrate.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
};

nuclear();
