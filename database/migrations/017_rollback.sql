-- ================================
-- Rollback Migration: 017_zero_cost_cleanup.sql
-- ================================
-- Use this to rollback if migration causes issues

BEGIN;

-- Re-add removed columns (if needed for rollback)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_watch_expiration TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_history_id VARCHAR(255);

-- Remove last_gmail_sync column
ALTER TABLE users DROP COLUMN IF EXISTS last_gmail_sync;

-- Drop the index
DROP INDEX IF EXISTS idx_users_last_gmail_sync;

-- Recreate uploaded_statements table (if you had data to restore)
-- Note: This is a basic structure - adjust if your table had different schema
CREATE TABLE IF NOT EXISTS uploaded_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(50)
);

COMMIT;

-- Verify rollback
DO $$
BEGIN
    RAISE NOTICE 'Rollback of migration 017_zero_cost_cleanup.sql completed';
    RAISE NOTICE 'Re-added: gmail_watch_expiration, gmail_history_id columns';
    RAISE NOTICE 'Removed: last_gmail_sync column and index';
    RAISE NOTICE 'Recreated: uploaded_statements table';
    RAISE NOTICE 'NOTE: This rollback does not restore data, only schema';
END $$;
