-- Phase 2: Email Integration & Automation Schema

-- Add Gmail integration columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMP,
ADD COLUMN IF NOT EXISTS gmail_watch_expiration TIMESTAMP,
ADD COLUMN IF NOT EXISTS gmail_history_id VARCHAR(255);

-- Create email_processing_log table
CREATE TABLE IF NOT EXISTS email_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_message_id VARCHAR(255) NOT NULL UNIQUE,
  from_email VARCHAR(255) NOT NULL,
  subject TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processed, failed
  classification_result JSONB,
  extraction_result JSONB,
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for email_processing_log
CREATE INDEX IF NOT EXISTS idx_email_processing_log_user_id ON email_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_message_id ON email_processing_log(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_status ON email_processing_log(status);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_processed_at ON email_processing_log(processed_at);

-- Create scan_jobs table for historical scanning
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  total_emails INTEGER NOT NULL DEFAULT 0,
  processed_emails INTEGER NOT NULL DEFAULT 0,
  extracted_transactions INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error TEXT
);

-- Create indexes for scan_jobs
CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_job_id ON scan_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at DESC);

-- Add email_message_id to transactions table for deduplication
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_transactions_email_message_id ON transactions(email_message_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_email_processing_log_updated_at ON email_processing_log;
CREATE TRIGGER update_email_processing_log_updated_at
  BEFORE UPDATE ON email_processing_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scan_jobs_updated_at ON scan_jobs;
CREATE TRIGGER update_scan_jobs_updated_at
  BEFORE UPDATE ON scan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE email_processing_log IS 'Tracks all emails processed for transaction extraction';
COMMENT ON COLUMN email_processing_log.email_message_id IS 'Gmail message ID for deduplication';
COMMENT ON COLUMN email_processing_log.classification_result IS 'JSON result from email classifier';
COMMENT ON COLUMN email_processing_log.extraction_result IS 'JSON result from transaction extractor';

COMMENT ON TABLE scan_jobs IS 'Tracks historical email scanning jobs';
COMMENT ON COLUMN scan_jobs.job_id IS 'Unique identifier for the scan job';
COMMENT ON COLUMN scan_jobs.total_emails IS 'Estimated total emails to process';
COMMENT ON COLUMN scan_jobs.processed_emails IS 'Number of emails processed so far';
COMMENT ON COLUMN scan_jobs.extracted_transactions IS 'Number of transactions successfully extracted';

-- Add fingerprint column to transactions for deduplication
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_fingerprint 
ON transactions(fingerprint) WHERE fingerprint IS NOT NULL;

-- Email processing queue table for Pub/Sub messages
CREATE TABLE IF NOT EXISTS email_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_message_id VARCHAR(255) NOT NULL,
    gmail_history_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'retry')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    visibility_timeout TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    UNIQUE(user_id, email_message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_processing_queue(status, visibility_timeout);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_processing_queue(user_id, status);

-- Dead letter queue for failed messages
CREATE TABLE IF NOT EXISTS email_processing_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_item_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_message_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    attempts INTEGER,
    moved_to_dlq_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_dlq_user ON email_processing_dlq(user_id);

-- Manual review queue for low-confidence extractions
CREATE TABLE IF NOT EXISTS manual_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_message_id VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500),
    email_from VARCHAR(255),
    email_date TIMESTAMP,
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3, 2),
    extraction_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'edited')),
    reviewed_at TIMESTAMP,
    final_transaction_id UUID REFERENCES transactions(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_review_user_status ON manual_review_queue(user_id, status);

-- Metrics table for monitoring
CREATE TABLE IF NOT EXISTS email_processing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 2),
    dimensions JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp ON email_processing_metrics(metric_type, timestamp DESC);

-- Triggers for new tables
DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_processing_queue;
CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manual_review_updated_at ON manual_review_queue;
CREATE TRIGGER update_manual_review_updated_at
  BEFORE UPDATE ON manual_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
