-- 005_add_multicurrency_fields.sql

-- Stores the original amount before conversion (e.g. 100 for $100)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2);

-- Stores the original currency code (e.g. 'USD')
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3) DEFAULT 'INR';

-- Stores the exchange rate used for conversion (e.g. 84.50)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4);

-- Stores whether the conversion was skipped or failed
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS conversion_skipped BOOLEAN DEFAULT FALSE;

-- Index for searching by foreign currency
CREATE INDEX IF NOT EXISTS idx_transactions_original_currency ON transactions(original_currency);
