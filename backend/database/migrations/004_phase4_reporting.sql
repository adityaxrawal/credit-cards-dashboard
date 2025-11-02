-- Create tables for Phase 4: Advanced Reporting & Export system
-- This includes report generation, storage, and management

-- Create generated_reports table to track all generated reports
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'spending_summary', 'category_breakdown', 'card_utilization',
        'subscription_report', 'budget_performance', 'transaction_history',
        'monthly_trends', 'yearly_summary', 'cashflow_analysis', 'merchant_analysis'
    )),
    format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
    
    -- Report configuration stored as JSONB
    config JSONB NOT NULL,
    
    -- File information
    file_path TEXT,
    file_size BIGINT, -- Size in bytes
    
    -- Report lifecycle
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed', 'expired')),
    error_message TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for generated_reports
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON generated_reports(type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_at ON generated_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_expires_at ON generated_reports(expires_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_type ON generated_reports(user_id, type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_status ON generated_reports(user_id, status);

-- GIN index for config JSONB queries
CREATE INDEX IF NOT EXISTS idx_generated_reports_config ON generated_reports USING GIN (config);

-- Create report_templates table for predefined report configurations
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'monthly_spending', 'category_analysis'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL,
    
    -- Default configuration
    default_config JSONB NOT NULL DEFAULT '{}',
    
    -- Template metadata
    category VARCHAR(50), -- e.g., 'personal', 'business', 'analysis'
    tags TEXT[], -- Array of tags for categorization
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true, -- Available to all users
    usage_count INTEGER NOT NULL DEFAULT 0, -- Track popularity
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for report_templates
CREATE INDEX IF NOT EXISTS idx_report_templates_template_id ON report_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_active ON report_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_report_templates_usage_count ON report_templates(usage_count);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_report_templates_tags ON report_templates USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_report_templates_config ON report_templates USING GIN (default_config);

-- Create user_report_preferences table for personalized settings
CREATE TABLE IF NOT EXISTS user_report_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Default preferences
    default_format VARCHAR(10) DEFAULT 'pdf',
    default_date_range VARCHAR(50) DEFAULT 'last_30_days',
    auto_delete_after_days INTEGER DEFAULT 30,
    
    -- Notification preferences
    email_on_completion BOOLEAN DEFAULT true,
    email_on_error BOOLEAN DEFAULT true,
    
    -- Customization preferences stored as JSONB
    preferred_filters JSONB DEFAULT '{}',
    preferred_options JSONB DEFAULT '{}',
    
    -- Favorite templates
    favorite_templates TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create report_exports table for tracking export jobs
CREATE TABLE IF NOT EXISTS report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Export details
    export_type VARCHAR(20) NOT NULL CHECK (export_type IN ('download', 'email', 'cloud_storage')),
    destination TEXT, -- Email address, cloud path, etc.
    
    -- Export status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Tracking
    exported_at TIMESTAMP WITH TIME ZONE,
    file_size BIGINT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for report_exports
CREATE INDEX IF NOT EXISTS idx_report_exports_report_id ON report_exports(report_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_user_id ON report_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_status ON report_exports(status);
CREATE INDEX IF NOT EXISTS idx_report_exports_export_type ON report_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_report_exports_created_at ON report_exports(created_at);

-- Create report_sharing table for shared reports
CREATE TABLE IF NOT EXISTS report_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sharing configuration
    share_token VARCHAR(255) NOT NULL UNIQUE, -- For secure access
    is_public BOOLEAN DEFAULT false,
    password_protected BOOLEAN DEFAULT false,
    password_hash TEXT, -- If password protected
    
    -- Access control
    max_downloads INTEGER, -- Null for unlimited
    download_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Permissions
    can_download BOOLEAN DEFAULT true,
    can_view_online BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for report_sharing
CREATE INDEX IF NOT EXISTS idx_report_sharing_report_id ON report_sharing(report_id);
CREATE INDEX IF NOT EXISTS idx_report_sharing_shared_by_user_id ON report_sharing(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_report_sharing_share_token ON report_sharing(share_token);
CREATE INDEX IF NOT EXISTS idx_report_sharing_expires_at ON report_sharing(expires_at);

-- Insert default report templates
INSERT INTO report_templates (template_id, name, description, type, format, default_config, category, tags) VALUES
(
    'monthly_spending',
    'Monthly Spending Report',
    'Comprehensive spending analysis for the current month with trends and comparisons',
    'spending_summary',
    'pdf',
    '{
        "dateRange": "current_month",
        "options": {
            "includeTrends": true,
            "includeComparisons": true,
            "includeCharts": true,
            "currency": "INR"
        }
    }'::jsonb,
    'personal',
    ARRAY['monthly', 'spending', 'analysis', 'personal']
),
(
    'category_analysis',
    'Category Breakdown Analysis',
    'Detailed spending analysis organized by transaction categories',
    'category_breakdown',
    'pdf',
    '{
        "dateRange": "last_3_months",
        "options": {
            "includeCharts": true,
            "groupBy": "month",
            "currency": "INR"
        }
    }'::jsonb,
    'analysis',
    ARRAY['category', 'breakdown', 'analysis', 'detailed']
),
(
    'card_comparison',
    'Credit Card Usage Comparison',
    'Compare spending and utilization across all your credit cards',
    'card_utilization',
    'pdf',
    '{
        "dateRange": "current_month",
        "options": {
            "includeCharts": true,
            "includeUtilization": true,
            "currency": "INR"
        }
    }'::jsonb,
    'analysis',
    ARRAY['cards', 'comparison', 'utilization', 'credit']
),
(
    'subscription_audit',
    'Subscription Cost Audit',
    'Complete review of all recurring subscriptions and their costs',
    'subscription_report',
    'pdf',
    '{
        "dateRange": "current_month",
        "options": {
            "includeUpcoming": true,
            "includeRecommendations": true,
            "includeComparisons": true,
            "currency": "INR"
        }
    }'::jsonb,
    'analysis',
    ARRAY['subscriptions', 'recurring', 'audit', 'cost-analysis']
),
(
    'transaction_export',
    'Transaction History Export',
    'Complete transaction history in CSV format for external analysis',
    'transaction_history',
    'csv',
    '{
        "dateRange": "last_6_months",
        "options": {
            "includeAllFields": true,
            "currency": "INR"
        }
    }'::jsonb,
    'export',
    ARRAY['transactions', 'export', 'csv', 'history']
),
(
    'year_end_summary',
    'Annual Financial Summary',
    'Comprehensive year-end financial report with trends and insights',
    'yearly_summary',
    'pdf',
    '{
        "dateRange": "current_year",
        "options": {
            "includeTrends": true,
            "includeComparisons": true,
            "includeCharts": true,
            "includeProjections": true,
            "currency": "INR"
        }
    }'::jsonb,
    'summary',
    ARRAY['yearly', 'annual', 'summary', 'comprehensive']
),
(
    'merchant_spending',
    'Top Merchants Analysis',
    'Analysis of spending patterns by merchant and vendor',
    'merchant_analysis',
    'pdf',
    '{
        "dateRange": "last_3_months",
        "options": {
            "includeCharts": true,
            "topMerchantCount": 20,
            "includeTrends": true,
            "currency": "INR"
        }
    }'::jsonb,
    'analysis',
    ARRAY['merchants', 'vendors', 'spending', 'analysis']
)
ON CONFLICT (template_id) DO NOTHING;

