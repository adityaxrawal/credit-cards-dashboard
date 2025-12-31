
import { ruleService } from '../src/services/rules/RuleService';
import pool from '../src/lib/db';

async function verifyRules() {
    console.log('Verifying Rules Engine...');
    const client = await pool.connect();
    let userId: string;
    try {
        const userRes = await client.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length === 0) { console.log('No user'); return; }
        userId = userRes.rows[0].id;
    } finally {
        client.release();
    }

    // 1. Create Rule
    const rule = await ruleService.createRule(userId, {
        name: 'Test Rule',
        priority: 10,
        criteria: { field: 'merchant', operator: 'contains', value: 'Swiggy' },
        action: { category: 'Food & Dining' }
    });
    console.log('Created Rule:', rule.id);

    // 2. Fetch Rules
    const rules = await ruleService.getRules(userId);
    console.log('Fetched Rules Count:', rules.length);
    const found = rules.find(r => r.id === rule.id);
    if (found) console.log('✅ Rule persisted correctly');
    else console.error('❌ Rule not found');

    // 3. Evaluate Rule
    const match = await ruleService.evaluateTransaction(userId, {
        merchant: 'Swiggy Instamart',
        amount: 100,
        transactionType: 'debit',
        description: 'Order 123'
    } as any);

    if (match && match.ruleId === rule.id) {
        console.log('✅ Rule Evaluation: MATCHED', match);
    } else {
        console.error('❌ Rule Evaluation: FAILED', match);
    }

    // 4. Cleanup
    await ruleService.deleteRule(userId, rule.id);
    console.log('Cleanup done');
    process.exit(0);
}

verifyRules().catch(console.error);
