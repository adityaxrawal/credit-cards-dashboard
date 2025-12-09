import pool from '../lib/db';
import { processHistoryChanges } from './gmailHistoryHandler';

interface PubSubPayload {
  emailAddress: string;
  historyId: string;
}

/**
 * Gmail Pub/Sub Handler
 * 
 * Processes real-time Gmail notifications using ML-based classification.
 * Delegates to gmailHistoryHandler for incremental sync.
 */
export async function handleGmailPubSubMessage(payload: PubSubPayload) {
  console.log('[GmailPubSubHandler] Processing notification:', JSON.stringify(payload));

  const { emailAddress, historyId } = payload;

  try {
    // 1. Find user by email
    const { rows: users } = await pool.query(
      'SELECT id, gmail_history_id FROM users WHERE email = $1',
      [emailAddress]
    );

    if (users.length === 0) {
      console.log('[GmailPubSubHandler] User not found for email:', emailAddress);
      return;
    }

    const user = users[0];
    const lastHistoryId = user.gmail_history_id;

    if (!lastHistoryId) {
      console.log('[GmailPubSubHandler] User has no history ID - skipping (needs historical sync first)');
      return;
    }

    // 2. Process history changes using ML pipeline
    const result = await processHistoryChanges(user.id, lastHistoryId);

    // 3. Handle result
    if (result.requiresFullResync) {
      console.warn('[GmailPubSubHandler] History gap detected - full resync required');
      // Could trigger historical scan here if desired
      return;
    }

    console.log(`[GmailPubSubHandler] Completed: processed=${result.processed}, transactions=${result.transactions}`);

  } catch (error) {
    console.error('[GmailPubSubHandler] Error:', error);
  }
}

/**
 * Verify Pub/Sub notification signature (for production)
 */
export function verifyPubSubSignature(body: any): boolean {
  // In production, verify the JWT token from Google
  // For now, basic structure check
  if (!body?.message?.data) {
    return false;
  }
  return true;
}

/**
 * Decode Pub/Sub message data
 */
export function decodePubSubMessage(message: { data: string }): PubSubPayload | null {
  try {
    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);

    if (!payload.emailAddress || !payload.historyId) {
      console.error('[GmailPubSubHandler] Invalid payload:', payload);
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[GmailPubSubHandler] Failed to decode message:', error);
    return null;
  }
}