-- Create functions for report management

-- Function to clean up expired reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired reports
    DELETE FROM generated_reports 
    WHERE expires_at < NOW() AND status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Update status for reports that should be marked as expired
    UPDATE generated_reports 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at < NOW() AND status != 'expired';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_identifier VARCHAR(100))
RETURNS VOID AS $$
BEGIN
    UPDATE report_templates 
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE template_id = template_identifier AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get user report statistics
CREATE OR REPLACE FUNCTION get_user_report_stats(user_uuid UUID)
RETURNS TABLE(
    total_reports INTEGER,
    completed_reports INTEGER,
    failed_reports INTEGER,
    total_downloads INTEGER,
    storage_used BIGINT,
    most_used_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_reports,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_reports,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as failed_reports,
        COALESCE(SUM(download_count), 0)::INTEGER as total_downloads,
        COALESCE(SUM(file_size), 0) as storage_used,
        (
            SELECT type 
            FROM generated_reports gr2 
            WHERE gr2.user_id = user_uuid AND gr2.status = 'completed'
            GROUP BY type 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_used_type
    FROM generated_reports gr
    WHERE gr.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at fields
CREATE TRIGGER update_generated_reports_updated_at 
    BEFORE UPDATE ON generated_reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at 
    BEFORE UPDATE ON report_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_report_preferences_updated_at 
    BEFORE UPDATE ON user_report_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_sharing_updated_at 
    BEFORE UPDATE ON report_sharing 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics

-- View for report generation analytics
CREATE OR REPLACE VIEW report_analytics AS
SELECT 
    DATE_TRUNC('day', generated_at) as generation_date,
    type,
    format,
    COUNT(*) as report_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    AVG(CASE WHEN status = 'completed' THEN file_size END) as avg_file_size,
    SUM(download_count) as total_downloads
FROM generated_reports
WHERE generated_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', generated_at), type, format
ORDER BY generation_date DESC;

-- View for user report summary
CREATE OR REPLACE VIEW user_report_summary AS
SELECT 
    gr.user_id,
    u.email,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN gr.status = 'completed' THEN 1 END) as completed_reports,
    SUM(gr.download_count) as total_downloads,
    SUM(CASE WHEN gr.status = 'completed' THEN gr.file_size ELSE 0 END) as storage_used,
    MAX(gr.generated_at) as last_report_generated
FROM generated_reports gr
JOIN users u ON gr.user_id = u.id
GROUP BY gr.user_id, u.email;

-- Add helpful comments
COMMENT ON TABLE generated_reports IS 'Stores information about all generated reports including metadata and file paths';
COMMENT ON TABLE report_templates IS 'Predefined report configurations that users can use as starting points';
COMMENT ON TABLE user_report_preferences IS 'User-specific preferences for report generation and customization';
COMMENT ON TABLE report_exports IS 'Tracks export operations for reports (downloads, emails, etc.)';
COMMENT ON TABLE report_sharing IS 'Manages shared report access with tokens and permissions';

COMMENT ON VIEW report_analytics IS 'Analytics view showing report generation trends and statistics';
COMMENT ON VIEW user_report_summary IS 'Summary view of report usage statistics per user';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON generated_reports TO api_user;
-- GRANT SELECT ON report_templates TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_report_preferences TO api_user;
-- GRANT SELECT, INSERT, UPDATE ON report_exports TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON report_sharing TO api_user;
-- GRANT SELECT ON report_analytics TO api_user;
-- GRANT SELECT ON user_report_summary TO api_user;