import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import * as extractionService from '../services/extraction.service';
import * as transactionsService from '../services/transactions.service';
import * as cardsQueries from '../db/queries/cards.queries';
import * as scannedEmailQueries from '../db/queries/scanned_emails.queries';
import { CreditCardMailDetector } from '../services/CreditCardMailDetector';
import { gmail_v1 } from 'googleapis'; // ADDED IMPORT
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationService } from '../services/notification.service'; // ADDED

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

    // Verify Ollama is healthy before starting scan
    const { OllamaService } = await import('../services/ollama.service');
    const ollamaHealthy = await OllamaService.healthCheck();
    if (!ollamaHealthy) {
      throw new Error('Ollama is not available or model is not loaded. Please run: ollama pull deepseek-r1:8b');
    }
    await OllamaService.warmup();
    console.log('[HistoricalScanner] Ollama model ready');

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

    // Optimize query by filtering for known bank senders AND transaction keywords
    const senderFilter = CreditCardMailDetector.SENDER_DOMAINS
      .map(domain => `from:"${domain}"`)
      .join(' OR ');

    // Add keyword filter to be more robust (User Request)
    const keywordFilter = CreditCardMailDetector.TRANSACTION_KEYWORDS
      .map(kw => `"${kw}"`) // Quote keywords for exact phrase or strong match
      .join(' OR ');

    // Query: (Senders) AND (Keywords) - Exclude promo/social/forums for better precision
    const query = `after:${from} before:${to} ({${senderFilter}}) ({${keywordFilter}}) -category:promotions -category:social -category:forums`;

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
    const CONCURRENCY = 20; // Lower concurrency for Detection to avoid queuing explosion (since Ollama is sequential)
    const BULK_INSERT_BATCH = 100; // Batch size for bulk transaction inserts
    const LOG_BUFFER_SIZE = 10000; // Buffer 10000 log entries before flush
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
    let logBuffer: string[] = [];

    let hasMore = true;

    // Pipeline: We need to fetch the first chunk to start the loop
    let nextChunkPromise = gmailClient.listMessages(user.google_refresh_token, query, CHUNK_SIZE, pageToken);

    // Start Heartbeat for Frontend (New)
    NotificationService.startHeartbeat(() => ({
      processedCount: processed,
      pendingCount: Math.max(0, totalMessages - processed),
      isRunning: true,
      jobId: jobId
    }));

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
        nextChunkPromise = Promise.resolve({ messages: [] });
      }

      if (!messages || messages.length === 0) {
        if (!hasMore) break;
        continue;
      }

      const batchCount = messages.length;
      totalMessages += batchCount;

      console.log(`[HistoricalScanner] Batch ${currentBatchNumber}: Processing ${batchCount} messages...`);

      // 0. Idempotency Check: Filter out messages that are ALREADY PROCESSED
      // Note: We might want to re-process if we updated the logic. 
      // But for speed, assuming check is valid.
      const messageIds = messages.map(m => m.id);
      const processedSet = await scannedEmailQueries.getProcessedMessageIds(user.id, messageIds);

      const idsToProcess = messageIds.filter(id => !processedSet.has(id));
      const skippedCount = messageIds.length - idsToProcess.length;

      if (idsToProcess.length === 0) {
        console.log(`[HistoricalScanner] Batch ${currentBatchNumber}: All ${batchCount} messages already processed. Skipping.`);
        // Even if skipped, we should update progress
        processed += skippedCount; // We count them as "processed" in terms of progress
        continue;
      }

      console.log(`[HistoricalScanner] Batch ${currentBatchNumber}: ${skippedCount} skipped (already processed), ${idsToProcess.length} to process.`);

      // Update job status at START of each batch
      await pool.query(
        `UPDATE gmail_sync_jobs 
         SET total_messages = $1, current_step = 'FETCHING_BATCH', 
             metadata = jsonb_set(
               jsonb_set(COALESCE(metadata, '{}'), '{currentBatch}', $2::jsonb),
               '{toProcess}', $3::jsonb
             ),
             last_update_at = NOW() 
         WHERE id = $4`,
        [totalMessages, JSON.stringify(currentBatchNumber), JSON.stringify(idsToProcess.length), jobId]
      );

      // 1. Batch Fetch Raw Messages (Parallel)
      const rawMessages = await gmailClient.batchGetMessages(user.google_refresh_token, idsToProcess, 50);

      // Update status after fetch, before ML
      await pool.query(
        `UPDATE gmail_sync_jobs 
         SET current_step = 'PROCESSING_ML', last_update_at = NOW() 
         WHERE id = $1`,
        [jobId]
      );

      // 1b. Batch Detect (Concurrent calls to Detect)
      // We process only valid messages
      const validMessages = rawMessages.filter(m => m !== null) as gmail_v1.Schema$Message[];

      // Map validMessages to detections concurrently
      // pLimit ensures we don't flood, but OllamaService internal limit ensures sequentiality
      const detectionResults = await Promise.all(
        validMessages.map(msg => limit(() => CreditCardMailDetector.detect(msg)))
      );

      // Update status after ML detection completes
      await pool.query(
        `UPDATE gmail_sync_jobs 
         SET current_step = 'INSERTING', last_update_at = NOW() 
         WHERE id = $1`,
        [jobId]
      );

      // 2. Process Messages in Memory
      const scannedDataList: any[] = [];
      const logEntries: any[] = [];
      const transactionMessages: any[] = []; // To process for transactions
      const transactionsToInsert: any[] = []; // Accumulate for bulk insert

      // We align detectionResults with validMessages
      // rawMessages might have nulls, so we iterate validMessages for the results

      for (let i = 0; i < validMessages.length; i++) {
        const rawMessage = validMessages[i];
        const detection = detectionResults[i];

        try {
          const headers = rawMessage.payload?.headers || [];
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
          const sender = headers.find((h: any) => h.name === 'From')?.value || '';
          const snippet = rawMessage.snippet || '';
          const internalDate = parseInt(rawMessage.internalDate || '0');

          // Prepare for Bulk Insert with ML fields
          scannedDataList.push({
            userId: user.id,
            messageId: rawMessage.id || '',
            internalDate,
            subject,
            sender,
            snippet,
            cleanedText: detection.cleanedText || '',
            mlIsTransaction: detection.isTransaction,
            mlCategory: detection.category,
            mlConfidence: detection.confidence,
            mlMerchant: detection.merchant,
            needsReview: detection.needsReview || false,
            parseEvidence: detection.mlRawResponse ? JSON.stringify(detection.mlRawResponse) : null,
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
              category: detection.category,
              confidence: detection.confidence,
              merchant: detection.merchant,
              amount: detection.amount,
              needsReview: detection.needsReview,
              error: detection.error
            },
            processed: false,
            transactionId: null
          });

          if (detection.isTransaction) {
            transactionMessages.push({ rawMessage, index: i, merchant: detection.merchant, detection });
          } else {
            processed++;
          }

        } catch (err) {
          console.error(`[HistoricalScanner] Error processing message ${rawMessage.id}:`, err);
          errors++;
        }
      }

      // 3. Bulk Insert Scanned Emails ('Checkpoint')
      if (scannedDataList.length > 0) {
        await scannedEmailQueries.insertScannedEmailsBulk(scannedDataList);
      }

      // 4. Process Transactions (Parallel)
      // extractionService now uses the ML fields from `detection` directly!
      const transactionTasks = transactionMessages.map(({ rawMessage, index, detection }) => limit(async () => {
        try {
          // Construct simplified message for extraction service logic
          const headers = rawMessage.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          // Re-parsing attachments info in case extracting logic needs it (e.g. PDF fallback)
          // Though we assume detection covered it.
          const getAttachments = (parts: any[]): any[] => {
            let attachments: any[] = [];
            for (const part of parts) {
              if (part.filename && part.body?.attachmentId) {
                attachments.push({ id: part.body.attachmentId, filename: part.filename, mimeType: part.mimeType });
              }
              if (part.parts) {
                attachments = attachments.concat(getAttachments(part.parts));
              }
            }
            return attachments;
          };
          const attachments = rawMessage.payload?.parts ? getAttachments(rawMessage.payload.parts) : [];

          const simplifiedMessage = {
            id: rawMessage.id!,
            threadId: rawMessage.threadId!,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            date: new Date(parseInt(rawMessage.internalDate || '0')),
            bodyText: detection.cleanedText, // already cleaned
            bodyHtml: '',
            snippet: rawMessage.snippet || '',
            attachments
          };

          const fetchAttachment = async (msgId: string, attId: string) => {
            return await gmailClient.getAttachment(user.google_refresh_token, msgId, attId);
          };

          // Pass the pre-computed detection
          const result = await extractionService.extractTransactionFromEmail(user.id, simplifiedMessage, fetchAttachment, detection);

          if (result.status === 'success' && result.transaction) {
            // Use card cache to avoid repeated DB queries
            const cardKey = `${result.transaction.bankName}:${result.transaction.lastFourDigits}`;
            let card = cardCache.get(cardKey);

            if (!card) {
              card = await cardsQueries.findCardByBankAndLastFour(user.id, result.transaction.bankName, result.transaction.lastFourDigits);
              if (!card) {
                try {
                  card = await cardsQueries.createCard({
                    userId: user.id,
                    cardName: `${result.transaction.bankName} ${result.transaction.lastFourDigits}`,
                    bankName: result.transaction.bankName,
                    lastFour: result.transaction.lastFourDigits,
                    billDate: 1, dueDate: 10, creditLimit: 0
                  });
                } catch (createErr) {
                  // ignore
                }
              }
              if (card) cardCache.set(cardKey, card);
            }

            if (card) {
              // Fingerprint & Insert
              const fingerprintData = `${rawMessage.id}-${result.transaction.transactionDate.toISOString()}-${result.transaction.amount}-${result.transaction.merchant}`;
              const crypto = require('crypto');
              const txnFingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');
              const txDate = require('dayjs')(result.transaction.transactionDate);

              transactionsToInsert.push({
                userId: user.id,
                cardId: card.id,
                transactionDate: result.transaction.transactionDate,
                merchant: result.transaction.merchant, // FIXED: use result.transaction.merchant
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
                messageId: rawMessage.id,
                logIndex: index
              });
            }
          } else {
            console.warn(`[HistoricalScanner] Extraction incomplete for ${rawMessage.id}: ${result.error}`);
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

        // 6. Update processed status
        const transactionIds = transactionsToInsert.map(t => ({ userId: user.id, messageId: t.messageId }));
        // Also update non-transactions that were processed
        const nonTxIds = scannedDataList.filter(d => !d.mlIsTransaction).map(d => ({ userId: user.id, messageId: d.messageId }));

        await scannedEmailQueries.updateScannedEmailsProcessedBulk([...transactionIds, ...nonTxIds]);

        // 7. Update log entries
        insertedTransactions.forEach((tx, idx) => {
          // We need to map back to original log entry. transactionsToInsert has logIndex relative to validMessages loop
          // Our logEntries array is also parallel to validMessages loop (pushed in same loop)
          // So logEntries[logIndex] is correct.
          const logIdx = transactionsToInsert[idx].logIndex;
          if (logEntries[logIdx]) {
            logEntries[logIdx].processed = true;
            logEntries[logIdx].transactionId = tx.id;
          }
        });
      } else {
        // Mark non-transactions as processed
        const nonTxIds = scannedDataList.map(d => ({ userId: user.id, messageId: d.messageId }));
        if (nonTxIds.length > 0) await scannedEmailQueries.updateScannedEmailsProcessedBulk(nonTxIds);
      }

      console.log(`[HistoricalScanner] Batch ${currentBatchNumber} Summary: Processed=${processed}, Inserted=${inserted}, Errors=${errors}.`);

      // 8. Buffer Logs
      logBuffer.push(...logEntries.map(e => JSON.stringify(e)));
      if (logBuffer.length >= LOG_BUFFER_SIZE || !hasMore) {
        const logChunk = logBuffer.join('\n') + '\n';
        logStream.write(logChunk);
        logBuffer = [];
      }

      // 9. Update job progress
      await pool.query(
        `UPDATE gmail_sync_jobs 
         SET processed_count = $1, saved_count = $2, error_count = $3, 
             current_step = 'PROCESSING_BATCH', last_update_at = NOW()
         WHERE id = $4`,
        [processed, inserted, errors, jobId]
      );

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

    NotificationService.stopHeartbeat(); // Stop Heartbeat

    return { total: totalMessages, processed, inserted, errors };

  } catch (error) {
    console.error(`[HistoricalScanner] Scan ${jobId} failed:`, error);
    await pool.query(
      `UPDATE gmail_sync_jobs 
       SET status = 'failed', errors = $1, completed_at = NOW(), last_update_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown error' }]), jobId]
    );
    NotificationService.stopHeartbeat(); // Stop Heartbeat
    throw error;
  }
}

if (require.main === module) {
  const userId = process.argv[2];
  const jobId = process.argv[3] || `manual-${Date.now()}`;
  if (!userId) { console.error('Usage: <userId> [jobId]'); process.exit(1); }
  pool.query(`INSERT INTO gmail_sync_jobs (id, user_id, status) VALUES ($1, $2, 'pending')`, [jobId, userId])
    .then(() => runHistoricalScan(userId, jobId))
    .then(r => { console.log('Done', r); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
