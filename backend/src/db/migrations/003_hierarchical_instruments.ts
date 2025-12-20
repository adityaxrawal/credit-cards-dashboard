import pool from '../../lib/db';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';

export async function migrate() {
    const client = await pool.connect();

    try {
        logger.info('Starting migration: Hierarchical Instruments');

        await client.query('BEGIN');

        const sqlPath = path.join(__dirname, '003_hierarchical_instruments.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        await client.query('COMMIT');
        logger.info('Migration completed successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
