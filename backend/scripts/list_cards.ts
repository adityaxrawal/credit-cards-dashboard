import pool from '../src/db';

async function listCards() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Please provide a user ID');
    process.exit(1);
  }

  try {
    const { rows } = await pool.query('SELECT * FROM credit_cards WHERE user_id = $1', [userId]);
    console.log(`Found ${rows.length} cards for user ${userId}:`);
    rows.forEach(card => {
      console.log(`- ${card.bank_name} ending in ${card.card_number_last4}`);
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
  } finally {
    await pool.end();
  }
}

listCards();
