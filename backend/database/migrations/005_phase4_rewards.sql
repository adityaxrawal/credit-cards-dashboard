-- Create tables for Phase 4: Rewards Optimization & Management system
-- This includes reward programs, earned rewards, and redemption tracking

-- Create reward_programs table to define reward structures for each card
CREATE TABLE IF NOT EXISTS reward_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Program details
    type VARCHAR(20) NOT NULL CHECK (type IN ('cashback', 'points', 'miles', 'custom')),
    name VARCHAR(255) NOT NULL,
    base_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Base reward rate (e.g., 1.5% = 1.5)
    
    -- Category-specific rates stored as JSONB
    category_rates JSONB DEFAULT '{}', -- {"dining": 5.0, "fuel": 2.0}
    bonus_categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of bonus category names
    
    -- Redemption options stored as JSONB
    redemption_options JSONB DEFAULT '[]', -- [{"type": "statement_credit", "value": 1.0, "minimumRedemption": 500}]
    
    -- Program constraints
    annual_fee DECIMAL(10,2) DEFAULT 0.00,
    reward_caps JSONB DEFAULT '{}', -- {"monthly": {"dining": 1000}, "annual": {"total": 50000}}
    
    -- Expiration policy
    expiration_policy JSONB DEFAULT '{}', -- {"expiresAfterMonths": 24, "description": "Points expire after 2 years"}
    
    -- Program status and metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    program_terms TEXT, -- Terms and conditions
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for reward_programs
CREATE INDEX IF NOT EXISTS idx_reward_programs_card_id ON reward_programs(card_id);
CREATE INDEX IF NOT EXISTS idx_reward_programs_type ON reward_programs(type);
CREATE INDEX IF NOT EXISTS idx_reward_programs_is_active ON reward_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_reward_programs_effective_dates ON reward_programs(effective_from, effective_to);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_reward_programs_category_rates ON reward_programs USING GIN (category_rates);
CREATE INDEX IF NOT EXISTS idx_reward_programs_redemption_options ON reward_programs USING GIN (redemption_options);
CREATE INDEX IF NOT EXISTS idx_reward_programs_reward_caps ON reward_programs USING GIN (reward_caps);

