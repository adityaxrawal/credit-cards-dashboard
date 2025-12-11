import { Pool } from 'pg';
import { env } from '../config/env';

const run = async () => {
    console.log('Testing Database Connection...');
    console.log(`URL: ${env.DATABASE_URL.replace(/:[^:@]*@/, ':****@')}`); // Hide password

    const pool = new Pool({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000, // 5s timeout
    });

    try {
        const client = await pool.connect();
        console.log('✅ Client connected successfully');

        const res = await client.query('SELECT NOW() as now');
        console.log(`✅ Query result: ${res.rows[0].now}`);

        client.release();
    } catch (err: any) {
        console.error('❌ Connection failed:', err.message);
        if (err.code) console.error(`   Code: ${err.code}`);
        if (err.detail) console.error(`   Detail: ${err.detail}`);
    } finally {
        await pool.end();
        console.log('Pool closed');
    }
};

run();
