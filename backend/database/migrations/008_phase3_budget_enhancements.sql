-- Phase 3: Budget System Enhancements
-- Adds support for category-level budgets, audit logging, and advanced tracking

-- Budget categories table for fine-grained budget control
CREATE TABLE budget_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    budget_limit DECIMAL(10, 2) NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budget_categories_user ON budget_categories(user_id);
CREATE INDEX idx_budget_categories_active ON budget_categories(user_id, is_active) WHERE is_active = true;

-- Card-specific budget allocations
CREATE TABLE card_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    budget_limit DECIMAL(10, 2) NOT NULL,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(card_id, month, year)
);

CREATE INDEX idx_card_budgets_card ON card_budgets(card_id, year DESC, month DESC);
CREATE INDEX idx_card_budgets_user_period ON card_budgets(user_id, year DESC, month DESC);

-- Budget audit log for tracking all budget changes
CREATE TABLE budget_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    budget_id UUID,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'threshold_breach', 'alert_triggered')),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('budget_tracking', 'budget_category', 'card_budget')),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budget_audit_user ON budget_audit_log(user_id, created_at DESC);
CREATE INDEX idx_budget_audit_budget ON budget_audit_log(budget_id, created_at DESC);
CREATE INDEX idx_budget_audit_action ON budget_audit_log(action_type, created_at DESC);

-- Budget alerts configuration
CREATE TABLE budget_alert_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    threshold_percentages INTEGER[] DEFAULT ARRAY[50, 75, 90, 100],
    alert_channels VARCHAR(20)[] DEFAULT ARRAY['in_app', 'email'],
    daily_digest_enabled BOOLEAN DEFAULT false,
    weekly_summary_enabled BOOLEAN DEFAULT true,
    custom_rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spending forecasts table for predictive analytics
CREATE TABLE spending_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    forecast_type VARCHAR(50) DEFAULT 'monthly' CHECK (forecast_type IN ('daily', 'weekly', 'monthly')),
    predicted_amount DECIMAL(10, 2) NOT NULL,
    confidence_level DECIMAL(3, 2) DEFAULT 0.70,
    actual_amount DECIMAL(10, 2),
    variance DECIMAL(10, 2),
    model_version VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, forecast_date, forecast_type)
);

CREATE INDEX idx_forecasts_user_date ON spending_forecasts(user_id, forecast_date DESC);

-- Add new columns to existing budget_tracking table
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS period_type VARCHAR(20) DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'annual'));
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS alert_thresholds INTEGER[] DEFAULT ARRAY[75, 90, 100];
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS last_alert_percentage INTEGER DEFAULT 0;
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS category_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS rollover_enabled BOOLEAN DEFAULT false;
ALTER TABLE budget_tracking ADD COLUMN IF NOT EXISTS rollover_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Function to automatically update budget spending when transactions are added
CREATE OR REPLACE FUNCTION update_budget_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_month INTEGER;
    v_year INTEGER;
    v_user_id UUID;
BEGIN
    -- Extract user_id and billing cycle from transaction
    v_user_id := NEW.user_id;
    v_month := COALESCE(NEW.billing_cycle_month, EXTRACT(MONTH FROM NEW.transaction_date)::INTEGER);
    v_year := COALESCE(NEW.billing_cycle_year, EXTRACT(YEAR FROM NEW.transaction_date)::INTEGER);
    
    -- Update budget_tracking
    INSERT INTO budget_tracking (user_id, month, year, budget_limit, total_spent)
    VALUES (
        v_user_id,
        v_month,
        v_year,
        (SELECT monthly_budget FROM users WHERE id = v_user_id),
        NEW.amount
    )
    ON CONFLICT (user_id, month, year)
    DO UPDATE SET
        total_spent = budget_tracking.total_spent + NEW.amount,
        updated_at = NOW();
    
    -- Update card_budget if exists
    UPDATE card_budgets
    SET total_spent = total_spent + NEW.amount,
        updated_at = NOW()
    WHERE card_id = NEW.card_id
        AND month = v_month
        AND year = v_year;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update budget on transaction insert
