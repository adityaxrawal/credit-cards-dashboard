-- Migration: Add timezone column to users table
-- This allows storing user's preferred timezone for display purposes
-- All dates remain stored in UTC in the database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';

-- Add comment for documentation
COMMENT ON COLUMN users.timezone IS 'User timezone for display purposes (IANA timezone format, e.g., Asia/Kolkata, America/New_York)';
