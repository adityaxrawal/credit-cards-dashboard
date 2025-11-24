import pool from './index';

const migrate = async () => {
  try {
    console.log('Starting migration...');

    // Transactions
    await renameColumn('transactions', 'merchant_name', 'merchant');
    await renameColumn('transactions', 'merchant_category', 'category');
    await renameColumn('transactions', 'billing_cycle_month', 'bill_month');
    await renameColumn('transactions', 'billing_cycle_year', 'bill_year');

    // Credit Cards
    await renameColumn('credit_cards', 'last_four_digits', 'card_number_last4');
    await renameColumn('credit_cards', 'current_outstanding', 'current_balance');

    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
};

const renameColumn = async (table: string, oldName: string, newName: string) => {
  try {
    // Check if old column exists
    const checkRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, oldName]
    );

    if (checkRes.rows.length > 0) {
      console.log(`Renaming ${table}.${oldName} to ${newName}...`);
      await pool.query(`ALTER TABLE ${table} RENAME COLUMN ${oldName} TO ${newName}`);
    } else {
      console.log(`${table}.${oldName} does not exist (already renamed?).`);
    }
  } catch (err) {
    console.error(`Error renaming ${table}.${oldName}:`, err);
  }
};

migrate();
