-- Phase 1: Merchant Architecture Schema
-- Migration: 007_merchant_architecture.sql

-- 0. Define Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Merchants Table
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE
);

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS name VARCHAR(255);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchants_name_key') THEN
        ALTER TABLE merchants ADD CONSTRAINT merchants_name_key UNIQUE (name);
    END IF;
END $$;

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS default_category VARCHAR(100);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_subscription_capable BOOLEAN DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(default_category);

-- 2. Merchant Aliases Table
CREATE TABLE IF NOT EXISTS merchant_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL
);

-- CLEANUP LEGACY COLUMNS
ALTER TABLE merchant_aliases DROP COLUMN IF EXISTS alias_pattern; 
-- (Add other potential legacy columns here if discovered)

ALTER TABLE merchant_aliases ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE;
ALTER TABLE merchant_aliases ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE merchant_aliases ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'exact' CHECK (match_type IN ('exact', 'fuzzy', 'regex', 'prefix'));
ALTER TABLE merchant_aliases ADD COLUMN IF NOT EXISTS confidence_penalty DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE merchant_aliases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create Unique Constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_aliases_alias_match_type_key') THEN
        ALTER TABLE merchant_aliases ADD CONSTRAINT merchant_aliases_alias_match_type_key UNIQUE (alias, match_type);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_merchant_aliases_alias ON merchant_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_merchant_aliases_merchant_id ON merchant_aliases(merchant_id);

-- 3. Merchant Pattern Rules (Assuming no legacy here as it's a new concept)
CREATE TABLE IF NOT EXISTS merchant_pattern_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    pattern VARCHAR(500) NOT NULL,
    priority INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE merchant_pattern_rules ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE;
ALTER TABLE merchant_pattern_rules ADD COLUMN IF NOT EXISTS pattern VARCHAR(500);
ALTER TABLE merchant_pattern_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 10;

-- 4. Update Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_raw_extraction VARCHAR(500);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_confidence_score DECIMAL(3,2);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_confidence ON transactions(merchant_confidence_score);

-- 5. RLS & Triggers
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_pattern_rules ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Global read access for merchants' AND tablename = 'merchants') THEN
        CREATE POLICY "Global read access for merchants" ON merchants FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Global read access for aliases' AND tablename = 'merchant_aliases') THEN
        CREATE POLICY "Global read access for aliases" ON merchant_aliases FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Global read access for patterns' AND tablename = 'merchant_pattern_rules') THEN
        CREATE POLICY "Global read access for patterns" ON merchant_pattern_rules FOR SELECT USING (true);
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at 
BEFORE UPDATE ON merchants 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
