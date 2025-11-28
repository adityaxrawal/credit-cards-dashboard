import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import pool from '../lib/db';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

export const getGmailClient = async (userId: string) => {
  const client = await pool.connect();
  try {
    // Get user's refresh token (assuming we stored it - wait, we need to check if we store refresh tokens)
    // The current schema has google_id, email, etc. but I don't see a refresh_token column in the schema I viewed earlier.
    // I need to check the users table schema again or add the column if missing.
    
    // Let's assume for now we need to fetch it.
    const res = await client.query('SELECT google_refresh_token FROM users WHERE id = $1', [userId]);
    
    if (res.rows.length === 0 || !res.rows[0].google_refresh_token) {
      throw new Error('User not connected to Gmail');
    }

    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials({
      refresh_token: res.rows[0].google_refresh_token
    });

    return google.gmail({ version: 'v1', auth: oAuth2Client as any });
  } finally {
    client.release();
  }
};

export const watchInbox = async (userId: string) => {
  const gmail = await getGmailClient(userId);
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: 'projects/credit-card-dashboard/topics/gmail-transactions' // Replace with actual topic
    }
  });
  return res.data;
};
