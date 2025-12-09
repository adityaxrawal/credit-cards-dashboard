
import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import * as gmailClient from '../src/lib/gmailClient';
import { CreditCardMailDetector } from '../src/services/CreditCardMailDetector';
import fs from 'fs';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifySync() {
    try {
        console.log('Starting Gmail Sync Verification...');

        // Get first user
        const { rows: users } = await pool.query('SELECT id, email, google_refresh_token FROM users LIMIT 1');
        if (users.length === 0) {
            console.error('No users found in DB');
            process.exit(1);
        }

        const user = users[0];
        console.log(`Verifying sync for user: ${user.email} (${user.id})`);

        if (!user.google_refresh_token) {
            console.error('User not connected to Gmail');
            process.exit(1);
        }

        // DB Count
        const dbCountRes = await pool.query('SELECT COUNT(*) FROM gmail_scanned_emails WHERE user_id = $1', [user.id]);
        const totalDb = parseInt(dbCountRes.rows[0].count);
        console.log(`Total Emails in DB: ${totalDb}`);

        // Build Query
        const senderFilter = CreditCardMailDetector.SENDER_DOMAINS
            .map(domain => `from:"${domain}"`)
            .join(' OR ');
        const query = `after:2023/09/30 (${senderFilter})`;

        console.log(`Using Gmail Query: ${query}`);

        // Stream Check
        let gmailCount = 0;
        let missingCount = 0;
        const missingIds: string[] = [];
        const BATCH_SIZE = 500;
        let pageToken: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const response = await gmailClient.listMessages(user.google_refresh_token, query, BATCH_SIZE, pageToken);
            const messages = response.messages;
            pageToken = response.nextPageToken;

            if (!messages || messages.length === 0) {
                if (!pageToken) hasMore = false;
                continue;
            }

            gmailCount += messages.length;
            const batchIds = messages.map(m => m.id);

            const { rows: found } = await pool.query(
                `SELECT message_id FROM gmail_scanned_emails WHERE user_id = $1 AND message_id = ANY($2)`,
                [user.id, batchIds]
            );

            const foundSet = new Set(found.map((r: any) => r.message_id));

            for (const id of batchIds) {
                if (!foundSet.has(id)) {
                    missingCount++;
                    if (missingIds.length < 50) missingIds.push(id);
                }
            }

            process.stdout.write(`\rChecked ${gmailCount} messages... (Missing: ${missingCount})`);

            if (!pageToken) hasMore = false;
        }

        console.log('\n');
        console.log('----------------------------------------');
        console.log(`Verification Complete`);
        console.log(`Gmail Total: ${gmailCount}`);
        console.log(`DB Total: ${totalDb}`);
        console.log(`Missing in DB: ${missingCount}`);

        if (missingCount > 0) {
            console.log('First 50 Missing IDs:', missingIds);
            console.log('FAIL: Sync is incomplete.');
            process.exit(1);
        } else {
            console.log('SUCCESS: All Gmail messages found in DB.');
            process.exit(0);
        }

    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifySync();
