import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import * as extractionService from '../services/extraction.service';
import * as transactionsService from '../services/transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import dayjs from 'dayjs';

/**
 * Historical Email Scanner
 * Scans past emails for transaction history
 */
export async function runHistoricalScan(
  userId: string,
  jobId: string,
  fromDate?: Date,
  toDate?: Date
) {
  console.log(`[HistoricalScanner] Starting scan ${jobId} for user:`, userId);
  
  try {
    // Get user's refresh token
    const { rows: users } = await pool.query(
      'SELECT id, email, google_refresh_token FROM users WHERE id = $1',
      [userId]
    );
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    if (!users[0].google_refresh_token) {
      throw new Error('Gmail not connected. Please connect your Gmail account in Settings > Gmail Integration before syncing.');
    }
    
    const user = users[0];
    
    // Build Gmail query
    const from = fromDate ? dayjs(fromDate).format('YYYY/MM/DD') : dayjs().subtract(3, 'month').format('YYYY/MM/DD');
    const to = toDate ? dayjs(toDate).format('YYYY/MM/DD') : dayjs().format('YYYY/MM/DD');
    
    const query = `(from:sbi OR from:hdfc OR from:icici OR from:axis OR from:idfc OR from:indusind) (transaction OR spent OR purchase) after:${from} before:${to}`;
    
    console.log(`[HistoricalScanner] Query:`, query);
    
    // Initial job update
    await pool.query(
      `UPDATE scan_jobs 
       SET status = 'processing', current_step = 'FETCHING', total = 0, updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    let pageToken: string | undefined = undefined;
    let totalMessages = 0;
    let processed = 0;
    let inserted = 0;
    let errors = 0;
    let batchCount = 0;

    // Fetch and process loop
    do {
      // Fetch batch of messages
      const response = await gmailClient.listMessages(
        user.google_refresh_token, 
        query, 
        50, // Fetch 50 at a time
        pageToken
      );
      
      const messages = response.messages;
      pageToken = response.nextPageToken;
      
      if (messages.length === 0) {
        break;
      }

      totalMessages += messages.length;
      console.log(`[HistoricalScanner] Batch ${++batchCount}: Found ${messages.length} messages. Total so far: ${totalMessages}`);

      // Update total count
      await pool.query(
        `UPDATE scan_jobs SET total = $1, current_step = 'PROCESSING', updated_at = NOW() WHERE id = $2`,
        [totalMessages, jobId]
      );

      // Process this batch
      for (const msgRef of messages) {
        try {
          // Fetch full message
          const message = await gmailClient.getMessage(user.google_refresh_token, msgRef.id);
          
          if (!message) {
            console.log(`[HistoricalScanner] Could not fetch message ${msgRef.id}`);
            errors++;
            continue;
          }
          
          // Extract transaction
          const result = await extractionService.extractTransactionFromEmail(user.id, message);
          
          processed++;
          
          if (result.status === 'success' && result.transaction) {
            // Find matching card
            const card = await cardsQueries.findCardByBankAndLastFour(
              user.id,
              result.transaction.bankName,
              result.transaction.lastFourDigits
            );
            
            if (card) {
              // Insert transaction
              const tx = await transactionsService.insertFromEmail(user.id, {
                cardId: card.id,
                amount: result.transaction.amount,
                transactionDate: result.transaction.transactionDate,
                merchant: result.transaction.merchant,
                category: result.transaction.category,
                emailMessageId: message.id,
              });
              
              if (tx) {
                inserted++;
                // console.log(`[HistoricalScanner] Inserted transaction ${tx.id}`);
              }
            } else {
              console.warn(`[HistoricalScanner] No card found for ${result.transaction.bankName} ${result.transaction.lastFourDigits}. User ID: ${user.id}`);
            }
          } else {
            // Log why extraction failed or was skipped
            // console.log(`[HistoricalScanner] Skipped message ${msgRef.id}: ${result.status} - ${result.error || 'No transaction found'}`);
          }
          
          // Update progress every 5 messages to keep UI responsive
          if (processed % 5 === 0) {
            await pool.query(
              `UPDATE scan_jobs 
               SET processed = $1, inserted = $2, errors = $3, updated_at = NOW()
               WHERE id = $4`,
              [processed, inserted, errors, jobId]
            );
          }
        } catch (error) {
          console.error(`[HistoricalScanner] Error processing message ${msgRef.id}:`, error);
          errors++;
        }
      }

    } while (pageToken);
    
    // Mark job as completed
    await pool.query(
      `UPDATE scan_jobs 
       SET status = 'completed', current_step = 'COMPLETED', processed = $1, inserted = $2, errors = $3, 
           completed_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [processed, inserted, errors, jobId]
    );
    
    console.log(`[HistoricalScanner] Completed: ${processed} processed, ${inserted} inserted, ${errors} errors`);
    
    return {
      total: totalMessages,
      processed,
      inserted,
      errors,
    };
  } catch (error) {
    console.error(`[HistoricalScanner] Scan ${jobId} failed:`, error);
    
    // Mark job as failed
    await pool.query(
      `UPDATE scan_jobs 
       SET status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', jobId]
    );
    
    throw error;
  }
}

// If run directly
if (require.main === module) {
  const userId = process.argv[2];
  const jobId = process.argv[3] || `manual-${Date.now()}`;
  
  if (!userId) {
    console.error('Usage: ts-node historicalScanner.ts <userId> [jobId]');
    process.exit(1);
  }

  // Insert job first
  pool.query(
    `INSERT INTO scan_jobs (id, user_id, status, current_step, started_at)
     VALUES ($1, $2, 'pending', 'INITIALIZING', NOW())`,
    [jobId, userId]
  ).then(() => {
    console.log(`[Manual] Created job ${jobId}`);
    return runHistoricalScan(userId, jobId);
  })
    .then((result) => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
