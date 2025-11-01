-- Add remaining Gmail columns to users table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ythuxanwxzdwtuwotcha/sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMP,
ADD COLUMN IF NOT EXISTS gmail_watch_expiration TIMESTAMP,
ADD COLUMN IF NOT EXISTS gmail_history_id VARCHAR(255);

-- Verify the columns were added
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name LIKE 'gmail%';
