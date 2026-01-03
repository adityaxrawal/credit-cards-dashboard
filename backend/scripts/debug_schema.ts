
import { Client } from 'pg';
import { env } from '../src/shared/config/env';

const debug = async () => {
    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'merchant_aliases';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
};

debug();