-- Create earned_rewards table to track all earned rewards
CREATE TABLE IF NOT EXISTS earned_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Reward details
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('cashback', 'points', 'miles')),
    amount DECIMAL(15,2) NOT NULL, -- Amount of reward earned (points, cashback value, miles)
    category VARCHAR(100) NOT NULL,
    rate_applied DECIMAL(5,2), -- Rate that was applied for this earning
    
    -- Dates
    earned_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMP WITH TIME ZONE,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
    redemption_id UUID, -- Reference to redemption record when redeemed
    
    -- Additional metadata
    bonus_applied BOOLEAN DEFAULT false, -- Whether bonus rate was applied
    promotion_id UUID, -- Reference to specific promotion if applicable
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for earned_rewards
CREATE INDEX IF NOT EXISTS idx_earned_rewards_user_id ON earned_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_card_id ON earned_rewards(card_id);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_transaction_id ON earned_rewards(transaction_id);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_status ON earned_rewards(status);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_earned_date ON earned_rewards(earned_date);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_expiration_date ON earned_rewards(expiration_date);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_category ON earned_rewards(category);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_user_card ON earned_rewards(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_earned_rewards_user_status ON earned_rewards(user_id, status);

-- Create reward_redemptions table to track all redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Redemption details
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('cashback', 'points', 'miles')),
    amount_redeemed DECIMAL(15,2) NOT NULL, -- Amount of rewards redeemed
    redemption_value DECIMAL(15,2) NOT NULL, -- Value in INR
    redemption_method VARCHAR(100) NOT NULL, -- statement_credit, bank_transfer, gift_card, etc.
    
    -- Processing details
    redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Additional information
    description TEXT,
    external_reference VARCHAR(255), -- External transaction/reference ID
    processing_fee DECIMAL(10,2) DEFAULT 0.00,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for reward_redemptions
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_card_id ON reward_redemptions(card_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status ON reward_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_redeemed_at ON reward_redemptions(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_method ON reward_redemptions(redemption_method);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_card ON reward_redemptions(user_id, card_id);

-- Create reward_promotions table for special offers and bonus campaigns
CREATE TABLE IF NOT EXISTS reward_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Promotion details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(50) NOT NULL, -- bonus_rate, flat_bonus, category_multiplier, etc.
    
    -- Eligibility
    card_types TEXT[], -- Which card types are eligible
    user_segments TEXT[], -- Which user segments are eligible (new, premium, etc.)
    minimum_spend DECIMAL(15,2), -- Minimum spend to qualify
    
    -- Reward structure
    bonus_structure JSONB NOT NULL, -- Flexible structure for different bonus types
    category_restrictions TEXT[], -- Applicable categories
    merchant_restrictions TEXT[], -- Applicable merchants
    
    -- Caps and limits
    maximum_bonus DECIMAL(15,2), -- Maximum bonus per user
    per_transaction_cap DECIMAL(15,2), -- Maximum bonus per transaction
    
    -- Timing
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER DEFAULT 0, -- How many times it's been used
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for reward_promotions
CREATE INDEX IF NOT EXISTS idx_reward_promotions_is_active ON reward_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_reward_promotions_dates ON reward_promotions(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_reward_promotions_type ON reward_promotions(promotion_type);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_reward_promotions_card_types ON reward_promotions USING GIN (card_types);
CREATE INDEX IF NOT EXISTS idx_reward_promotions_bonus_structure ON reward_promotions USING GIN (bonus_structure);

-- Create user_reward_preferences table for personalized settings
CREATE TABLE IF NOT EXISTS user_reward_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Optimization preferences
    preferred_redemption_method VARCHAR(100) DEFAULT 'statement_credit',
    auto_redeem_threshold DECIMAL(15,2), -- Auto-redeem when balance reaches this amount
    auto_redeem_enabled BOOLEAN DEFAULT false,
    
    -- Notification preferences
    notify_on_earning BOOLEAN DEFAULT true,
    notify_on_bonus BOOLEAN DEFAULT true,
    notify_on_expiration BOOLEAN DEFAULT true, -- Days before expiration to notify
    expiration_reminder_days INTEGER DEFAULT 30,
    
    -- Goal setting
    annual_reward_target DECIMAL(15,2), -- Target annual rewards
    preferred_categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- Categories user wants to optimize
    
    -- Privacy settings
    share_analytics BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create reward_analytics_cache table for performance optimization
CREATE TABLE IF NOT EXISTS reward_analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Cache metadata
    cache_key VARCHAR(255) NOT NULL, -- e.g., "monthly_2024_01", "yearly_2024"
    cache_type VARCHAR(50) NOT NULL, -- monthly, yearly, category, card
    
    -- Cached data
    analytics_data JSONB NOT NULL,
    
    -- Cache control
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    
    UNIQUE(user_id, cache_key)
);

-- Create indexes for reward_analytics_cache
CREATE INDEX IF NOT EXISTS idx_reward_analytics_cache_user_id ON reward_analytics_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_analytics_cache_expires_at ON reward_analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_reward_analytics_cache_type ON reward_analytics_cache(cache_type);

-- Insert some sample reward programs for common card types
INSERT INTO reward_programs (card_id, type, name, base_rate, category_rates, bonus_categories, redemption_options, annual_fee) 
SELECT 
    c.id,
    'cashback' as type,
    'Standard Cashback Program' as name,
    1.0 as base_rate,
    '{"dining": 2.0, "fuel": 1.5, "online": 2.0}'::jsonb as category_rates,
    ARRAY['dining', 'online'] as bonus_categories,
    '[
        {"type": "statement_credit", "value": 1.0, "minimumRedemption": 500, "description": "Statement credit"},
        {"type": "bank_transfer", "value": 1.0, "minimumRedemption": 1000, "description": "Direct bank transfer"}
    ]'::jsonb as redemption_options,
    0.00 as annual_fee
FROM cards c 
WHERE NOT EXISTS (SELECT 1 FROM reward_programs rp WHERE rp.card_id = c.id)
ON CONFLICT DO NOTHING;

-- Create functions for reward calculations and management

-- Function to calculate reward for a transaction
CREATE OR REPLACE FUNCTION calculate_reward_for_transaction(
    p_card_id UUID,
    p_amount DECIMAL(15,2),
    p_category VARCHAR(100),
    p_merchant_name VARCHAR(255) DEFAULT NULL
) RETURNS TABLE(
    reward_amount DECIMAL(15,2),
    reward_rate DECIMAL(5,2),
    reward_type VARCHAR(20)
) AS $$
DECLARE
    program_record RECORD;
    calculated_rate DECIMAL(5,2);
    calculated_amount DECIMAL(15,2);
BEGIN
    -- Get the active reward program for the card
    SELECT * INTO program_record 
    FROM reward_programs 
    WHERE card_id = p_card_id AND is_active = true
    LIMIT 1;
    
    IF program_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL(15,2), 0::DECIMAL(5,2), 'cashback'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Start with base rate
    calculated_rate := program_record.base_rate;
    
    -- Check for category-specific rates
    IF program_record.category_rates ? p_category THEN
        calculated_rate := (program_record.category_rates ->> p_category)::DECIMAL(5,2);
    END IF;
    
    -- Check for bonus categories (could add multiplier logic here)
    IF p_category = ANY(program_record.bonus_categories) THEN
        calculated_rate := GREATEST(calculated_rate, program_record.base_rate * 1.5);
    END IF;
    
    -- Calculate reward amount
    calculated_amount := (p_amount * calculated_rate) / 100;
    
    -- Round to 2 decimal places
    calculated_amount := ROUND(calculated_amount, 2);
    
    RETURN QUERY SELECT calculated_amount, calculated_rate, program_record.type;
END;
$$ LANGUAGE plpgsql;

-- Function to get user reward summary
CREATE OR REPLACE FUNCTION get_user_reward_summary(p_user_id UUID)
RETURNS TABLE(
    total_earned_cashback DECIMAL(15,2),
    total_earned_points DECIMAL(15,2),
    total_earned_miles DECIMAL(15,2),
    total_redeemed_value DECIMAL(15,2),
    pending_redemption_value DECIMAL(15,2),
    expiring_soon_value DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN er.reward_type = 'cashback' AND er.status = 'active' THEN er.amount ELSE 0 END), 0) as total_earned_cashback,
        COALESCE(SUM(CASE WHEN er.reward_type = 'points' AND er.status = 'active' THEN er.amount ELSE 0 END), 0) as total_earned_points,
        COALESCE(SUM(CASE WHEN er.reward_type = 'miles' AND er.status = 'active' THEN er.amount ELSE 0 END), 0) as total_earned_miles,
        COALESCE(SUM(rr.redemption_value), 0) as total_redeemed_value,
        COALESCE(SUM(CASE WHEN er.status = 'active' THEN er.amount ELSE 0 END), 0) as pending_redemption_value,
        COALESCE(SUM(CASE WHEN er.status = 'active' AND er.expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN er.amount ELSE 0 END), 0) as expiring_soon_value
    FROM earned_rewards er
    LEFT JOIN reward_redemptions rr ON rr.user_id = er.user_id
    WHERE er.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-expire rewards
