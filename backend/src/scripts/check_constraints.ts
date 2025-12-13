
import pool from '../lib/db';

async function check() {
    try {
        const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'email_processing_log'::regclass
    `);
        console.log('Constraints:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

check();
