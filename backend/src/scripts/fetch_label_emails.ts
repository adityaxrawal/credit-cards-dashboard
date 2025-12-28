
import * as path from 'path';
import * as dotenv from 'dotenv';
// Load env before other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';
import * as fs from 'fs';
import pool from '../lib/db';
import { decrypt } from '../utils/helpers/encryption';
import { listMessages, parseMessage, GmailMessage, getRawMessage } from '../lib/gmailClient';
import pLimit from 'p-limit';

// Concurrency Limit
const CONCURRENCY_LIMIT = 50;

async function fetchLabelEmails() {
    console.log(`Starting execution with concurrency: ${CONCURRENCY_LIMIT}...`);

    try {
        // 1. Get a user with a valid refresh token
        const { rows } = await pool.query(
            `SELECT id, google_refresh_token FROM users WHERE google_refresh_token IS NOT NULL LIMIT 1`
        );

        if (rows.length === 0) {
            console.error('No user found with google_refresh_token.');
            process.exit(1);
        }

        const user = rows[0];
        console.log(`Found user: ${user.id}`);


        // 2. Decrypt token
        const refreshToken = decrypt(user.google_refresh_token);

        // CLOSE DB CONNECTION NOW - We have what we need
        await pool.end();
        console.log('DB connection closed. Proceeding with Gmail operations...');

        // 3. Resolve Label ID
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Labels List
        const labelsRes = await gmail.users.labels.list({ userId: 'me' });
        const labels = labelsRes.data.labels;

        // Find target label (fuzzy match for debugging)
        const targetLabel = labels?.find((l: any) => l.name?.includes('Credit Card Dashboard'));

        // Try multiple query strategies
        const queriesToTry = [];
        if (targetLabel) {
            queriesToTry.push(`label:${targetLabel.id}`); // ID Strategy
            queriesToTry.push(`label:"${targetLabel.name}"`); // Name Strategy
        }
        queriesToTry.push('label:"Credit Card Dashboard"'); // Fallback Name

        let allMessageIds: string[] = [];
        let successfulQuery = '';

        for (const q of queriesToTry) {
            console.log(`Trying query: [${q}] ...`);
            let ids: string[] = [];
            let pageToken: string | undefined = undefined;

            try {
                const result = await listMessages(refreshToken, q, 100, undefined);
                ids = result.messages.map(m => m.id);
                console.log(`  -> Found ${ids.length} messages.`);

                if (ids.length > 0) {
                    successfulQuery = q;
                    allMessageIds = [...ids];
                    pageToken = result.nextPageToken;

                    // Fetch ALL IDs first
                    while (pageToken) {
                        const nextRes = await listMessages(refreshToken, q, 500, pageToken);
                        const nextIds = nextRes.messages.map(m => m.id);
                        allMessageIds.push(...nextIds);
                        pageToken = nextRes.nextPageToken;
                        process.stdout.write(`\r     Fetching IDs... Total: ${allMessageIds.length}`);
                    }
                    console.log('\n');
                    break;
                }
            } catch (e) {
                console.error(`  -> Query failed:`, e);
            }
        }

        console.log(`Total messages to fetch: ${allMessageIds.length}`);

        if (allMessageIds.length === 0) {
            console.log('No messages found with any strategy.');
            process.exit(0);
        }

        // 5. Batch Fetching (True Batch API)
        console.log(`\nSwitched to Batch API Mode. Processing ${allMessageIds.length} messages...`);

        const BATCH_SIZE = 25; // Reduce to avoid "Too many concurrent requests"
        const batches = [];
        for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
            batches.push(allMessageIds.slice(i, i + BATCH_SIZE));
        }

        const allEmails: GmailMessage[] = [];
        let processedBatches = 0;
        const startTime = Date.now();

        // Helper to parse multipart response
        const parseMultipartResponse = (body: string, boundary: string) => {
            const parts = body.split(`--${boundary}`).filter(p => p.trim().length > 0 && !p.trim().startsWith('--'));
            const msgs: GmailMessage[] = [];

            for (const part of parts) {
                // Find JSON body start (after headers)
                const jsonStart = part.indexOf('{');
                if (jsonStart !== -1) {
                    try {
                        const jsonStr = part.substring(jsonStart);
                        const data = JSON.parse(jsonStr);
                        if (data.id) { // Check if valid message object
                            msgs.push(parseMessage(data));
                        } else if (data.error) {
                            // Log error sampling
                            if (Math.random() < 0.01) console.error(`[Batch Part Error] ${data.error.code} ${data.error.message}`);
                        }
                    } catch (e) {
                        // Ignore parse errors for individual parts
                    }
                }
            }
            return msgs;
        };

        const fetchBatch = async (batchIds: string[]) => {
            if (batchIds.length === 0) return;

            // Construct Multipart Body
            const boundary = `batch_${Date.now()}`;
            let body = '';

            for (const id of batchIds) {
                body += `--${boundary}\r\n`;
                body += 'Content-Type: application/http\r\n\r\n';
                body += `GET /gmail/v1/users/me/messages/${id}?format=full\r\n\r\n`;
            }
            body += `--${boundary}--`;

            try {
                const res = await oauth2Client.request({
                    url: 'https://gmail.googleapis.com/batch/gmail/v1',
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/mixed; boundary=${boundary}`
                    },
                    data: body, // 'body' property in gaxios/axios is usually 'data'
                    responseType: 'text' // Force response as text
                });

                // Extract boundary from response header
                const resContentType = (res.headers['content-type'] || res.headers['Content-Type']) as string;
                if (!resContentType?.includes('boundary=')) {
                    console.error('  -> Invalid batch response (no boundary)');
                    return;
                }
                const resBoundary = resContentType.split('boundary=')[1].split(';')[0].replace(/^"|"$/g, '');

                const msgs = parseMultipartResponse(res.data as string, resBoundary);
                allEmails.push(...msgs);

                // Throttle batches slightly to let internal concurrency limit settle
                await new Promise(r => setTimeout(r, 500));

            } catch (e: any) {
                console.error('Batch failed:', e.message);
            } finally {
                processedBatches++;
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = Math.round(allEmails.length / elapsed);
                process.stdout.write(`\rFetching... ${allEmails.length}/${allMessageIds.length} (Rate: ${rate} msgs/sec)`);
            }
        };

        // Run batches with high concurrency (limit number of BATCHES in flight, not messages)
        // 10 concurrent batches = 1000 messages in flight
        const batchLimit = pLimit(1);
        const tasks = batches.map(b => batchLimit(() => fetchBatch(b)));

        await Promise.all(tasks);

        console.log('\nDone.');

        // 6. Save results
        const outputPath = path.resolve(process.cwd(), 'emails_dump.json');
        fs.writeFileSync(outputPath, JSON.stringify(allEmails, null, 2));
        console.log(`Saved ${allEmails.length} emails to ${outputPath}`);

    } catch (error) {
        console.error('Error in script:', error);
    }
}

fetchLabelEmails();