CREATE OR REPLACE FUNCTION expire_old_rewards()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE earned_rewards 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND expiration_date IS NOT NULL 
    AND expiration_date < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old analytics cache
CREATE OR REPLACE FUNCTION cleanup_analytics_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM reward_analytics_cache 
    WHERE expires_at < NOW() OR is_valid = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at fields
CREATE TRIGGER update_reward_programs_updated_at 
    BEFORE UPDATE ON reward_programs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earned_rewards_updated_at 
    BEFORE UPDATE ON earned_rewards 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reward_redemptions_updated_at 
    BEFORE UPDATE ON reward_redemptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reward_promotions_updated_at 
    BEFORE UPDATE ON reward_promotions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_reward_preferences_updated_at 
    BEFORE UPDATE ON user_reward_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics and reporting

-- View for reward earnings by category
CREATE OR REPLACE VIEW reward_earnings_by_category AS
SELECT 
    er.user_id,
    er.category,
    er.reward_type,
    DATE_TRUNC('month', er.earned_date) as month,
    COUNT(*) as transaction_count,
    SUM(er.amount) as total_rewards,
    AVG(er.amount) as avg_reward_per_transaction,
    AVG(er.rate_applied) as avg_rate_applied
FROM earned_rewards er
WHERE er.status != 'cancelled'
GROUP BY er.user_id, er.category, er.reward_type, DATE_TRUNC('month', er.earned_date);

