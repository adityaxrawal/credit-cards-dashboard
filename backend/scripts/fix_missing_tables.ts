
import pool from '../src/lib/db';
import logger from '../src/utils/infrastructure/logger';

async function fixSchema() {
    try {
        console.log('Starting schema fix...');

        // 1. Create recurring_patterns table
        console.log('Creating recurring_patterns table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recurring_patterns (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                merchant VARCHAR(255),
                merchant_normalized VARCHAR(255),
                typical_amount DECIMAL(15, 2),
                amount_variance DECIMAL(15, 2),
                frequency_type VARCHAR(50),
                frequency_days INTEGER,
                day_of_month INTEGER,
                day_of_week INTEGER,
                first_occurrence TIMESTAMP,
                last_occurrence TIMESTAMP,
                next_expected TIMESTAMP,
                category VARCHAR(100),
                category_id UUID REFERENCES categories(id),
                transaction_type VARCHAR(50),
                instrument_type VARCHAR(50),
                instrument_id UUID REFERENCES instruments(id),
                status VARCHAR(50) DEFAULT 'active',
                confidence_score DECIMAL(5,2),
                occurrence_count INTEGER DEFAULT 0,
                is_subscription BOOLEAN DEFAULT false,
                subscription_type VARCHAR(50),
                is_auto_detected BOOLEAN DEFAULT true,
                user_confirmed BOOLEAN DEFAULT false,
                matched_transaction_ids TEXT[], 
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, merchant_normalized, frequency_type)
            );
        `);
        console.log('✅ recurring_patterns table created/verified.');

        // 2. Add raw_snippet to gmail_scanned_emails if missing
        console.log('Checking gmail_scanned_emails columns...');
        await pool.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE gmail_scanned_emails ADD COLUMN raw_snippet TEXT;
                    RAISE NOTICE 'Added raw_snippet column';
                EXCEPTION
                    WHEN duplicate_column THEN RAISE NOTICE 'raw_snippet column already exists';
                END;
            END $$;
        `);
        console.log('✅ gmail_scanned_emails schema verified.');

    } catch (error) {
        console.error('❌ Schema Fix Failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

fixSchema();
