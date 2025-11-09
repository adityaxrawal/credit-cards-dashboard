# Database Migrations - Phase 3

This directory contains migrations for Phase 3 (Performance & Optimization) improvements.

## Migrations Overview

### 020_add_composite_index_transactions.sql

**Purpose:** Optimize transaction queries with composite index  
**Impact:** 30%+ query performance improvement for user/card/date filters  
**Rollback:** `DROP INDEX IF EXISTS idx_transactions_user_card_date_desc;`

### 021_add_constraints.sql

**Purpose:** Enforce data integrity constraints  
**Tables:** `transactions`, `credit_cards`  
**Constraints:**

- Positive amounts for transactions
- Positive credit limits
- Non-negative outstanding balances
- Valid date ranges (1-31)

**Rollback:** See comments in migration file

### 022_gmail_tokens_rls.sql

**Purpose:** Add Row Level Security to gmail_tokens  
**Impact:** Users can only access their own OAuth tokens  
**Rollback:** See comments in migration file

## Running Migrations

### Option 1: Supabase CLI (Recommended)

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Option 2: psql Command Line

```bash
# Set connection string
export DATABASE_URL="postgresql://user:pass@host:port/db"

# Run migrations in order
psql $DATABASE_URL -f database/migrations/020_add_composite_index_transactions.sql
psql $DATABASE_URL -f database/migrations/021_add_constraints.sql
psql $DATABASE_URL -f database/migrations/022_gmail_tokens_rls.sql
```

### Option 3: Node.js Migration Script

```bash
cd database
npm run migrate
```

## Verification

### Verify Composite Index

```sql
-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transactions'
AND indexname = 'idx_transactions_user_card_date_desc';

-- Verify index is used in query plan
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE user_id = 'some-uuid'
  AND card_id = 'card-uuid'
ORDER BY transaction_date DESC
LIMIT 10;

-- Should show: Index Scan using idx_transactions_user_card_date_desc
```

### Verify Constraints

```sql
-- List all constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('transactions', 'credit_cards')
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- Test constraints (should fail)
INSERT INTO transactions (amount) VALUES (-100);
INSERT INTO credit_cards (credit_limit) VALUES (-5000);
INSERT INTO credit_cards (current_outstanding) VALUES (-100);
```

### Verify RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'gmail_tokens';
-- Expected: rowsecurity = true

-- List RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'gmail_tokens'
ORDER BY policyname;

-- Expected policies:
-- - gmail_tokens_select_own
-- - gmail_tokens_insert_own
-- - gmail_tokens_update_own
-- - gmail_tokens_delete_own

-- Test RLS (as authenticated user)
SELECT * FROM gmail_tokens;
-- Should only return tokens for auth.uid()
```

## Rollback Instructions

If you need to rollback any migration:

### Rollback 020 (Composite Index)

```sql
DROP INDEX IF EXISTS idx_transactions_user_card_date_desc;
```

### Rollback 021 (Constraints)

```sql
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_amount_positive;

ALTER TABLE credit_cards
  DROP CONSTRAINT IF EXISTS chk_credit_cards_limit_positive;

ALTER TABLE credit_cards
  DROP CONSTRAINT IF EXISTS chk_credit_cards_outstanding_non_negative;
```

### Rollback 022 (RLS)

```sql
DROP POLICY IF EXISTS "gmail_tokens_select_own" ON gmail_tokens;
DROP POLICY IF EXISTS "gmail_tokens_insert_own" ON gmail_tokens;
DROP POLICY IF EXISTS "gmail_tokens_update_own" ON gmail_tokens;
DROP POLICY IF EXISTS "gmail_tokens_delete_own" ON gmail_tokens;
ALTER TABLE gmail_tokens DISABLE ROW LEVEL SECURITY;
```

## Performance Testing

After applying migrations, run benchmarks:

```bash
# Transaction query benchmark
npm run benchmark:transactions

# Cache performance benchmark
npm run benchmark:cache
```

Expected results:

- Transaction queries: ≥30% faster
- Cache hit rate: ≥90% for dashboard patterns

## Troubleshooting

### Index not being used

```sql
-- Force analyze to update statistics
ANALYZE transactions;

-- Check query planner settings
SHOW enable_indexscan;
SHOW enable_seqscan;
```

### Constraint violations on existing data

```sql
-- Find rows that would violate new constraints
SELECT * FROM transactions WHERE amount <= 0;
SELECT * FROM credit_cards WHERE credit_limit <= 0;
SELECT * FROM credit_cards WHERE current_outstanding < 0;

-- Clean up data before migration if needed
UPDATE transactions SET amount = ABS(amount) WHERE amount <= 0;
DELETE FROM transactions WHERE amount = 0;
```

### RLS preventing legitimate access

```sql
-- Check current auth context
SELECT auth.uid();

-- Temporarily disable RLS for debugging (not recommended in production)
ALTER TABLE gmail_tokens DISABLE ROW LEVEL SECURITY;
-- ... debug ...
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
```

## Monitoring

After deployment, monitor:

1. **Query Performance:**

   - Use `pg_stat_statements` to track slow queries
   - Monitor transaction query times in logs

2. **Constraint Violations:**

   - Check application logs for constraint errors
   - Adjust application validation if needed

3. **RLS Impact:**
   - Ensure no legitimate queries are blocked
   - Monitor for unexpected access denied errors

## Support

For issues or questions:

1. Check migration comments for detailed explanations
2. Review verification queries above
3. Check application logs for detailed error messages
4. Consult database/QUICK_REFERENCE.md for connection details

---

**Migration Status Tracking:**

| Migration | Status     | Applied Date | Notes                           |
| --------- | ---------- | ------------ | ------------------------------- |
| 020       | ⬜ Pending | -            | Composite index on transactions |
| 021       | ⬜ Pending | -            | Data integrity constraints      |
| 022       | ⬜ Pending | -            | RLS for gmail_tokens            |

Update this table after applying each migration.
