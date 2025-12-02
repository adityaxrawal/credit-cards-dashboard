import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import * as extractionService from '../services/extraction.service';
import * as transactionsService from '../services/transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import * as scannedEmailQueries from '../db/queries/scanned_emails.queries';
import { CreditCardMailDetector } from '../services/CreditCardMailDetector';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';

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

  // Dynamic import p-limit
  const { default: pLimit } = await import('p-limit');

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

    // Get last scanned date for incremental syncing
    const lastScannedDate = await scannedEmailQueries.getLastScannedDate(userId);

    // Build Gmail query
    const fixedStartDate = dayjs('2023-09-30');
    let fromDateToUse: dayjs.Dayjs;

    if (fromDate) {
      // If explicit fromDate is provided (e.g. from UI trigger), use it regardless of last scan
      fromDateToUse = dayjs(fromDate);
      console.log(`[HistoricalScanner] Explicit start date provided: ${fromDateToUse.format('YYYY-MM-DD')}`);
    } else if (lastScannedDate) {
      // Otherwise, resume from last scan
      fromDateToUse = dayjs(lastScannedDate).subtract(1, 'day');
      console.log(`[HistoricalScanner] Incremental scan from ${fromDateToUse.format('YYYY-MM-DD')} (last scan: ${dayjs(lastScannedDate).format('YYYY-MM-DD')})`);
    } else {
      // Fallback to fixed start date
      fromDateToUse = fixedStartDate;
      console.log('[HistoricalScanner] First scan, starting from 2023-10-01');
    }

    const from = fromDateToUse.format('YYYY/MM/DD');
    const to = toDate ? dayjs(toDate).format('YYYY/MM/DD') : dayjs().format('YYYY/MM/DD');

    // Optimize query by filtering for known bank senders
    // This significantly reduces the number of emails to fetch and process
    const senderFilter = CreditCardMailDetector.SENDER_DOMAINS
      .map(domain => `from:"${domain}"`)
      .join(' OR ');

    const query = `after:${from} before:${to} (${senderFilter})`;

    // Setup local logging with WriteStream (Async)
    const logsDir = path.join(__dirname, '../../logs/scanned_emails');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, `user_${userId}_job_${jobId}.jsonl`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    console.log(`[HistoricalScanner] Query:`, query);

    // Initial job update
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'running', current_step = 'FETCHING', total_messages = 0, last_update_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    const CHUNK_SIZE = 200; // Fetch 200 IDs at a time (optimized)
    const CONCURRENCY = 50; // Process 50 emails in parallel (optimized for HTTP/2)
    const BULK_INSERT_BATCH = 100; // Batch size for bulk transaction inserts
    const STATUS_UPDATE_INTERVAL = 500; // Update job status every 500 emails
    const LOG_BUFFER_SIZE = 1000; // Buffer 1000 log entries before flush
    const limit = pLimit(CONCURRENCY);

    let pageToken: string | undefined = undefined;
    let totalMessages = 0;
    let processed = 0;
    let inserted = 0;
    let errors = 0;
    let currentBatchNumber = 0;
    const errorList: any[] = [];

    // Card lookup cache to avoid repeated DB queries
    const cardCache = new Map<string, any>();

    // Buffer for bulk operations
    let transactionBuffer: any[] = [];
    let logBuffer: string[] = [];

    let hasMore = true;

    // Pipeline: We need to fetch the first chunk to start the loop
    let nextChunkPromise = gmailClient.listMessages(user.google_refresh_token, query, CHUNK_SIZE, pageToken);

    while (hasMore) {
      currentBatchNumber++;

      // Await the fetch of the current chunk
      let response;
      try {
        response = await nextChunkPromise;
      } catch (err) {
        console.error(`[HistoricalScanner] Error listing messages for batch ${currentBatchNumber}:`, err);
        throw err;
      }

      const messages = response.messages;
      pageToken = response.nextPageToken;

      // Start fetching the NEXT chunk immediately (Pipeline)
      if (pageToken) {
        nextChunkPromise = gmailClient.listMessages(user.google_refresh_token, query, CHUNK_SIZE, pageToken);
      } else {
        hasMore = false;
        // No more pages, so nextChunkPromise is not needed or can be resolved to empty
        nextChunkPromise = Promise.resolve({ messages: [] });
      }

      if (!messages || messages.length === 0) {
        if (!hasMore) break;
        continue;
      }

      const batchCount = messages.length;
      totalMessages += batchCount;

      console.log(`[HistoricalScanner] Batch ${currentBatchNumber}: Processing ${batchCount} messages...`);

      // Update job status only every STATUS_UPDATE_INTERVAL emails
      if (totalMessages % STATUS_UPDATE_INTERVAL < batchCount) {
        await pool.query(
          `UPDATE gmail_sync_jobs 
           SET total_messages = $1, current_step = 'PROCESSING_BATCH', 
               metadata = jsonb_set(COALESCE(metadata, '{}'), '{currentBatch}', $2::jsonb),
               last_update_at = NOW() 
           WHERE id = $3`,
          [totalMessages, JSON.stringify(currentBatchNumber), jobId]
        );
      }

      // 1. Batch Fetch Raw Messages (Parallel)
      // Use our new batchGetMessages which uses p-limit internally
      const messageIds = messages.map(m => m.id);
      const rawMessages = await gmailClient.batchGetMessages(user.google_refresh_token, messageIds, CONCURRENCY);

      // 2. Process Messages in Memory
      const scannedDataList: any[] = [];
      const logEntries: any[] = [];
      const transactionMessages: any[] = []; // To process for transactions
      const transactionsToInsert: any[] = []; // Accumulate for bulk insert

      for (let i = 0; i < rawMessages.length; i++) {
        const rawMessage = rawMessages[i];
        if (!rawMessage) {
          errors++;
          continue;
        }

        try {
          const headers = rawMessage.payload?.headers || [];
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
          const sender = headers.find((h: any) => h.name === 'From')?.value || '';
          const snippet = rawMessage.snippet || '';
          const internalDate = parseInt(rawMessage.internalDate || '0');

          // Detect
          const detection = CreditCardMailDetector.detect(rawMessage);

          // Prepare for Bulk Insert
          scannedDataList.push({
            userId: user.id,
            messageId: rawMessage.id || '',
            internalDate,
            subject,
            sender,
            snippet,
            isTransaction: detection.isTransaction,
            detectionConfidence: detection.confidence,
            detectionReason: detection.reason || '',
            scanJobId: jobId
          });

          // Prepare Log Entry
          logEntries.push({
            messageId: rawMessage.id,
            internalDate,
            from: sender,
            subject,
            snippet: snippet.substring(0, 100),
            detection: {
              isTransaction: detection.isTransaction,
              confidence: detection.confidence,
              reason: detection.reason
            },
            processed: false,
            transactionId: null
          });

          if (detection.isTransaction) {
            transactionMessages.push({ rawMessage, index: i });
          } else {
            processed++;
          }

        } catch (err) {
          console.error(`[HistoricalScanner] Error parsing message ${rawMessage.id}:`, err);
          errors++;
        }
      }

      // 3. Bulk Insert Scanned Emails
      if (scannedDataList.length > 0) {
        await scannedEmailQueries.insertScannedEmailsBulk(scannedDataList);
      }

      // 4. Process Transactions (Parallel)
      // We need to fetch the simplified message (or just reuse raw if we can, but extractionService expects GmailMessage)
      // extractionService expects GmailMessage which is what getMessage returns. 
      // We can reconstruct GmailMessage from rawMessage to avoid another API call!
      // Optimization: Avoid calling gmailClient.getMessage again.

      const transactionTasks = transactionMessages.map(({ rawMessage, index }) => limit(async () => {
        try {
          // Construct GmailMessage from rawMessage locally
          const headers = rawMessage.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          let bodyText = '';
          let bodyHtml = '';

          const getAttachments = (parts: any[]): any[] => {
            let attachments: any[] = [];
            for (const part of parts) {
              if (part.filename && part.body?.attachmentId) {
                attachments.push({
                  id: part.body.attachmentId,
                  filename: part.filename,
                  mimeType: part.mimeType,
                });
              }
              if (part.parts) {
                attachments = attachments.concat(getAttachments(part.parts));
              }
            }
            return attachments;
          };

          if (rawMessage.payload?.body?.data) {
            bodyText = Buffer.from(rawMessage.payload.body.data, 'base64').toString('utf-8');
          } else if (rawMessage.payload?.parts) {
            for (const part of rawMessage.payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
              }
              if (part.mimeType === 'text/html' && part.body?.data) {
                bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
              }
            }
          }

          const attachments = rawMessage.payload?.parts ? getAttachments(rawMessage.payload.parts) : [];

          const simplifiedMessage = {
            id: rawMessage.id!,
            threadId: rawMessage.threadId!,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            date: new Date(parseInt(rawMessage.internalDate || '0')),
            bodyText,
            bodyHtml,
            snippet: rawMessage.snippet || '',
            attachments
          };

          const fetchAttachment = async (msgId: string, attId: string) => {
            return await gmailClient.getAttachment(user.google_refresh_token, msgId, attId);
          };

          const result = await extractionService.extractTransactionFromEmail(user.id, simplifiedMessage, fetchAttachment);

          if (result.status === 'success' && result.transaction) {
            // Use card cache to avoid repeated DB queries
            const cardKey = `${result.transaction.bankName}:${result.transaction.lastFourDigits}`;
            let card = cardCache.get(cardKey);

            if (!card) {
              card = await cardsQueries.findCardByBankAndLastFour(
                user.id,
                result.transaction.bankName,
                result.transaction.lastFourDigits
              );

              // If card not found, auto-create it
              if (!card) {
                console.log(`[HistoricalScanner] Card not found for ${result.transaction.bankName} ${result.transaction.lastFourDigits}, creating new card...`);
                try {
                  card = await cardsQueries.createCard({
                    userId: user.id,
                    cardName: `${result.transaction.bankName} ${result.transaction.lastFourDigits}`,
                    bankName: result.transaction.bankName,
                    lastFour: result.transaction.lastFourDigits,
                    billDate: 1, // Default
                    dueDate: 10, // Default
                    creditLimit: 0, // Default/Unknown
                  });
                } catch (createErr) {
                  console.error(`[HistoricalScanner] Failed to auto-create card:`, createErr);
                }
              }

              // Cache the card for future lookups
              if (card) {
                cardCache.set(cardKey, card);
              }
            }

            if (card) {
              // Create fingerprint for deduplication
              const fingerprintData = `${rawMessage.id}-${result.transaction.transactionDate.toISOString()}-${result.transaction.amount}-${result.transaction.merchant}`;
              const crypto = require('crypto');
              const txnFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

              const txDate = require('dayjs')(result.transaction.transactionDate);

              // Add to bulk insert buffer instead of inserting immediately
              transactionsToInsert.push({
                userId: user.id,
                cardId: card.id,
                transactionDate: result.transaction.transactionDate,
                merchant: result.transaction.merchant,
                category: result.transaction.category || 'Others',
                amount: result.transaction.amount,
                transactionType: 'debit',
                billMonth: txDate.month() + 1,
                billYear: txDate.year(),
                emailMessageId: rawMessage.id || '',
                txnFingerprint,
                isManuallyAdded: false,
                exactTimestamp: result.transaction.exactTimestamp,
                emailSubject: result.transaction.emailSubject,
                gmailThreadId: result.transaction.gmailThreadId,
                gmailAccountIndex: 1,
                currencyCode: result.transaction.currencyCode,
                originalAmount: result.transaction.originalAmount,
                referenceNumber: result.transaction.referenceNumber,
                transactionSubtype: result.transaction.transactionType,
                messageId: rawMessage.id, // For later processed status update
                logIndex: index, // To update log entry later
              });
            }
          }

          processed++;

        } catch (err) {
          console.error(`[HistoricalScanner] Error processing transaction for ${rawMessage.id}:`, err);
          errors++;
          errorList.push({ messageId: rawMessage.id, error: String(err) });
        }
      }));

      await Promise.all(transactionTasks);

      // 5. Bulk Insert Transactions
      if (transactionsToInsert.length > 0) {
        console.log(`[HistoricalScanner] Bulk inserting ${transactionsToInsert.length} transactions...`);

        const transactionsQueries = await import('../db/queries/transactions.queries');
        const insertedTransactions = await transactionsQueries.createTransactionsBulk(transactionsToInsert);

        inserted += insertedTransactions.length;

        // 6. Bulk Update Processed Status
        const processedUpdates = transactionsToInsert.map((tx, idx) => ({
          userId: user.id,
          messageId: tx.messageId,
          transactionId: insertedTransactions[idx]?.id,
        }));

        if (processedUpdates.length > 0) {
          await scannedEmailQueries.updateScannedEmailsProcessedBulk(processedUpdates);
        }

        // 7. Update log entries with transaction IDs
        insertedTransactions.forEach((tx, idx) => {
          const logIdx = transactionsToInsert[idx].logIndex;
          if (logEntries[logIdx]) {
            logEntries[logIdx].processed = true;
            logEntries[logIdx].transactionId = tx.id;
          }
        });
      }

      console.log(`[HistoricalScanner] Batch ${currentBatchNumber} Summary: Processed=${processed}, Inserted=${inserted}, Errors=${errors}`);

      // 8. Buffer Logs (Write only when buffer is full or at end)
      logBuffer.push(...logEntries.map(e => JSON.stringify(e)));

      if (logBuffer.length >= LOG_BUFFER_SIZE || !hasMore) {
        const logChunk = logBuffer.join('\n') + '\n';
        logStream.write(logChunk);
        logBuffer = []; // Clear buffer
      }

      // 9. Update job progress (reduced frequency)
      if (totalMessages % STATUS_UPDATE_INTERVAL < batchCount || !hasMore) {
        await pool.query(
          `UPDATE gmail_sync_jobs 
           SET processed_count = $1, saved_count = $2, error_count = $3, last_update_at = NOW()
           WHERE id = $4`,
          [processed, inserted, errors, jobId]
        );
      }

    } // End while

    logStream.end();

    // Mark job as completed
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'completed', current_step = 'COMPLETED', processed_count = $1, saved_count = $2, error_count = $3, 
           errors = $4, completed_at = NOW(), last_update_at = NOW()
       WHERE id = $5`,
      [processed, inserted, errors, JSON.stringify(errorList.slice(-50)), jobId]
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
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'failed', errors = $1, completed_at = NOW(), last_update_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown error' }]), jobId]
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
