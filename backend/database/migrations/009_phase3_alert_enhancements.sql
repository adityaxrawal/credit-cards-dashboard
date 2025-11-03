-- Phase 3: Alert System Enhancements
-- Adds notification channels, preferences, and advanced alert features

-- Add additional columns to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_via_sms BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sent_via_push BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_label VARCHAR(100);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;

-- User notification preferences table
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN DEFAULT true,
    channels JSONB DEFAULT '["in_app", "email"]'::jsonb,
    frequency VARCHAR(20) DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily_digest', 'weekly_digest')),
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    alert_types JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_notification_prefs ON user_notification_preferences(user_id);

-- Alert templates for consistent messaging
CREATE TABLE alert_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    action_label VARCHAR(100),
    action_url_template TEXT,
    default_channels VARCHAR(20)[] DEFAULT ARRAY['in_app', 'email'],
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(alert_type, priority)
);

CREATE INDEX idx_alert_templates_type ON alert_templates(alert_type);

-- Alert delivery log for tracking notification delivery
CREATE TABLE alert_delivery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_delivery_alert ON alert_delivery_log(alert_id);
CREATE INDEX idx_alert_delivery_user ON alert_delivery_log(user_id, created_at DESC);
CREATE INDEX idx_alert_delivery_status ON alert_delivery_log(delivery_status, created_at DESC);

-- Alert aggregation for digest generation
CREATE TABLE alert_digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    digest_type VARCHAR(20) NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    alert_count INTEGER DEFAULT 0,
    alert_ids UUID[] DEFAULT ARRAY[]::UUID[],
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, digest_type, period_start)
);

CREATE INDEX idx_alert_digests_user ON alert_digests(user_id, period_start DESC);
CREATE INDEX idx_alert_digests_status ON alert_digests(delivery_status, created_at DESC);

-- Alert actions/interactions tracking
CREATE TABLE alert_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('viewed', 'clicked', 'dismissed', 'action_taken')),
    interaction_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_interactions_alert ON alert_interactions(alert_id);
CREATE INDEX idx_alert_interactions_user ON alert_interactions(user_id, created_at DESC);

-- Alert rules for custom user-defined alerts
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('spending_threshold', 'transaction_pattern', 'merchant_alert', 'category_limit', 'card_usage')),
    condition JSONB NOT NULL,
    alert_priority VARCHAR(20) DEFAULT 'medium',
    alert_channels VARCHAR(20)[] DEFAULT ARRAY['in_app', 'email'],
    is_active BOOLEAN DEFAULT true,
    triggered_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_user ON alert_rules(user_id, is_active);
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type);

-- Insert default alert templates
INSERT INTO alert_templates (alert_type, priority, title_template, message_template, action_label, action_url_template, default_channels) VALUES
('budget_threshold', 'medium', 'Budget Alert: {threshold}% Reached', 'You have spent {percentage}% of your monthly budget (₹{spent} of ₹{budget})', 'View Budget', '/budget', ARRAY['in_app', 'email']),
('budget_exceeded', 'high', 'Budget Exceeded', 'You have exceeded your monthly budget by ₹{overage}. Total spent: ₹{spent}', 'View Transactions', '/transactions', ARRAY['in_app', 'email', 'push']),
('bill_reminder', 'high', 'Bill Due: {card_name}', 'Your {card_name} bill of ₹{amount} is due on {due_date}', 'Pay Now', '/bills/{bill_id}', ARRAY['in_app', 'email', 'push']),
('due_reminder', 'high', 'Payment Due Tomorrow', '{card_name} payment of ₹{amount} is due tomorrow', 'Pay Now', '/bills/{bill_id}', ARRAY['in_app', 'email', 'sms']),
('unusual_activity', 'high', 'Unusual Spending Detected', 'We detected unusual spending activity: {details}', 'Review', '/transactions', ARRAY['in_app', 'email', 'push']),
('system', 'low', '{title}', '{message}', NULL, NULL, ARRAY['in_app']),
('insight', 'low', 'Spending Insight', '{message}', 'Learn More', '/analytics', ARRAY['in_app']);

-- Function to check user notification preferences before sending
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_alert_type VARCHAR,
    p_channel VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_prefs RECORD;
    v_current_time TIME;
    v_alert_config JSONB;