-- View for card performance analysis
CREATE OR REPLACE VIEW card_reward_performance AS
SELECT 
    c.id as card_id,
    c.card_name,
    c.user_id,
    COUNT(er.id) as total_earning_transactions,
    SUM(er.amount) as total_rewards_earned,
    AVG(er.amount) as avg_reward_per_transaction,
    SUM(CASE WHEN er.status = 'redeemed' THEN er.amount ELSE 0 END) as total_rewards_redeemed,
    SUM(CASE WHEN er.status = 'active' THEN er.amount ELSE 0 END) as pending_rewards,
    rp.annual_fee,
    (SUM(er.amount) - COALESCE(rp.annual_fee, 0)) as net_benefit
FROM cards c
LEFT JOIN earned_rewards er ON c.id = er.card_id
LEFT JOIN reward_programs rp ON c.id = rp.card_id AND rp.is_active = true
GROUP BY c.id, c.card_name, c.user_id, rp.annual_fee;

-- View for expiring rewards alert
CREATE OR REPLACE VIEW expiring_rewards AS
SELECT 
    er.user_id,
    er.card_id,
    c.card_name,
    er.reward_type,
    SUM(er.amount) as expiring_amount,
    er.expiration_date,
    DATE_PART('day', er.expiration_date - NOW()) as days_until_expiration
FROM earned_rewards er
JOIN cards c ON er.card_id = c.id
WHERE er.status = 'active'
AND er.expiration_date IS NOT NULL
AND er.expiration_date BETWEEN NOW() AND NOW() + INTERVAL '60 days'
GROUP BY er.user_id, er.card_id, c.card_name, er.reward_type, er.expiration_date
ORDER BY er.expiration_date ASC;

-- Add helpful comments
COMMENT ON TABLE reward_programs IS 'Defines reward earning structure for each credit card';
COMMENT ON TABLE earned_rewards IS 'Tracks all rewards earned by users from transactions';
COMMENT ON TABLE reward_redemptions IS 'Records all reward redemption transactions';
COMMENT ON TABLE reward_promotions IS 'Special promotions and bonus campaigns';
COMMENT ON TABLE user_reward_preferences IS 'User preferences for reward optimization and notifications';
COMMENT ON TABLE reward_analytics_cache IS 'Performance cache for analytics queries';

COMMENT ON VIEW reward_earnings_by_category IS 'Analytics view showing reward earnings grouped by category and time period';
COMMENT ON VIEW card_reward_performance IS 'Performance analysis of each card in terms of reward generation';
COMMENT ON VIEW expiring_rewards IS 'Alert view for rewards that are expiring soon';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reward_programs TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON earned_rewards TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reward_redemptions TO api_user;
-- GRANT SELECT ON reward_promotions TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_reward_preferences TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reward_analytics_cache TO api_user;
-- GRANT SELECT ON reward_earnings_by_category TO api_user;
-- GRANT SELECT ON card_reward_performance TO api_user;
-- GRANT SELECT ON expiring_rewards TO api_user;