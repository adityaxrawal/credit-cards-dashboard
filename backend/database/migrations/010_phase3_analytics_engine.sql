-- Phase 3 Analytics Engine Enhancement
-- Comprehensive analytics caching, computation, and pattern detection

-- Analytics computation cache
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key VARCHAR(255) NOT NULL,
  metric_type VARCHAR(100) NOT NULL, -- 'top_cards', 'top_merchants', 'spending_trends', 'category_breakdown', 'comparative_analysis'
  time_period VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cache_key)
);

CREATE INDEX idx_analytics_cache_user_key ON analytics_cache(user_id, cache_key);
CREATE INDEX idx_analytics_cache_expiry ON analytics_cache(expires_at);
CREATE INDEX idx_analytics_cache_metric ON analytics_cache(user_id, metric_type, time_period);

-- Spending patterns and trends
CREATE TABLE IF NOT EXISTS spending_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type VARCHAR(100) NOT NULL, -- 'recurring_expense', 'seasonal_spike', 'unusual_activity', 'merchant_loyalty', 'category_shift'
  category VARCHAR(100),
  merchant VARCHAR(255),
  card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  pattern_data JSONB NOT NULL,
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_occurrence TIMESTAMP WITH TIME ZONE,
  last_occurrence TIMESTAMP WITH TIME ZONE,
  frequency VARCHAR(50), -- 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'
  average_amount DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_spending_patterns_user ON spending_patterns(user_id, pattern_type);
CREATE INDEX idx_spending_patterns_active ON spending_patterns(user_id, is_active);
CREATE INDEX idx_spending_patterns_category ON spending_patterns(user_id, category);

-- Merchant performance analytics
CREATE TABLE IF NOT EXISTS merchant_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  time_period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  average_transaction DECIMAL(12,2) DEFAULT 0,
  median_transaction DECIMAL(12,2) DEFAULT 0,
  max_transaction DECIMAL(12,2) DEFAULT 0,
  min_transaction DECIMAL(12,2) DEFAULT 0,
  rewards_earned DECIMAL(12,2) DEFAULT 0,
  percentage_of_total_spending DECIMAL(5,2),
  rank_by_spending INTEGER,
  rank_by_frequency INTEGER,
  growth_rate DECIMAL(8,2), -- percentage change from previous period
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, merchant, time_period, period_start)
);

CREATE INDEX idx_merchant_analytics_user ON merchant_analytics(user_id, time_period);
CREATE INDEX idx_merchant_analytics_ranking ON merchant_analytics(user_id, rank_by_spending);
CREATE INDEX idx_merchant_analytics_period ON merchant_analytics(user_id, period_start, period_end);

-- Card performance analytics
CREATE TABLE IF NOT EXISTS card_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  time_period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  average_transaction DECIMAL(12,2) DEFAULT 0,
  rewards_earned DECIMAL(12,2) DEFAULT 0,
  rewards_rate DECIMAL(5,2), -- average rewards percentage
  utilization_rate DECIMAL(5,2), -- percentage of credit limit used
  on_time_payments INTEGER DEFAULT 0,
  late_payments INTEGER DEFAULT 0,
  interest_charged DECIMAL(12,2) DEFAULT 0,
  fees_charged DECIMAL(12,2) DEFAULT 0,
  percentage_of_total_spending DECIMAL(5,2),
  rank_by_usage INTEGER,
  rank_by_rewards INTEGER,
  top_category VARCHAR(100),
  top_merchant VARCHAR(255),
  growth_rate DECIMAL(8,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, card_id, time_period, period_start)
);

CREATE INDEX idx_card_analytics_user ON card_analytics(user_id, time_period);
CREATE INDEX idx_card_analytics_card ON card_analytics(card_id, period_start);
CREATE INDEX idx_card_analytics_ranking ON card_analytics(user_id, rank_by_usage);

