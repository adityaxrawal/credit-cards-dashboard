import { decrypt } from '../utils/encryption';
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { SanitizerService } from '../services/sanitize/sanitizer';
import { FilterService } from '../services/filters/filterService';
import { RuleProcessor } from '../services/rules/ruleProcessor';
import { TerminatorService } from '../services/terminator/terminator';
import { gptQueue } from '../services/queue/gptQueue';
import * as transactionsService from '../services/transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';

interface PubSubPayload {
  emailAddress: string;
  historyId: string;
}

/**
 * Gmail Pub/Sub Handler (Architecture V2)
 */
export async function handleGmailPubSubMessage(payload: PubSubPayload) {
  console.log('[GmailPubSubHandler] Processing notification:', payload);

  const { emailAddress, historyId } = payload;

  try {
    const { rows: users } = await pool.query(
      'SELECT id, google_refresh_token, gmail_history_id FROM users WHERE email = $1',
      [emailAddress]
    );

    if (users.length === 0) {
      console.log('[GmailPubSubHandler] User not found for email:', emailAddress);
      return;
    }

    const user = users[0];
    if (!user.google_refresh_token) return;

    const refreshToken = decrypt(user.google_refresh_token);

    // Fetch history
    const history = await gmailClient.fetchHistory(
      refreshToken,
      user.gmail_history_id || '0'
    );

    const messageIds = history.messages.map(m => m.id);
    console.log(`[GmailPubSubHandler] Found ${messageIds.length} new messages`);

    if (messageIds.length > 0) {
      // Fetch Raw
      const rawMessages = await gmailClient.batchGetMessages(refreshToken, messageIds);

      for (const rawMessage of rawMessages) {
        if (!rawMessage) continue;

        try {
          // Parse raw for simplified access
          const parsedEmail = gmailClient.parseMessage(rawMessage);
          const simpleEmail = {
            messageId: parsedEmail.id,
            threadId: parsedEmail.threadId,
            from: parsedEmail.from,
            to: parsedEmail.to,
            subject: parsedEmail.subject,
            body: parsedEmail.bodyText || parsedEmail.snippet,
            internalDate: parsedEmail.date.getTime(),
            bodyText: parsedEmail.bodyText,
            bodyHtml: parsedEmail.bodyHtml,
            attachments: parsedEmail.attachments
          };

          // 1. Sanitize
          const fetchAttachment = async (msgId: string, attId: string) =>
            gmailClient.getAttachment(refreshToken, msgId, attId);

          const cleanEmail = await SanitizerService.sanitize(simpleEmail, fetchAttachment);

          // 2. Filter
          const filterResult = FilterService.filter(cleanEmail);
          if (!filterResult.shouldProcess) {
            await TerminatorService.terminate(user.id, cleanEmail.id, filterResult.reason, 'filter');
            continue;
          }

          // 3. Rule Logic
          const ruleResult = await RuleProcessor.process(cleanEmail);

          if (ruleResult.status === 'passed' && ruleResult.transaction) {
            // Insert
            try {
              await transactionsService.createTransactionFromExtraction(user.id, {
                ...ruleResult.transaction,
                extractionMethod: 'rule_based_realtime',
                confidence: ruleResult.confidenceScore || 1.0
              }, {
                id: cleanEmail.id,
                subject: cleanEmail.subject,
                body: cleanEmail.cleanedBody,
                from: cleanEmail.from
              });
              console.log(`[PubSub] Transaction created for ${cleanEmail.id}`);
            } catch (err: any) {
              if (err.code !== '23505') console.error(`[PubSub] Insert failed:`, err);
            }
          } else {
            // 4. Queue for GPT
            console.log(`[PubSub] Queuing ${cleanEmail.id} for GPT`);
            gptQueue.enqueue({
              ...cleanEmail,
              userId: user.id
            });
          }

        } catch (error) {
          console.error(`[GmailPubSubHandler] Error processing message ${rawMessage.id}:`, error);
        }
      }
    }

    // Update historyId
    await pool.query(
      'UPDATE users SET gmail_history_id = $1, updated_at = NOW() WHERE id = $2',
      [historyId, user.id]
    );

  } catch (error) {
    console.error('[GmailPubSubHandler] Error:', error);
  }
}
