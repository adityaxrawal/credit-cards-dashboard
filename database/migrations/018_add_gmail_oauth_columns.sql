-- Migration: Add Gmail OAuth token columns
-- Created: 2025-11-08
-- Purpose: Add columns to store Gmail API OAuth tokens for email sync functionality

-- Add Gmail OAuth token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMP;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_gmail_tokens ON users(id) WHERE gmail_refresh_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.gmail_refresh_token IS 'Encrypted Gmail OAuth refresh token for API access';
COMMENT ON COLUMN users.gmail_access_token IS 'Gmail OAuth access token (short-lived)';
COMMENT ON COLUMN users.gmail_token_expiry IS 'Expiration timestamp for Gmail access token';