-- Category trends
CREATE TABLE IF NOT EXISTS category_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  time_period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  average_transaction DECIMAL(12,2) DEFAULT 0,
  budget_allocated DECIMAL(12,2),
  budget_utilization DECIMAL(5,2),
  percentage_of_total_spending DECIMAL(5,2),
  rank INTEGER,
  month_over_month_change DECIMAL(8,2),
  year_over_year_change DECIMAL(8,2),
  trend_direction VARCHAR(20), -- 'increasing', 'decreasing', 'stable'
  seasonality_factor DECIMAL(5,2),
  predicted_next_period DECIMAL(12,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category, time_period, period_start)
);

CREATE INDEX idx_category_trends_user ON category_trends(user_id, time_period);
CREATE INDEX idx_category_trends_category ON category_trends(category, period_start);
CREATE INDEX idx_category_trends_ranking ON category_trends(user_id, rank);

-- Anomaly detection
CREATE TABLE IF NOT EXISTS spending_anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  anomaly_type VARCHAR(100) NOT NULL, -- 'amount_spike', 'unusual_merchant', 'frequency_anomaly', 'location_anomaly', 'time_anomaly'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  expected_value DECIMAL(12,2),
  actual_value DECIMAL(12,2),
  deviation_score DECIMAL(8,2), -- standard deviations from mean
  confidence_score DECIMAL(5,2),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(50), -- 'user_confirmed', 'auto_cleared', 'system_override'
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_spending_anomalies_user ON spending_anomalies(user_id, severity);
CREATE INDEX idx_spending_anomalies_unresolved ON spending_anomalies(user_id, resolved);
CREATE INDEX idx_spending_anomalies_detected ON spending_anomalies(detected_at);

-- Comparative analytics
CREATE TABLE IF NOT EXISTS comparative_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparison_type VARCHAR(100) NOT NULL, -- 'month_over_month', 'year_over_year', 'quarter_over_quarter', 'card_comparison', 'category_comparison'
  entity_type VARCHAR(50), -- 'card', 'category', 'merchant', 'overall'
  entity_id VARCHAR(255),
  entity_name VARCHAR(255),
  period1_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period1_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period2_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period2_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  period1_value DECIMAL(12,2),
  period2_value DECIMAL(12,2),
  absolute_change DECIMAL(12,2),
  percentage_change DECIMAL(8,2),
  trend VARCHAR(20), -- 'improving', 'declining', 'stable'
  metadata JSONB DEFAULT '{}',
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comparative_analytics_user ON comparative_analytics(user_id, comparison_type);
CREATE INDEX idx_comparative_analytics_entity ON comparative_analytics(user_id, entity_type, entity_id);

-- Function to clean expired analytics cache
CREATE OR REPLACE FUNCTION clean_expired_analytics_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update analytics cache hit count
CREATE OR REPLACE FUNCTION update_cache_hit_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count = OLD.hit_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_analytics_cache_hit
  BEFORE UPDATE ON analytics_cache
  FOR EACH ROW
  WHEN (OLD.data IS NOT DISTINCT FROM NEW.data)
  EXECUTE FUNCTION update_cache_hit_count();

-- Function to detect spending anomalies on transaction insert
CREATE OR REPLACE FUNCTION detect_transaction_anomalies()
RETURNS TRIGGER AS $$
DECLARE
  avg_amount DECIMAL(12,2);
  stddev_amount DECIMAL(12,2);
  deviation_score DECIMAL(8,2);
  transaction_count INTEGER;
