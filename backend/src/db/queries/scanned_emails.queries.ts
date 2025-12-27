import pool from '../../lib/db';

export interface ScannedEmailData {
  userId: string;
  messageId: string;
  internalDate: number;
  subject: string;
  sender: string;
  snippet: string;
  isTransaction: boolean;
  detectionConfidence: number;
  detectionReason: string;
  scanJobId: string;
}

export interface ScanStats {
  totalScanned: number;
  totalProcessed: number;
  totalTransactions: number;
  lastScannedDate: Date | null;
}

/**
 * Get the last scanned email date for a user
 */
export async function getLastScannedDate(userId: string): Promise<Date | null> {
  const { rows } = await pool.query(
    `SELECT MAX(internal_date) as last_date 
     FROM gmail_scanned_emails 
     WHERE user_id = $1`,
    [userId]
  );

  if (rows[0]?.last_date) {
    // Convert Unix timestamp (milliseconds) to Date
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
      is_transaction, detection_confidence, detection_reason, scan_job_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id, message_id) 
    DO UPDATE SET
      is_transaction = EXCLUDED.is_transaction,
      detection_confidence = EXCLUDED.detection_confidence,
      detection_reason = EXCLUDED.detection_reason,
      scan_job_id = EXCLUDED.scan_job_id,
      scanned_at = NOW()`,
    [
      data.userId,
      data.messageId,
      data.internalDate,
      data.subject,
      data.sender,
      data.snippet,
      data.isTransaction,
      data.detectionConfidence,
      data.detectionReason,
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

    // We can't easily do a single huge INSERT with arrays in node-postgres without unnest or generating a huge query string.
    // Generating a query string is efficient enough for batches of 50-100.

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const data of dataList) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`);
      values.push(
        data.userId,
        data.messageId,
        data.internalDate,
        data.subject,
        data.sender,
        data.snippet,
        data.isTransaction,
        data.detectionConfidence,
        data.detectionReason,
        data.scanJobId
      );
      paramIndex += 10;
    }

    const query = `
      INSERT INTO gmail_scanned_emails (
        user_id, message_id, internal_date, subject, sender, snippet,
        is_transaction, detection_confidence, detection_reason, scan_job_id
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_id, message_id) 
      DO UPDATE SET
        is_transaction = EXCLUDED.is_transaction,
        detection_confidence = EXCLUDED.detection_confidence,
        detection_reason = EXCLUDED.detection_reason,
        scan_job_id = EXCLUDED.scan_job_id,
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

    // Build a CASE statement for efficient bulk updates
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
      COUNT(*) FILTER (WHERE is_transaction = true) as total_transactions,
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
    lastScannedDate: row.last_date ? new Date(parseInt(row.last_date)) : null
  };
}
