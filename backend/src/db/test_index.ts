import pool from './index';

const testIndex = async () => {
  try {
    console.log('Creating index...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_bill_cycle ON transactions(bill_year, bill_month);');
    console.log('Index created successfully.');
  } catch (error) {
    console.error('Index creation failed:', error);
  } finally {
    await pool.end();
  }
};

testIndex();