BEGIN
    -- Get user preferences
    SELECT * INTO v_prefs
    FROM user_notification_preferences
    WHERE user_id = p_user_id;
    
    -- If no preferences found, use defaults (enabled, in_app + email)
    IF NOT FOUND THEN
        RETURN p_channel IN ('in_app', 'email');
    END IF;
    
    -- Check if notifications are enabled
    IF NOT v_prefs.enabled THEN
        RETURN FALSE;
    END IF;
    
    -- Check if channel is enabled globally
    IF NOT (v_prefs.channels::jsonb ? p_channel) THEN
        RETURN FALSE;
    END IF;
    
    -- Check alert type specific preferences
    v_alert_config := v_prefs.alert_types->p_alert_type;
    IF v_alert_config IS NOT NULL THEN
        IF (v_alert_config->>'enabled')::boolean = FALSE THEN
            RETURN FALSE;
        END IF;
        
        -- Check if channel is enabled for this alert type
        IF v_alert_config->'channels' IS NOT NULL THEN
            IF NOT (v_alert_config->'channels'::jsonb ? p_channel) THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- Check quiet hours (only for non-critical alerts)
    IF v_prefs.quiet_hours_enabled AND p_alert_type NOT IN ('bill_reminder', 'due_reminder', 'unusual_activity') THEN
        v_current_time := CURRENT_TIME;
        IF v_prefs.quiet_hours_start > v_prefs.quiet_hours_end THEN
            -- Quiet hours span midnight
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time <= v_prefs.quiet_hours_end THEN
                RETURN FALSE;
            END IF;
        ELSE
            -- Normal quiet hours
            IF v_current_time >= v_prefs.quiet_hours_start AND v_current_time <= v_prefs.quiet_hours_end THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log alert creation
CREATE OR REPLACE FUNCTION log_alert_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log to delivery queue for configured channels
    INSERT INTO alert_delivery_log (alert_id, user_id, channel, delivery_status)
    SELECT 
        NEW.id,
        NEW.user_id,
        channel::text,
        'pending'
    FROM (
        SELECT unnest(COALESCE(
            (SELECT default_channels FROM alert_templates WHERE alert_type = NEW.alert_type LIMIT 1),
            ARRAY['in_app', 'email']
        )) AS channel
    ) channels
    WHERE should_send_notification(NEW.user_id, NEW.alert_type, channel::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_alert_creation
AFTER INSERT ON alerts
FOR EACH ROW
EXECUTE FUNCTION log_alert_creation();

-- Function to check and trigger custom alert rules
CREATE OR REPLACE FUNCTION check_alert_rules_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_rule RECORD;
    v_condition JSONB;
    v_should_trigger BOOLEAN;
BEGIN
    -- Check each active rule for the user
    FOR v_rule IN 
        SELECT * FROM alert_rules 
        WHERE user_id = NEW.user_id 
        AND is_active = true
    LOOP
        v_condition := v_rule.condition;
        v_should_trigger := FALSE;
        
        -- Check rule based on type
        CASE v_rule.rule_type
            WHEN 'spending_threshold' THEN
                -- Check if transaction amount exceeds threshold
                IF NEW.amount >= (v_condition->>'amount')::numeric THEN
                    v_should_trigger := TRUE;
                END IF;
            
            WHEN 'merchant_alert' THEN
                -- Check if merchant matches
                IF NEW.merchant_name = v_condition->>'merchant' THEN
                    v_should_trigger := TRUE;
                END IF;
            
            WHEN 'category_limit' THEN
                -- Check category spending (would need aggregation)
                -- Simplified version
                IF NEW.merchant_category = v_condition->>'category' THEN
                    v_should_trigger := TRUE;
                END IF;
        END CASE;
        
        -- Create alert if rule triggered
        IF v_should_trigger THEN
            INSERT INTO alerts (
                user_id,
                alert_type,
                priority,
                title,
                message,
                metadata
            ) VALUES (
                NEW.user_id,
                'custom_rule',
                v_rule.alert_priority,
                v_rule.rule_name || ' Triggered',
                format('Transaction: ₹%s at %s', NEW.amount, NEW.merchant_name),
                jsonb_build_object(
                    'rule_id', v_rule.id,
                    'transaction_id', NEW.id,
                    'rule_type', v_rule.rule_type
                )
            );
            
            -- Update rule statistics
            UPDATE alert_rules
            SET triggered_count = triggered_count + 1,
                last_triggered_at = NOW()
            WHERE id = v_rule.id;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_alert_rules
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION check_alert_rules_on_transaction();

-- Updated at trigger for new tables
CREATE TRIGGER update_user_notification_prefs_updated_at 
    BEFORE UPDATE ON user_notification_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_templates_updated_at 
    BEFORE UPDATE ON alert_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at 
    BEFORE UPDATE ON alert_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_notification_preferences IS 'User-specific notification preferences and quiet hours';
COMMENT ON TABLE alert_templates IS 'Reusable alert message templates with placeholder support';
COMMENT ON TABLE alert_delivery_log IS 'Tracks delivery status of alerts across different channels';
COMMENT ON TABLE alert_digests IS 'Aggregated alert summaries for daily/weekly digest emails';
COMMENT ON TABLE alert_interactions IS 'User interactions with alerts for analytics';
COMMENT ON TABLE alert_rules IS 'Custom user-defined alert rules and triggers';
