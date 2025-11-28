import pool from '../src/db';

async function main() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scan_jobs'
    `);
    
    console.log('Columns in scan_jobs:');
    rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error('Error fetching schema:', error);
  } finally {
    await pool.end();
  }
}

main();
