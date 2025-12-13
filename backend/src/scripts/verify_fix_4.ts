
import app from '../app';
import request from 'supertest';
import { gptQueueManager } from '../services/gptQueueManager';
import pool from '../lib/db';

async function verifyFix4() {
    console.log('--- Starting Fix 4 Verification ---');

    // 1. Setup Mock Data
    const userIdRes = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userIdRes.rows[0]?.id;
    if (!userId) {
        console.error('No user found');
        process.exit(1);
    }

    // Mock authentication middleware (simplified approach: skip auth or mock user in request)
    // Since we can't easily modify the running app's middleware here without mocking module,
    // we might need to rely on the fact that existing tests mock auth OR use a valid token.
    // For this script, let's try to mock the internal service call directly first to ensure logic is correct,
    // OR just instantiate the controller function?
    // Using supertest against 'app' requires auth.

    // Let's test the SERVICE logic directly first, as that covers 90% of the new code.
    // Testing the route requires auth setup which is complex in this script.

    try {
        console.log('Testing GmailService.getPipelineStats...');

        // Populate queue to verify stats
        gptQueueManager['queues'][1].push({ email: { id: 'test1' } as any, workerId: 1, userId });

        const { getPipelineStats } = require('../services/gmail.service');
        const stats = await getPipelineStats(userId);

        console.log('Stats Result:', JSON.stringify(stats, null, 2));

        if (stats.queues.queue1 >= 1) {
            console.log('✅ Queue stats visible.');
        } else {
            console.error('❌ Queue stats missing or empty.');
        }

        if (stats.connection) {
            console.log('✅ Connection stats visible.');
        }

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        await pool.end();
    }
}

verifyFix4();
