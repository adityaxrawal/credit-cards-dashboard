import pool from '../../lib/db';

/**
 * Scanned Email Data (ML Schema)
 * Updated for ML-based classification
 */
export interface ScannedEmailData {
  userId: string;
  messageId: string;
  internalDate: number;
  subject: string;
  sender: string;
  snippet: string;
  cleanedText: string;
  mlIsTransaction: boolean;
  mlCategory: string;
  mlConfidence: number;
  mlMerchant: string | null;
  needsReview: boolean;
  parseEvidence: string | null;
  scanJobId: string;
}

export interface ScanStats {
  totalScanned: number;
  totalProcessed: number;
  totalTransactions: number;
  lastScannedDate: Date | null;
  needsReviewCount: number;
}

/**
 * Get the last scanned email date for a user
 */
export async function getLastScannedDate(userId: string): Promise<Date | null> {
  const { rows } = await pool.query(
    `SELECT MAX(internal_date) as last_date 
     FROM gmail_scanned_emails 
     WHERE user_id = $1 AND processed = true`,
    [userId]
  );

  if (rows[0]?.last_date) {
    return new Date(parseInt(rows[0].last_date));
  }

  return null;
}

/**
 * Insert a scanned email record
 */
export async function insertScannedEmail(data: ScannedEmailData): Promise<void> {
  await pool.query(
    `INSERT INTO gmail_scanned_emails (
      user_id, message_id, internal_date, subject, sender, snippet,
      cleaned_text, ml_is_transaction, ml_category, ml_confidence, ml_merchant,
      needs_review, parse_evidence, scan_job_id,
      is_transaction, detection_confidence
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $8, $10)
    ON CONFLICT (user_id, message_id) 
    DO UPDATE SET
      ml_is_transaction = EXCLUDED.ml_is_transaction,
      ml_category = EXCLUDED.ml_category,
      ml_confidence = EXCLUDED.ml_confidence,
      ml_merchant = EXCLUDED.ml_merchant,
      needs_review = EXCLUDED.needs_review,
      parse_evidence = EXCLUDED.parse_evidence,
      scan_job_id = EXCLUDED.scan_job_id,
      is_transaction = EXCLUDED.ml_is_transaction,
      detection_confidence = EXCLUDED.ml_confidence,
      scanned_at = NOW()`,
    [
      data.userId,
      data.messageId,
      data.internalDate,
      data.subject,
      data.sender,
      data.snippet,
      data.cleanedText,
      data.mlIsTransaction,
      data.mlCategory,
      data.mlConfidence,
      data.mlMerchant,
      data.needsReview,
      data.parseEvidence,
      data.scanJobId
    ]
  );
}

/**
 * Bulk insert scanned email records
 */
export async function insertScannedEmailsBulk(dataList: ScannedEmailData[]): Promise<void> {
  if (dataList.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const data of dataList) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 7}, $${paramIndex + 9})`);
      values.push(
        data.userId,
        data.messageId,
        data.internalDate,
        data.subject,
        data.sender,
        data.snippet,
        data.cleanedText,
        data.mlIsTransaction,
        data.mlCategory,
        data.mlConfidence,
        data.mlMerchant,
        data.needsReview,
        data.parseEvidence,
        data.scanJobId
      );
      paramIndex += 14;
    }

    const query = `
      INSERT INTO gmail_scanned_emails (
        user_id, message_id, internal_date, subject, sender, snippet,
        cleaned_text, ml_is_transaction, ml_category, ml_confidence, ml_merchant,
        needs_review, parse_evidence, scan_job_id,
        is_transaction, detection_confidence
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_id, message_id) 
      DO UPDATE SET
        ml_is_transaction = EXCLUDED.ml_is_transaction,
        ml_category = EXCLUDED.ml_category,
        ml_confidence = EXCLUDED.ml_confidence,
        ml_merchant = EXCLUDED.ml_merchant,
        needs_review = EXCLUDED.needs_review,
        parse_evidence = EXCLUDED.parse_evidence,
        scan_job_id = EXCLUDED.scan_job_id,
        is_transaction = EXCLUDED.ml_is_transaction,
        detection_confidence = EXCLUDED.ml_confidence,
        scanned_at = NOW()
    `;

    await client.query(query, values);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update scanned email as processed
 */
export async function updateScannedEmailProcessed(
  userId: string,
  messageId: string,
  transactionId?: string
): Promise<void> {
  await pool.query(
    `UPDATE gmail_scanned_emails 
     SET processed = true, 
         processed_at = NOW(),
         created_transaction_id = $3
     WHERE user_id = $1 AND message_id = $2`,
    [userId, messageId, transactionId || null]
  );
}

/**
 * Bulk update scanned emails as processed
 */
export async function updateScannedEmailsProcessedBulk(
  updates: Array<{
    userId: string;
    messageId: string;
    transactionId?: string;
  }>
): Promise<void> {
  if (updates.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const messageIds = updates.map(u => u.messageId);
    const transactionIdCase = updates.map((u, idx) =>
      `WHEN message_id = $${idx + 2} THEN ${u.transactionId ? `'${u.transactionId}'` : 'NULL'}`
    ).join(' ');

    const query = `
      UPDATE gmail_scanned_emails
      SET processed = true, 
          processed_at = NOW(),
          created_transaction_id = (CASE ${transactionIdCase} END)::uuid
      WHERE user_id = $1 AND message_id = ANY($${updates.length + 2})
    `;

    await client.query(query, [updates[0].userId, ...messageIds, messageIds]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get scan statistics for a user
 */
export async function getScannedEmailStats(userId: string): Promise<ScanStats> {
  const { rows } = await pool.query(
    `SELECT 
      COUNT(*) as total_scanned,
      COUNT(*) FILTER (WHERE processed = true) as total_processed,
      COUNT(*) FILTER (WHERE ml_is_transaction = true OR is_transaction = true) as total_transactions,
      COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count,
      MAX(internal_date) as last_date
     FROM gmail_scanned_emails 
     WHERE user_id = $1`,
    [userId]
  );

  const row = rows[0];
  return {
    totalScanned: parseInt(row.total_scanned || '0'),
    totalProcessed: parseInt(row.total_processed || '0'),
    totalTransactions: parseInt(row.total_transactions || '0'),
    needsReviewCount: parseInt(row.needs_review_count || '0'),
    lastScannedDate: row.last_date ? new Date(parseInt(row.last_date)) : null
  };
}

/**
 * Check which message IDs have already been processed
 */
export async function getProcessedMessageIds(userId: string, messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();

  const { rows } = await pool.query(
    `SELECT message_id 
     FROM gmail_scanned_emails 
     WHERE user_id = $1 AND message_id = ANY($2) AND processed = true`,
    [userId, messageIds]
  );

  return new Set(rows.map(r => r.message_id));
}
