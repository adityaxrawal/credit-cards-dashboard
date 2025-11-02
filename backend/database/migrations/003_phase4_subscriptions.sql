-- Create subscriptions table for Phase 4: Subscription Management
-- This table stores detected and manually added subscription information

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('active', 'inactive', 'cancelled', 'pending_confirmation')),
    category VARCHAR(100) NOT NULL DEFAULT 'Other',
    first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_transaction TIMESTAMP WITH TIME ZONE NOT NULL,
    next_expected TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    transaction_count INTEGER NOT NULL DEFAULT 1,
    average_amount DECIMAL(15,2) NOT NULL,
    amount_variance DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Coefficient of variation as percentage
    billing_cycle_day INTEGER CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 31),
    
    -- Metadata stored as JSONB for flexibility
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, merchant_name, status) -- Prevent duplicate active subscriptions for same merchant
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_expected ON subscriptions(next_expected);
CREATE INDEX IF NOT EXISTS idx_subscriptions_frequency ON subscriptions(frequency);
CREATE INDEX IF NOT EXISTS idx_subscriptions_confidence_score ON subscriptions(confidence_score);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_merchant_name ON subscriptions(merchant_name);

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_metadata ON subscriptions USING GIN (metadata);

-- Create subscription settings table for user preferences
CREATE TABLE IF NOT EXISTS subscription_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    auto_detect_enabled BOOLEAN NOT NULL DEFAULT true,
    detection_sensitivity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (detection_sensitivity IN ('low', 'medium', 'high')),
    minimum_amount DECIMAL(15,2) NOT NULL DEFAULT 50.00,
    minimum_frequency INTEGER NOT NULL DEFAULT 2, -- Minimum transactions to detect pattern
    
    -- Notification preferences stored as JSONB
    notification_preferences JSONB NOT NULL DEFAULT '{
        "new_subscription_alert": true,
        "amount_change_alert": true,
        "missed_payment_alert": true,
        "cancellation_alert": false
    }'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create subscription events table for tracking changes and notifications
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'detected', 'confirmed', 'cancelled', 'amount_changed', 
        'status_changed', 'renewed', 'missed_payment', 'manual_added'
    )),
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for subscription events
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at);

-- Create subscription categories lookup table for standardization
CREATE TABLE IF NOT EXISTS subscription_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- For UI display
    color VARCHAR(7), -- Hex color code
    typical_amount_min DECIMAL(15,2),
    typical_amount_max DECIMAL(15,2),
    common_frequencies TEXT[], -- Array of common billing frequencies
    merchant_patterns TEXT[], -- Array of regex patterns for merchant matching
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert default subscription categories
INSERT INTO subscription_categories (name, description, icon, color, typical_amount_min, typical_amount_max, common_frequencies, merchant_patterns) VALUES
('Entertainment', 'Video streaming, music, gaming subscriptions', 'play-circle', '#FF6B6B', 99.00, 1999.00, ARRAY['monthly', 'annually'], ARRAY['netflix', 'prime video', 'disney', 'hotstar', 'spotify', 'youtube']),
('Software', 'Software licenses, cloud storage, development tools', 'code', '#4ECDC4', 199.00, 9999.00, ARRAY['monthly', 'annually'], ARRAY['adobe', 'microsoft', 'google workspace', 'github', 'dropbox']),
('Utilities', 'Internet, mobile, electricity, gas, water', 'zap', '#45B7D1', 500.00, 5000.00, ARRAY['monthly'], ARRAY['airtel', 'jio', 'vodafone', 'electricity', 'gas', 'water']),
('Fitness', 'Gym memberships, fitness apps, sports subscriptions', 'activity', '#96CEB4', 500.00, 3000.00, ARRAY['monthly', 'quarterly', 'annually'], ARRAY['gym', 'fitness', 'cult.fit', 'yoga']),
('News & Media', 'News, magazines, media subscriptions', 'book-open', '#FFEAA7', 99.00, 999.00, ARRAY['monthly', 'annually'], ARRAY['times of india', 'hindu', 'mint', 'economic times']),
('Communication', 'Business communication, conferencing tools', 'message-circle', '#DDA0DD', 199.00, 1999.00, ARRAY['monthly'], ARRAY['zoom', 'teams', 'slack', 'whatsapp business']),
('Food & Delivery', 'Food delivery, grocery subscriptions', 'shopping-cart', '#F39C12', 99.00, 999.00, ARRAY['monthly'], ARRAY['swiggy', 'zomato', 'amazon fresh', 'bigbasket']),
('Transportation', 'Ride sharing, public transport passes', 'car', '#E74C3C', 199.00, 1999.00, ARRAY['monthly'], ARRAY['uber', 'ola', 'metro', 'bus pass']),
('Insurance & Finance', 'Insurance premiums, investment plans', 'shield', '#8E44AD', 1000.00, 50000.00, ARRAY['monthly', 'quarterly', 'annually'], ARRAY['insurance', 'lic', 'sip', 'mutual fund']),
('Other', 'Miscellaneous subscriptions', 'more-horizontal', '#95A5A6', 0.00, 999999.00, ARRAY['weekly', 'monthly', 'quarterly', 'annually'], ARRAY[])
ON CONFLICT (name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at fields
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_settings_updated_at 
    BEFORE UPDATE ON subscription_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for subscription analytics
CREATE OR REPLACE VIEW subscription_analytics AS
SELECT 
    s.user_id,
    s.category,
    s.frequency,
    s.status,
    COUNT(*) as subscription_count,
    SUM(s.amount) as total_amount,
    AVG(s.amount) as average_amount,
    MIN(s.amount) as min_amount,
    MAX(s.amount) as max_amount,
    AVG(s.confidence_score) as average_confidence,
    -- Calculate monthly equivalent amounts
    SUM(
        CASE s.frequency
            WHEN 'weekly' THEN s.amount * 4.33
            WHEN 'monthly' THEN s.amount
            WHEN 'quarterly' THEN s.amount / 3.0
            WHEN 'annually' THEN s.amount / 12.0
        END
    ) as monthly_equivalent_total
FROM subscriptions s
WHERE s.status = 'active'
GROUP BY s.user_id, s.category, s.frequency, s.status;

-- Add some helpful comments
COMMENT ON TABLE subscriptions IS 'Stores detected and manually added subscription information with pattern analysis metadata';
COMMENT ON TABLE subscription_settings IS 'User preferences for subscription detection and notifications';
COMMENT ON TABLE subscription_events IS 'Audit trail for subscription lifecycle events and notifications';
COMMENT ON TABLE subscription_categories IS 'Predefined categories with patterns for automatic subscription classification';
COMMENT ON VIEW subscription_analytics IS 'Aggregated view of subscription data for analytics and reporting';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_settings TO api_user;
-- GRANT SELECT, INSERT ON subscription_events TO api_user;
-- GRANT SELECT ON subscription_categories TO api_user;
-- GRANT SELECT ON subscription_analytics TO api_user;