-- Migration: 006_pdf_passwords.sql
-- Description: Add user PDF passwords table for encrypted PDF handling

-- Create table for storing user PDF passwords
CREATE TABLE IF NOT EXISTS user_pdf_passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_name VARCHAR(100) NOT NULL,        -- User-friendly name (e.g., "HDFC Card Statement")
    password_value TEXT NOT NULL,               -- AES-256-GCM encrypted password
    bank_hint VARCHAR(50),                      -- Optional bank association for sorting
    priority INTEGER DEFAULT 0,                 -- Higher priority = try first
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, password_name)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_pdf_passwords_user_id ON user_pdf_passwords(user_id);

-- Index for priority-based ordering
CREATE INDEX IF NOT EXISTS idx_pdf_passwords_priority ON user_pdf_passwords(user_id, priority DESC);

-- Comment on table
COMMENT ON TABLE user_pdf_passwords IS 'Stores encrypted PDF passwords for automatic decryption of bank statements';
COMMENT ON COLUMN user_pdf_passwords.password_value IS 'AES-256-GCM encrypted password value';
COMMENT ON COLUMN user_pdf_passwords.bank_hint IS 'Optional bank name for better organization';
COMMENT ON COLUMN user_pdf_passwords.priority IS 'Higher values are tried first when decrypting PDFs';
