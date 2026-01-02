import { Client } from 'pg';
import { env } from '@shared/config/env';

const verifyColumns = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            AND column_name IN ('currency_code', 'original_amount', 'transaction_subtype', 'extraction_method', 'classification_method');
        `);

        console.log('Found columns:', res.rows.map(r => r.column_name));

        const found = res.rows.map(r => r.column_name);
        const required = ['currency_code', 'original_amount', 'transaction_subtype', 'extraction_method', 'classification_method'];
        const missing = required.filter(c => !found.includes(c));

        if (missing.length === 0) {
            console.log('SUCCESS: All required columns are present.');
        } else {
            console.error('FAILURE: Missing columns:', missing);
            process.exit(1);
        }

    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

verifyColumns();