BEGIN
  -- Calculate statistics for similar transactions (same category, similar time window)
  SELECT 
    AVG(amount),
    STDDEV(amount),
    COUNT(*)
  INTO avg_amount, stddev_amount, transaction_count
  FROM transactions
  WHERE user_id = NEW.user_id
    AND category = NEW.category
    AND date >= NOW() - INTERVAL '90 days'
    AND date < NEW.date
    AND id != NEW.id;
  
  -- Only check if we have enough historical data
  IF transaction_count >= 10 AND stddev_amount > 0 THEN
    deviation_score = (NEW.amount - avg_amount) / stddev_amount;
    
    -- Flag as anomaly if amount is more than 3 standard deviations from mean
    IF ABS(deviation_score) > 3 THEN
      INSERT INTO spending_anomalies (
        user_id,
        transaction_id,
        anomaly_type,
        severity,
        description,
        expected_value,
        actual_value,
        deviation_score,
        confidence_score
      ) VALUES (
        NEW.user_id,
        NEW.id,
        'amount_spike',
        CASE 
          WHEN ABS(deviation_score) > 5 THEN 'critical'
          WHEN ABS(deviation_score) > 4 THEN 'high'
          ELSE 'medium'
        END,
        'Transaction amount significantly deviates from historical patterns for this category',
        avg_amount,
        NEW.amount,
        deviation_score,
        LEAST(100, ABS(deviation_score) * 10)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_anomalies
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION detect_transaction_anomalies();

-- Function to update spending patterns
CREATE OR REPLACE FUNCTION update_spending_patterns()
RETURNS void AS $$
DECLARE
  pattern_record RECORD;
BEGIN
  -- Detect recurring expenses (same merchant, similar amount, regular frequency)
  INSERT INTO spending_patterns (
    user_id,
    pattern_type,
    category,
    merchant,
    pattern_data,
    confidence_score,
    first_occurrence,
    last_occurrence,
    frequency,
    average_amount
  )
  SELECT 
    user_id,
    'recurring_expense',
    category,
    merchant,
    jsonb_build_object(
      'transaction_count', COUNT(*),
      'amount_variance', STDDEV(amount),
      'day_of_month', MODE() WITHIN GROUP (ORDER BY EXTRACT(DAY FROM date))
    ),
    CASE 
      WHEN COUNT(*) >= 6 AND STDDEV(amount) < AVG(amount) * 0.1 THEN 95
      WHEN COUNT(*) >= 4 AND STDDEV(amount) < AVG(amount) * 0.2 THEN 80
      ELSE 60
    END,
    MIN(date),
    MAX(date),
    'monthly',
    AVG(amount)
  FROM transactions
  WHERE date >= NOW() - INTERVAL '6 months'
  GROUP BY user_id, category, merchant
  HAVING COUNT(*) >= 3
    AND STDDEV(amount) < AVG(amount) * 0.25
  ON CONFLICT (user_id, pattern_type, merchant)
  DO UPDATE SET
    pattern_data = EXCLUDED.pattern_data,
    confidence_score = EXCLUDED.confidence_score,
    last_occurrence = EXCLUDED.last_occurrence,
    average_amount = EXCLUDED.average_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Row Level Security Policies
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparative_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_cache_policy ON analytics_cache FOR ALL USING (user_id = auth.uid());
CREATE POLICY spending_patterns_policy ON spending_patterns FOR ALL USING (user_id = auth.uid());
CREATE POLICY merchant_analytics_policy ON merchant_analytics FOR ALL USING (user_id = auth.uid());
CREATE POLICY card_analytics_policy ON card_analytics FOR ALL USING (user_id = auth.uid());
CREATE POLICY category_trends_policy ON category_trends FOR ALL USING (user_id = auth.uid());
CREATE POLICY spending_anomalies_policy ON spending_anomalies FOR ALL USING (user_id = auth.uid());
CREATE POLICY comparative_analytics_policy ON comparative_analytics FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON analytics_cache TO authenticated;
GRANT ALL ON spending_patterns TO authenticated;
GRANT ALL ON merchant_analytics TO authenticated;
GRANT ALL ON card_analytics TO authenticated;
GRANT ALL ON category_trends TO authenticated;
GRANT ALL ON spending_anomalies TO authenticated;
GRANT ALL ON comparative_analytics TO authenticated;

-- Comments
COMMENT ON TABLE analytics_cache IS 'Cache for expensive analytics computations with TTL';
COMMENT ON TABLE spending_patterns IS 'Detected spending patterns and recurring expenses';
COMMENT ON TABLE merchant_analytics IS 'Pre-computed merchant performance metrics';
COMMENT ON TABLE card_analytics IS 'Pre-computed card usage and performance metrics';
COMMENT ON TABLE category_trends IS 'Category spending trends with predictions';
COMMENT ON TABLE spending_anomalies IS 'Detected unusual spending patterns';
COMMENT ON TABLE comparative_analytics IS 'Period-over-period comparative analysis';
