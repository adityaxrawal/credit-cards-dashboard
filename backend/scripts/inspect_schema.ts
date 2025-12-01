import pool from '../src/lib/db';

async function main() {
  try {
    const { rows } = await pool.query(`
      SELECT
          tc.constraint_name,
          rc.delete_rule
      FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='gmail_scanned_emails'
    `);
    
    console.log('Foreign Keys on gmail_scanned_emails:');
    rows.forEach(row => {
      console.log(`${row.constraint_name}: ${row.delete_rule}`);
    });
  } catch (error) {
    console.error('Error fetching schema:', error);
  } finally {
    await pool.end();
  }
}

main();
