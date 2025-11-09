-- Migration 022: Add Row Level Security (RLS) policies for gmail_tokens table
-- Purpose: Ensure users can only access their own Gmail OAuth tokens
-- Security: Critical for protecting sensitive OAuth credentials

-- ============================================================================
-- ENABLE RLS ON GMAIL_TOKENS TABLE
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE gmail_tokens IS
  'Stores encrypted Gmail OAuth tokens with RLS enabled for user data isolation';

-- ============================================================================
-- RLS POLICIES FOR GMAIL_TOKENS
-- ============================================================================

-- Policy: Users can read only their own Gmail tokens
CREATE POLICY "gmail_tokens_select_own" ON gmail_tokens
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

COMMENT ON POLICY "gmail_tokens_select_own" ON gmail_tokens IS
  'Allow users to read only their own Gmail OAuth tokens';

-- Policy: Users can insert only their own Gmail tokens
CREATE POLICY "gmail_tokens_insert_own" ON gmail_tokens
  FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id::text);

COMMENT ON POLICY "gmail_tokens_insert_own" ON gmail_tokens IS
  'Allow users to create Gmail tokens only for themselves';

-- Policy: Users can update only their own Gmail tokens
CREATE POLICY "gmail_tokens_update_own" ON gmail_tokens
  FOR UPDATE 
  USING (auth.uid()::text = user_id::text);

COMMENT ON POLICY "gmail_tokens_update_own" ON gmail_tokens IS
  'Allow users to update only their own Gmail OAuth tokens';

-- Policy: Users can delete only their own Gmail tokens
CREATE POLICY "gmail_tokens_delete_own" ON gmail_tokens
  FOR DELETE 
  USING (auth.uid()::text = user_id::text);

COMMENT ON POLICY "gmail_tokens_delete_own" ON gmail_tokens IS
  'Allow users to revoke/delete only their own Gmail OAuth tokens';

-- ============================================================================
-- SECURITY CONSIDERATIONS
-- ============================================================================

-- This RLS implementation ensures:
-- 1. Users can only access their own Gmail tokens
-- 2. Tokens are isolated at the database level (defense in depth)
-- 3. Even if application logic has bugs, RLS prevents cross-user access
-- 4. Aligns with zero-trust security model
--
-- Note: refresh_token column should be encrypted at application level
-- using crypto functions before storage (already implemented in app layer)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename = 'gmail_tokens';
-- Expected: rowsecurity = true

-- List all policies on gmail_tokens:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'gmail_tokens'
-- ORDER BY policyname;

-- Test policy enforcement (should only return current user's tokens):
-- SELECT * FROM gmail_tokens; -- As authenticated user

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration:
-- DROP POLICY IF EXISTS "gmail_tokens_select_own" ON gmail_tokens;
-- DROP POLICY IF EXISTS "gmail_tokens_insert_own" ON gmail_tokens;
-- DROP POLICY IF EXISTS "gmail_tokens_update_own" ON gmail_tokens;
-- DROP POLICY IF EXISTS "gmail_tokens_delete_own" ON gmail_tokens;
-- ALTER TABLE gmail_tokens DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TESTING RECOMMENDATIONS
-- ============================================================================

-- 1. Test as User A:
--    - Insert token for User A (should succeed)
--    - Try to insert token for User B (should fail with RLS violation)
--    - Try to read User B's tokens (should return empty set)
--
-- 2. Test token refresh flow:
--    - Ensure UPDATE operations work correctly for own tokens
--    - Verify updated_at timestamp is refreshed
--
-- 3. Test token revocation:
--    - Ensure DELETE operations work for own tokens
--    - Verify CASCADE behavior with user deletion
