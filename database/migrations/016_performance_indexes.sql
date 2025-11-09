-- Phase 6: Performance Optimization Indexes
-- Migration: 016_performance_indexes.sql

-- ==========================================
-- TRANSACTIONS TABLE OPTIMIZATIONS
-- ==========================================

-- Index for transaction queries by date range (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_amount 
ON transactions(user_id, transaction_date DESC, amount) 
WHERE user_id IS NOT NULL;

-- Index for monthly aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_monthly_agg 
ON transactions(user_id, billing_cycle_year, billing_cycle_month, amount) 
WHERE user_id IS NOT NULL;

-- Index for merchant analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_merchant 
ON transactions(merchant_name, transaction_date DESC) 
WHERE merchant_name IS NOT NULL;

-- Index for category spending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_category 
ON transactions(merchant_category, transaction_date DESC) 
WHERE merchant_category IS NOT NULL;

-- Partial index for refunds
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_refunds 
ON transactions(user_id, transaction_date DESC, amount) 
WHERE transaction_type = 'refund';

-- ==========================================
-- CREDIT CARDS TABLE OPTIMIZATIONS
-- ==========================================

-- Index for active cards queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_cards_active_user 
ON credit_cards(user_id, is_active, bill_date) 
WHERE is_active = true;

-- Index for upcoming bills
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_cards_bill_due 
ON credit_cards(user_id, bill_date, due_date) 
WHERE is_active = true;

-- ==========================================
-- ALERTS TABLE OPTIMIZATIONS
-- ==========================================

-- Index for unread alerts (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_unread_user 
ON alerts(user_id, created_at DESC) 
WHERE is_read = false;

-- Index for alert type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_type_user 
ON alerts(alert_type, user_id, created_at DESC);

-- Partial index for high priority alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_high_priority 
ON alerts(user_id, created_at DESC) 
WHERE priority = 'high' AND is_read = false;

-- ==========================================
-- BUDGET TRACKING OPTIMIZATIONS
-- ==========================================

-- Index for current month budget queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_current_month 
ON budget_tracking(user_id, year DESC, month DESC);

-- Index for budget alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_alert_pending 
ON budget_tracking(user_id, year, month) 
WHERE alert_sent = false AND total_spent > budget_limit * 0.8;

-- ==========================================
-- EMAIL PROCESSING LOG OPTIMIZATIONS
-- ==========================================

-- Index for pending emails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_processing_pending 
ON email_processing_log(user_id, processing_status, received_date DESC) 
WHERE processing_status IN ('pending', 'processing');

-- Index for failed emails requiring retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_processing_failed 
ON email_processing_log(user_id, processing_status, received_date DESC) 
WHERE processing_status = 'failed';

-- ==========================================
-- ANALYTICS OPTIMIZATIONS
-- ==========================================

-- Index for analytics cache lookups
-- Note: Removed WHERE expires_at > NOW() as NOW() is not IMMUTABLE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_cache_lookup 
ON analytics_cache(user_id, metric_key, period_start DESC, period_end DESC, expires_at);

-- Index for expired cache cleanup
-- Note: Removed WHERE clause with NOW() as NOW() is not IMMUTABLE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_cache_expired 
ON analytics_cache(expires_at) 
WHERE expires_at IS NOT NULL;

-- ==========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ==========================================

-- Materialized view for monthly spending summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_spending AS
SELECT 
    user_id,
    billing_cycle_year,
    billing_cycle_month,
    card_id,
    COUNT(*) as transaction_count,
    SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as total_spent,
    SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN transaction_type = 'refund' THEN amount ELSE 0 END) as total_refunds,
    AVG(CASE WHEN transaction_type = 'debit' THEN amount ELSE NULL END) as avg_transaction,
    MAX(transaction_date) as last_transaction_date
FROM transactions
WHERE billing_cycle_year IS NOT NULL 
    AND billing_cycle_month IS NOT NULL
GROUP BY user_id, billing_cycle_year, billing_cycle_month, card_id;

CREATE UNIQUE INDEX ON mv_monthly_spending(user_id, billing_cycle_year, billing_cycle_month, card_id);
CREATE INDEX ON mv_monthly_spending(user_id, billing_cycle_year DESC, billing_cycle_month DESC);

-- Materialized view for merchant spending patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_merchant_spending AS
SELECT 
    user_id,
    merchant_name,
    merchant_category,
    COUNT(*) as transaction_count,
    SUM(amount) as total_spent,
    AVG(amount) as avg_amount,
    MIN(transaction_date) as first_transaction,
    MAX(transaction_date) as last_transaction
FROM transactions
WHERE merchant_name IS NOT NULL 
    AND transaction_type = 'debit'
GROUP BY user_id, merchant_name, merchant_category;

CREATE UNIQUE INDEX ON mv_merchant_spending(user_id, merchant_name);
CREATE INDEX ON mv_merchant_spending(user_id, total_spent DESC);
CREATE INDEX ON mv_merchant_spending(user_id, merchant_category, total_spent DESC);

-- ==========================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ==========================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_spending;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_merchant_spending;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE transactions;
    ANALYZE credit_cards;
    ANALYZE alerts;
    ANALYZE budget_tracking;
    ANALYZE email_processing_log;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MAINTENANCE TASKS
-- ==========================================

-- Function to cleanup old records
CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS void AS $$
BEGIN
    -- Delete very old email processing logs (keep 1 year)
    DELETE FROM email_processing_log 
    WHERE received_date < NOW() - INTERVAL '1 year' 
        AND processing_status IN ('processed', 'skipped');
    
    -- Delete expired analytics cache
    DELETE FROM analytics_cache 
    WHERE expires_at IS NOT NULL 
        AND expires_at < NOW() - INTERVAL '7 days';
    
    -- Delete old read alerts (keep 6 months)
    DELETE FROM alerts 
    WHERE is_read = true 
        AND read_at < NOW() - INTERVAL '6 months';
    
    -- Delete old page views (keep 3 months)
    DELETE FROM page_views 
    WHERE timestamp < NOW() - INTERVAL '3 months';
    
    -- Delete old API logs (keep 90 days)
    DELETE FROM api_request_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Vacuum tables after cleanup
    VACUUM ANALYZE transactions;
    VACUUM ANALYZE email_processing_log;
    VACUUM ANALYZE alerts;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- QUERY STATISTICS
-- ==========================================

-- Enable query statistics collection if not already enabled
-- This helps identify slow queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset statistics (run manually when needed)
-- SELECT pg_stat_statements_reset();

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON INDEX idx_transactions_user_date_amount IS 'Optimizes common date range queries with amount filtering';
COMMENT ON INDEX idx_transactions_monthly_agg IS 'Speeds up monthly spending aggregations';
COMMENT ON INDEX idx_alerts_unread_user IS 'Optimizes unread alerts queries - most frequent operation';
COMMENT ON MATERIALIZED VIEW mv_monthly_spending IS 'Pre-aggregated monthly spending data for fast dashboard queries';
COMMENT ON MATERIALIZED VIEW mv_merchant_spending IS 'Pre-aggregated merchant data for spending analysis';
COMMENT ON FUNCTION refresh_analytics_views IS 'Refreshes all materialized views - run periodically';
COMMENT ON FUNCTION cleanup_old_records IS 'Removes old data to maintain performance - run weekly';

-- ==========================================
-- PERFORMANCE NOTES
-- ==========================================

-- Schedule these maintenance tasks:
-- 1. refresh_analytics_views() - Every hour during business hours
-- 2. update_table_statistics() - Daily at 2 AM
-- 3. cleanup_old_records() - Weekly on Sunday at 3 AM

-- Monitor query performance:
-- SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;

-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- ORDER BY idx_scan ASC;
