-- Migration 021: Add data integrity constraints
-- Purpose: Enforce business rules at database level for data consistency

-- ============================================================================
-- TRANSACTIONS TABLE CONSTRAINTS
-- ============================================================================

-- Ensure transaction amounts are positive (debit transactions should have positive amounts)
-- Note: We allow NULL for special cases but enforce positive values when amount is present
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_amount_positive 
  CHECK (amount IS NULL OR amount > 0);

COMMENT ON CONSTRAINT chk_transactions_amount_positive ON transactions IS
  'Ensures transaction amounts are positive when specified';

-- ============================================================================
-- CREDIT_CARDS TABLE CONSTRAINTS
-- ============================================================================

-- Ensure bill_date and due_date are valid day-of-month values (1-31)
-- Note: These constraints already exist in the initial schema but we verify them here

-- Verify bill_date constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'credit_cards_bill_date_check'
  ) THEN
    ALTER TABLE credit_cards 
      ADD CONSTRAINT credit_cards_bill_date_check 
      CHECK (bill_date >= 1 AND bill_date <= 31);
  END IF;
END $$;

-- Verify due_date constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'credit_cards_due_date_check'
  ) THEN
    ALTER TABLE credit_cards 
      ADD CONSTRAINT credit_cards_due_date_check 
      CHECK (due_date >= 1 AND due_date <= 31);
  END IF;
END $$;

COMMENT ON CONSTRAINT credit_cards_bill_date_check ON credit_cards IS
  'Ensures bill_date is a valid day of month (1-31)';

COMMENT ON CONSTRAINT credit_cards_due_date_check ON credit_cards IS
  'Ensures due_date is a valid day of month (1-31)';

-- ============================================================================
-- APPLICATION-LEVEL VALIDATION NOTES
-- ============================================================================

-- Note on due_date > bill_date validation:
-- While it's tempting to add CHECK (due_date > bill_date), this is problematic because:
-- 1. Billing cycles can span month boundaries (e.g., bill_date=28, due_date=5 of next month)
-- 2. This constraint would incorrectly reject valid configurations
-- 3. Application logic must handle month rollover validation
--
-- Recommended application-level validation:
-- - For same month: due_date should be > bill_date
-- - For month rollover: due_date (1-10) can be less than bill_date (20-31)
-- - Enforce reasonable grace period (e.g., 10-25 days between dates)

-- ============================================================================
-- CREDIT LIMIT CONSTRAINTS
-- ============================================================================

-- Ensure credit limit is positive when specified
ALTER TABLE credit_cards
  ADD CONSTRAINT chk_credit_cards_limit_positive 
  CHECK (credit_limit IS NULL OR credit_limit > 0);

-- Ensure current outstanding is non-negative
ALTER TABLE credit_cards
  ADD CONSTRAINT chk_credit_cards_outstanding_non_negative 
  CHECK (current_outstanding >= 0);

COMMENT ON CONSTRAINT chk_credit_cards_limit_positive ON credit_cards IS
  'Ensures credit limit is positive when specified';

COMMENT ON CONSTRAINT chk_credit_cards_outstanding_non_negative ON credit_cards IS
  'Ensures current outstanding balance is non-negative';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration, run:
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_amount_positive;
-- ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS chk_credit_cards_limit_positive;
-- ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS chk_credit_cards_outstanding_non_negative;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify constraints were added:
-- SELECT 
--   tc.constraint_name,
--   tc.table_name,
--   cc.check_clause
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.check_constraints cc 
--   ON tc.constraint_name = cc.constraint_name
-- WHERE tc.table_name IN ('transactions', 'credit_cards')
-- ORDER BY tc.table_name, tc.constraint_name;

-- Test constraint violations (should fail):
-- INSERT INTO transactions (amount) VALUES (-100); -- Should fail
-- INSERT INTO credit_cards (credit_limit) VALUES (-5000); -- Should fail
-- INSERT INTO credit_cards (current_outstanding) VALUES (-100); -- Should fail
