-- Phase 6: Analytics and Session Tracking Tables
-- Migration: 014_analytics_tracking.sql

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP NOT NULL DEFAULT NOW(),
    session_end TIMESTAMP,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_start ON user_sessions(session_start DESC);
CREATE INDEX idx_user_sessions_user_start ON user_sessions(user_id, session_start DESC);

-- Page Views Table
CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    page VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_page_views_user_id ON page_views(user_id);
CREATE INDEX idx_page_views_timestamp ON page_views(timestamp DESC);
CREATE INDEX idx_page_views_page ON page_views(page);

-- User Events Table
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_timestamp ON user_events(timestamp DESC);
CREATE INDEX idx_user_events_name ON user_events(event_name);
CREATE INDEX idx_user_events_user_name ON user_events(user_id, event_name);

-- System Metrics Table (for storing aggregated metrics)
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    tags JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX idx_system_metrics_type_timestamp ON system_metrics(metric_type, timestamp DESC);

-- Performance Logs Table
CREATE TABLE IF NOT EXISTS performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_logs_service ON performance_logs(service_name);
CREATE INDEX idx_performance_logs_operation ON performance_logs(operation);
CREATE INDEX idx_performance_logs_timestamp ON performance_logs(timestamp DESC);
CREATE INDEX idx_performance_logs_success ON performance_logs(success) WHERE success = false;

-- API Request Logs Table (for detailed API analytics)
CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    request_size INTEGER,
    response_size INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_user_id ON api_request_logs(user_id);
CREATE INDEX idx_api_logs_endpoint ON api_request_logs(endpoint);
CREATE INDEX idx_api_logs_timestamp ON api_request_logs(timestamp DESC);
CREATE INDEX idx_api_logs_status ON api_request_logs(status_code);
CREATE INDEX idx_api_logs_endpoint_timestamp ON api_request_logs(endpoint, timestamp DESC);

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    severity VARCHAR(20) DEFAULT 'error',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = false;

-- Comments
COMMENT ON TABLE user_sessions IS 'Tracks user login sessions with duration';
COMMENT ON TABLE page_views IS 'Records page views for analytics';
COMMENT ON TABLE user_events IS 'Tracks user actions and events';
COMMENT ON TABLE system_metrics IS 'Stores aggregated system-wide metrics';
COMMENT ON TABLE performance_logs IS 'Logs performance metrics for services';
COMMENT ON TABLE api_request_logs IS 'Detailed API request logs for analytics';
COMMENT ON TABLE error_logs IS 'Centralized error logging table';

-- Cleanup old data function (to be called periodically)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Delete logs older than 90 days
    DELETE FROM page_views WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM user_events WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM api_request_logs WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM performance_logs WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Delete resolved errors older than 30 days
    DELETE FROM error_logs WHERE resolved = true AND resolved_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
