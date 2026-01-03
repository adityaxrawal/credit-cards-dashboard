
import { Client } from 'pg';
import { env } from '../src/shared/config/env';
import { MERCHANT_RULES } from '../src/data/merchants';

const seed = async () => {
    console.log(`Connecting to DB...`);
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Seeding merchants...');

        let count = 0;
        for (const rule of MERCHANT_RULES) {
            // 1. Insert Merchant
            const res = await client.query(`
                INSERT INTO merchants (name, default_category, is_subscription_capable, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (name) DO UPDATE SET 
                    default_category = EXCLUDED.default_category,
                    updated_at = NOW()
                RETURNING id;
            `, [rule.canonicalName, rule.category, false]);

            let merchantId = res.rows[0]?.id;

            // If already existed (upsert didn't return ID if valid?), strictly referencing
            if (!merchantId) {
                const fetchRes = await client.query('SELECT id FROM merchants WHERE name = $1', [rule.canonicalName]);
                merchantId = fetchRes.rows[0]?.id;
            }

            if (!merchantId) {
                console.error(`Failed to get ID for ${rule.canonicalName}`);
                continue;
            }

            // 2. Insert Canonical Alias (Exact)
            await client.query(`
                INSERT INTO merchant_aliases (merchant_id, alias, match_type, confidence_penalty)
                VALUES ($1, $2, 'exact', 0.0)
                ON CONFLICT (alias, match_type) DO NOTHING
            `, [merchantId, rule.canonicalName.toLowerCase()]);

            // 3. Insert Aliases
            for (const alias of rule.aliases) {
                await client.query(`
                    INSERT INTO merchant_aliases (merchant_id, alias, match_type, confidence_penalty)
                    VALUES ($1, $2, 'exact', 0.0)
                    ON CONFLICT (alias, match_type) DO NOTHING
                `, [merchantId, alias.toLowerCase()]);
            }

            // 4. Insert Fuzzy Patterns
            for (const pattern of rule.fuzzyPatterns) {
                await client.query(`
                    INSERT INTO merchant_aliases (merchant_id, alias, match_type, confidence_penalty)
                    VALUES ($1, $2, 'fuzzy', 0.1)
                    ON CONFLICT (alias, match_type) DO NOTHING
                `, [merchantId, pattern.toLowerCase()]);
            }
            count++;
        }
        console.log(`Seeding complete. Processed ${count} merchants.`);
    } catch (e) {
        console.error('Seeding failed:', e);
    } finally {
        await client.end();
    }
};

seed();
