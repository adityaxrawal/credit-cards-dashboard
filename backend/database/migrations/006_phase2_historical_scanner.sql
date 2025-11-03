-- Phase 2: Historical Scanner Schema
-- Adds tables for historical email scanning jobs with progress tracking

-- Historical scan jobs table
CREATE TABLE IF NOT EXISTS historical_scan_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    label_filter VARCHAR(100),
    total_messages INTEGER DEFAULT 0,
    processed_messages INTEGER DEFAULT 0,
    extracted_transactions INTEGER DEFAULT 0,
    failed_messages INTEGER DEFAULT 0,
    duplicate_messages INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    checkpoint_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON historical_scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON historical_scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created ON historical_scan_jobs(created_at DESC);

-- RLS policies
ALTER TABLE historical_scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scan jobs"
    ON historical_scan_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scan jobs"
    ON historical_scan_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scan jobs"
    ON historical_scan_jobs FOR UPDATE
    USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_historical_scan_jobs_updated_at
    BEFORE UPDATE ON historical_scan_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE historical_scan_jobs IS 'Historical email scan jobs with progress tracking';
COMMENT ON COLUMN historical_scan_jobs.checkpoint_data IS 'Resume checkpoint data (last processed index, counts)';
COMMENT ON COLUMN historical_scan_jobs.progress_percentage IS 'Progress 0-100%';
