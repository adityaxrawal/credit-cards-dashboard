import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import * as extractionService from '../services/extraction.service';
import * as transactionsService from '../services/transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';

interface PubSubPayload {
  emailAddress: string;
  historyId: string;
}

/**
 * Gmail Pub/Sub Handler
 * Processes real-time Gmail notifications
 */
export async function handleGmailPubSubMessage(payload: PubSubPayload) {
  console.log('[GmailPubSubHandler] Processing notification:', payload);
  
  const { emailAddress, historyId } = payload;
  
  try {
    // Find user by email
    const { rows: users } = await pool.query(
      'SELECT id, google_refresh_token, gmail_history_id FROM users WHERE email = $1',
      [emailAddress]
    );
    
    if (users.length === 0) {
      console.log('[GmailPubSubHandler] User not found for email:', emailAddress);
      return;
    }
    
    const user = users[0];
    
    if (!user.google_refresh_token) {
      console.log('[GmailPubSubHandler] User has no refresh token');
      return;
    }
    
    // Fetch history since last known historyId
    const history = await gmailClient.fetchHistory(
      user.google_refresh_token,
      user.gmail_history_id || '0'
    );
    
    console.log(`[GmailPubSubHandler] Found ${history.messages.length} new messages`);
    
    for (const msgRef of history.messages) {
      try {
        // Fetch full message
        const message = await gmailClient.getMessage(user.google_refresh_token, msgRef.id);
        
        if (!message) {
          console.log(`[GmailPubSubHandler] Could not fetch message ${msgRef.id}`);
          continue;
        }
        
        // Check if it's a potential transaction email
        if (!isPotentialTransactionEmail(message)) {
          console.log(`[GmailPubSubHandler] Message ${msgRef.id} is not a transaction email`);
          continue;
        }
        
        // Extract transaction
        const result = await extractionService.extractTransactionFromEmail(user.id, message);
        
        // Log processing
        await logEmailProcessing(user.id, message.id, result);
        
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
            
            console.log(`[GmailPubSubHandler] Created transaction ${tx?.id}`);
          } else {
            console.warn(`[GmailPubSubHandler] No card found for ${result.transaction.bankName} ${result.transaction.lastFourDigits}`);
          }
        }
      } catch (error) {
        console.error(`[GmailPubSubHandler] Error processing message ${msgRef.id}:`, error);
      }
    }
    
    // Update user's historyId
    await pool.query(
      'UPDATE users SET gmail_history_id = $1, updated_at = NOW() WHERE id = $2',
      [historyId, user.id]
    );
    
    console.log('[GmailPubSubHandler] Completed');
  } catch (error) {
    console.error('[GmailPubSubHandler] Error:', error);
  }
}

/**
 * Check if email is potentially a transaction notification
 */
function isPotentialTransactionEmail(message: { from: string; subject: string }): boolean {
  const bankPatterns = [
    /sbi|state bank/i,
    /hdfc/i,
    /icici/i,
    /axis/i,
    /idfc/i,
    /indusind/i,
    /yes bank/i,
  ];
  
  const subjectPatterns = [
    /transaction/i,
    /spent/i,
    /purchase/i,
    /card.*used/i,
  ];
  
  const isBank = bankPatterns.some(pattern => pattern.test(message.from));
  const isTransaction = subjectPatterns.some(pattern => pattern.test(message.subject));
  
  return isBank && isTransaction;
}

/**
 * Log email processing
 */
async function logEmailProcessing(
  userId: string,
  emailMessageId: string,
  result: { status: string; error?: string; transaction?: any }
) {
  try {
    await pool.query(
      `INSERT INTO email_processing_log (user_id, email_message_id, processing_status, error_message, processed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (email_message_id) DO UPDATE SET
         processing_status = EXCLUDED.processing_status,
         error_message = EXCLUDED.error_message,
         processed_at = EXCLUDED.processed_at`,
      [userId, emailMessageId, result.status, result.error || null]
    );
  } catch (error) {
    console.error('[GmailPubSubHandler] Error logging email processing:', error);
  }
}
