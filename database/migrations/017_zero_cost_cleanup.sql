-- Migration: 017_zero_cost_cleanup.sql
-- Purpose: Clean up database schema for zero-cost architecture
-- Date: 2025-11-04
-- Description: Remove columns for Pub/Sub watch tracking, add manual sync tracking

-- Remove unused columns from users table (Pub/Sub watch related)
ALTER TABLE users DROP COLUMN IF EXISTS gmail_watch_expiration;
ALTER TABLE users DROP COLUMN IF EXISTS gmail_history_id;

-- Add last_gmail_sync for manual sync tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_gmail_sync TIMESTAMP;

-- Drop uploaded_statements table if exists (not part of zero-cost architecture)
DROP TABLE IF EXISTS uploaded_statements CASCADE;

-- Create index for last sync check (optimize auto-sync queries)
CREATE INDEX IF NOT EXISTS idx_users_last_gmail_sync ON users(last_gmail_sync);

-- Add comment to document zero-cost architecture
COMMENT ON COLUMN users.last_gmail_sync IS 'Timestamp of last manual Gmail sync (zero-cost architecture)';

-- Verify changes
DO $$
BEGIN
    RAISE NOTICE 'Migration 017_zero_cost_cleanup.sql completed successfully';
    RAISE NOTICE 'Removed: gmail_watch_expiration, gmail_history_id columns';
    RAISE NOTICE 'Added: last_gmail_sync column with index';
    RAISE NOTICE 'Dropped: uploaded_statements table';
END $$;