CREATE TRIGGER trg_update_budget_on_transaction
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_budget_on_transaction();

-- Function to check budget thresholds and create alerts
CREATE OR REPLACE FUNCTION check_budget_thresholds()
RETURNS TRIGGER AS $$
DECLARE
    v_percentage DECIMAL(5, 2);
    v_threshold INTEGER;
    v_alert_config RECORD;
BEGIN
    -- Calculate spending percentage
    v_percentage := (NEW.total_spent / NULLIF(NEW.budget_limit, 0)) * 100;
    
    -- Get alert configuration
    SELECT * INTO v_alert_config
    FROM budget_alert_config
    WHERE user_id = NEW.user_id;
    
    -- Check if we've crossed a new threshold
    IF v_alert_config IS NOT NULL THEN
        FOREACH v_threshold IN ARRAY v_alert_config.threshold_percentages
        LOOP
            IF v_percentage >= v_threshold AND NEW.last_alert_percentage < v_threshold THEN
                -- Create alert
                INSERT INTO alerts (
                    user_id,
                    alert_type,
                    priority,
                    title,
                    message,
                    metadata
                ) VALUES (
                    NEW.user_id,
                    CASE
                        WHEN v_threshold >= 100 THEN 'budget_exceeded'
                        ELSE 'budget_threshold'
                    END,
                    CASE
                        WHEN v_threshold >= 100 THEN 'high'
                        WHEN v_threshold >= 90 THEN 'high'
                        WHEN v_threshold >= 75 THEN 'medium'
                        ELSE 'low'
                    END,
                    format('Budget Alert: %s%% Spent', v_threshold),
                    format('You have spent %s%% of your monthly budget (₹%s of ₹%s)',
                        ROUND(v_percentage, 1),
                        ROUND(NEW.total_spent, 2),
                        ROUND(NEW.budget_limit, 2)
                    ),
                    jsonb_build_object(
                        'threshold', v_threshold,
                        'percentage', ROUND(v_percentage, 2),
                        'month', NEW.month,
                        'year', NEW.year
                    )
                );
                
                -- Log the alert trigger
                INSERT INTO budget_audit_log (
                    user_id,
                    budget_id,
                    action_type,
                    entity_type,
                    new_value,
                    metadata
                ) VALUES (
                    NEW.user_id,
                    NEW.id,
                    'alert_triggered',
                    'budget_tracking',
                    jsonb_build_object('threshold', v_threshold, 'percentage', v_percentage),
                    jsonb_build_object('alert_created', true)
                );
                
                -- Update last alert percentage
                NEW.last_alert_percentage := v_threshold;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check thresholds on budget update
CREATE TRIGGER trg_check_budget_thresholds
BEFORE UPDATE OF total_spent ON budget_tracking
FOR EACH ROW
WHEN (OLD.total_spent IS DISTINCT FROM NEW.total_spent)
EXECUTE FUNCTION check_budget_thresholds();

-- Updated at triggers for new tables
CREATE TRIGGER update_budget_categories_updated_at 
    BEFORE UPDATE ON budget_categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_budgets_updated_at 
    BEFORE UPDATE ON card_budgets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_alert_config_updated_at 
    BEFORE UPDATE ON budget_alert_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security for new tables
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_forecasts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_budget_categories_period ON budget_categories(user_id, start_date, end_date);
CREATE INDEX idx_spending_forecasts_confidence ON spending_forecasts(user_id, confidence_level DESC);

COMMENT ON TABLE budget_categories IS 'Category-level budget allocations for fine-grained control';
COMMENT ON TABLE card_budgets IS 'Per-card budget limits for better spending tracking';
COMMENT ON TABLE budget_audit_log IS 'Complete audit trail of all budget-related changes';
COMMENT ON TABLE budget_alert_config IS 'User-specific alert configuration and preferences';
COMMENT ON TABLE spending_forecasts IS 'ML-based spending predictions and forecasts';
