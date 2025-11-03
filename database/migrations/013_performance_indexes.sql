-- Performance Optimization Indexes
-- Phase 5: Testing & Launch Preparation
-- Created: November 2025

-- Add indexes for performance optimization
-- Using CONCURRENTLY to avoid locking tables in production

-- Transactions table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_desc 
  ON transactions(user_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_card_date 
  ON transactions(card_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_merchant 
  ON transactions(merchant_name) 
  WHERE merchant_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount 
  ON transactions(amount DESC);

-- Credit cards table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_cards_user_active 
  ON credit_cards(user_id, is_active) 
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_cards_bill_due 
  ON credit_cards(user_id, bill_date, due_date) 
  WHERE is_active = true;

-- Alerts table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user_unread_date 
  ON alerts(user_id, created_at DESC) 
  WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_type_priority 
  ON alerts(alert_type, priority, created_at DESC);

-- Budget tracking optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_tracking_user_period 
  ON budget_tracking(user_id, year DESC, month DESC);

-- Email processing log optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_log_user_status_date 
  ON email_processing_log(user_id, processing_status, created_at DESC);

-- Analytics cache optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_cache_user_metric_period 
  ON analytics_cache(user_id, metric_key, period_start, period_end);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_cache_expires 
  ON analytics_cache(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Composite index for common dashboard query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_dashboard 
  ON transactions(user_id, transaction_date DESC, amount) 
  INCLUDE (merchant_name, card_id);

-- Analyze tables after index creation
ANALYZE transactions;
ANALYZE credit_cards;
ANALYZE alerts;
ANALYZE budget_tracking;
ANALYZE email_processing_log;
ANALYZE analytics_cache;

-- Verify index usage
-- Run this query after application runs for a while:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;
