import cron from 'node-cron';
import pool from '../db';

// Spending Alert Service (Daily at 00:00 UTC)
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running Spending Alert Job...');
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Find users exceeding budget
    const result = await pool.query(
      `SELECT u.id, u.email, u.monthly_budget, SUM(t.amount) as total_spent 
       FROM users u 
       JOIN transactions t ON u.id = t.user_id 
       WHERE t.bill_month = $1 AND t.bill_year = $2 AND t.transaction_type = 'debit'
       GROUP BY u.id`,
      [currentMonth, currentYear]
    );

    for (const row of result.rows) {
      const budget = Number(row.monthly_budget);
      const spent = Number(row.total_spent);
      if (budget > 0 && spent > budget * 0.8) {
        // Send alert (mock)
        console.log(`Alert: User ${row.email} has spent ${spent} (Budget: ${budget})`);
        // Insert into alerts table
        await pool.query(
          `INSERT INTO alerts (user_id, alert_type, title, message, priority) 
           VALUES ($1, 'spending_limit', 'Budget Alert', $2, 'high')`,
          [row.id, `You have spent ${Math.round((spent/budget)*100)}% of your monthly budget.`]
        );
      }
    }
  } catch (error) {
    console.error('Error in Spending Alert Job:', error);
  }
});

// Bill Reminder Service (Daily at 09:00 UTC)
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running Bill Reminder Job...');
    // Find bills due in 3 days
    const result = await pool.query(
      `SELECT c.user_id, c.card_name, c.due_date 
       FROM credit_cards c 
       WHERE c.is_active = true`
    );

    const today = new Date().getDate();
    
    for (const row of result.rows) {
      const dueDate = row.due_date;
      // Simple logic: if due date is today + 3
      // Handling month rollover is complex, simplified here
      if (dueDate === today + 3) {
        console.log(`Reminder: Card ${row.card_name} bill is due on ${dueDate}`);
        await pool.query(
          `INSERT INTO alerts (user_id, alert_type, title, message, priority) 
           VALUES ($1, 'bill_reminder', 'Bill Due Soon', $2, 'high')`,
          [row.user_id, `Your ${row.card_name} bill is due in 3 days.`]
        );
      }
    }
  } catch (error) {
    console.error('Error in Bill Reminder Job:', error);
  }
});
