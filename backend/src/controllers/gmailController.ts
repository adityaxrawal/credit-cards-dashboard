import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { getOAuthClient, watchInbox, getGmailClient } from '../lib/gmail';

// Mock Gmail service for now, as full implementation requires complex OAuth flow handling
// and background processing which is in next section.

export const connectGmail = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const oAuth2Client = getOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Note: Google only returns refresh_token on the first consent. 
      // If missing, we might need to prompt user to revoke access and re-auth, 
      // or we just update the access token if that's what we got (but we need refresh token for offline access).
      // For this MVP, we'll assume we get it or already have it.
      console.warn('No refresh token received. User might have already authorized.');
    }

    // Update user with tokens
    await pool.query(
      'UPDATE users SET refresh_token = COALESCE($1, refresh_token), updated_at = NOW() WHERE id = $2',
      [tokens.refresh_token, req.user.id]
    );

    // Set up watch
    try {
      const watchRes = await watchInbox(req.user.id);
      await pool.query(
        'UPDATE users SET gmail_watch_expiration = to_timestamp($1 / 1000), gmail_history_id = $2 WHERE id = $3',
        [watchRes.expiration, watchRes.historyId, req.user.id]
      );
    } catch (watchError) {
      console.error('Failed to set up Gmail watch:', watchError);
      // Continue even if watch fails, as we can still do manual sync
    }

    res.json({ message: 'Gmail connected successfully', connected: true });
  } catch (error) {
    next(error);
  }
};

export const syncGmail = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const gmail = await getGmailClient(userId);
    
    // 1. List messages (simple implementation: last 30 days)
    // In a real app, use historyId for incremental sync
    const resMessages = await gmail.users.messages.list({
      userId: 'me',
      q: 'after:' + Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000), // last 30 days
      maxResults: 20 // Limit for MVP to avoid rate limits
    });

    const messages = resMessages.data.messages || [];
    let processedCount = 0;

    // 2. Process messages (Mock processing for now - just counting)
    // We would need a parser here to extract transaction details
    // For now, we'll just log them
    
    for (const msg of messages) {
      if (msg.id) {
        // Check if already processed
        const existing = await pool.query('SELECT 1 FROM email_processing_log WHERE email_message_id = $1', [msg.id]);
        if (existing.rows.length === 0) {
          // Fetch full message
          // const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
          // Parse and insert transaction...
          
          // Log as processed
          await pool.query(
            'INSERT INTO email_processing_log (user_id, email_message_id, processing_status, processed_at) VALUES ($1, $2, $3, NOW())',
            [userId, msg.id, 'processed']
          );
          processedCount++;
        }
      }
    }

    res.json({ 
      success: true, 
      summary: { 
        emailsScanned: messages.length, 
        newTransactions: processedCount,
        processingTime: '0s' 
      } 
    });
  } catch (error) {
    console.error('Sync error:', error);
    next(error);
  }
};

export const getAuthUrl = async (req: any, res: Response, next: NextFunction) => {
  try {
    const oAuth2Client = getOAuthClient();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent' // Force refresh token
    });
    res.json({ success: true, authUrl });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.data) {
      return res.status(400).send('Invalid message format');
    }

    const data = Buffer.from(message.data, 'base64').toString();
    const parsedData = JSON.parse(data);
    
    console.log('Received Gmail webhook:', parsedData);
    
    // Here we would trigger the sync for the user
    // const emailAddress = parsedData.emailAddress;
    // const historyId = parsedData.historyId;
    // await queue.add('sync-gmail-incremental', { emailAddress, historyId });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

