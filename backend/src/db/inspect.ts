import pool from './index';

const inspectTable = async () => {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions';
    `);
    console.log('Transactions table columns:', res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
};

inspectTable();
