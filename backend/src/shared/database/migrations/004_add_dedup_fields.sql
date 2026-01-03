-- 004_add_dedup_fields.sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rrn VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS arn VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upi_ref VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS imps_ref VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS swift_id VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_txn_id VARCHAR(50);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS canonical_txn_id UUID REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fingerprint_hash VARCHAR(255);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 3);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS extracted_from UUID;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merged_with UUID REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merge_reason VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_transactions_rrn ON transactions(rrn);
CREATE INDEX IF NOT EXISTS idx_transactions_arn ON transactions(arn);
CREATE INDEX IF NOT EXISTS idx_transactions_upi_ref ON transactions(upi_ref);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_canonical ON transactions(canonical_txn_id);
