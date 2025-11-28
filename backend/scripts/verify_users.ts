import pool from '../src/db';

async function main() {
  try {
    const { rows } = await pool.query('SELECT id, email FROM users LIMIT 1');
    if (rows.length > 0) {
      console.log(`User ID: ${rows[0].id}`);
      console.log(`Email: ${rows[0].email}`);
    } else {
      console.log('No users found');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  } finally {
    await pool.end();
  }
}

main();
