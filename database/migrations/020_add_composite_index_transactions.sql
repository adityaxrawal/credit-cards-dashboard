-- Migration 020: Add composite index on transactions table
-- Purpose: Improve query performance for user-specific card transactions with date filtering
-- Expected improvement: ~30% faster for common dashboard and analytics queries

-- Add composite index for optimal query performance
-- This index supports queries filtering by user_id, card_id, and ordering by transaction_date
CREATE INDEX IF NOT EXISTS idx_transactions_user_card_date_desc
  ON transactions (user_id, card_id, transaction_date DESC);

-- Reasoning:
-- 1. user_id: Primary filter for all user-specific queries
-- 2. card_id: Secondary filter for card-specific transactions
-- 3. transaction_date DESC: Supports sorting by most recent transactions first
--
-- This index is particularly beneficial for:
-- - Dashboard transaction lists (recent transactions per card)
-- - Analytics queries (spending patterns per card over time)
-- - Budget tracking (monthly spending per card)
-- - Reports generation (transaction history by card)

-- Verification query (run after migration):
-- EXPLAIN ANALYZE SELECT * FROM transactions 
-- WHERE user_id = 'some-uuid' AND card_id = 'card-uuid' 
-- ORDER BY transaction_date DESC LIMIT 10;

-- Expected result: Index scan on idx_transactions_user_card_date_desc

COMMENT ON INDEX idx_transactions_user_card_date_desc IS 
  'Composite index for optimizing user/card transaction queries with date ordering';
