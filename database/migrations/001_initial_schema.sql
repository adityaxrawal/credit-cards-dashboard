-- Initial database schema for Credit Card Dashboard
-- Run this migration on a fresh Supabase instance

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    profile_picture TEXT,
    monthly_budget DECIMAL(10, 2) DEFAULT 30000.00,
    gmail_watch_expiration TIMESTAMP,
    gmail_history_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);

-- Credit cards table
CREATE TABLE credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(50),
    last_four_digits VARCHAR(4),
    bill_date INTEGER NOT NULL CHECK (bill_date >= 1 AND bill_date <= 31),
    due_date INTEGER NOT NULL CHECK (due_date >= 1 AND due_date <= 31),
    credit_limit DECIMAL(10, 2),
    current_outstanding DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    card_activation_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX idx_credit_cards_bill_date ON credit_cards(bill_date);
CREATE INDEX idx_credit_cards_user_active ON credit_cards(user_id, is_active);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    transaction_date TIMESTAMP NOT NULL,
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'debit' CHECK (transaction_type IN ('debit', 'credit', 'refund')),
    description TEXT,
    billing_cycle_month INTEGER CHECK (billing_cycle_month >= 1 AND billing_cycle_month <= 12),
    billing_cycle_year INTEGER,
    email_message_id VARCHAR(255),
    is_manually_added BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_card_id ON transactions(card_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_billing_cycle ON transactions(user_id, billing_cycle_year, billing_cycle_month);
CREATE INDEX idx_transactions_email_message_id ON transactions(email_message_id) WHERE email_message_id IS NOT NULL;

-- Budget tracking table
CREATE TABLE budget_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    budget_limit DECIMAL(10, 2) NOT NULL,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

CREATE INDEX idx_budget_tracking_user_period ON budget_tracking(user_id, year DESC, month DESC);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    sent_via_email BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_user_unread ON alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- Email processing log table
CREATE TABLE email_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_message_id VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    from_email VARCHAR(255),
    received_date TIMESTAMP,
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'skipped')),
    transaction_id UUID REFERENCES transactions(id),
    extraction_method VARCHAR(50),
    confidence_score DECIMAL(3, 2),
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, email_message_id)
);

CREATE INDEX idx_email_log_user_id ON email_processing_log(user_id);
CREATE INDEX idx_email_log_message_id ON email_processing_log(email_message_id);
CREATE INDEX idx_email_log_status ON email_processing_log(processing_status);
CREATE INDEX idx_email_log_user_status ON email_processing_log(user_id, processing_status);

-- Analytics cache table
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_key VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    period_start DATE,
    period_end DATE,
    computed_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(user_id, metric_key, period_start, period_end)
);

CREATE INDEX idx_analytics_cache_user_metric ON analytics_cache(user_id, metric_key);
CREATE INDEX idx_analytics_cache_expiry ON analytics_cache(expires_at) WHERE expires_at IS NOT NULL;

-- Gmail tokens table (encrypted)
CREATE TABLE gmail_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    refresh_token TEXT NOT NULL,
    scope TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Additional feature tables

-- Reward points tracking
CREATE TABLE reward_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    points_earned DECIMAL(10, 2),
    points_type VARCHAR(50),
    earned_date DATE NOT NULL,
    expiry_date DATE,
    is_redeemed BOOLEAN DEFAULT false,
    redeemed_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reward_points_user ON reward_points(user_id);
CREATE INDEX idx_reward_points_card ON reward_points(card_id);
CREATE INDEX idx_reward_points_expiry ON reward_points(expiry_date) WHERE is_redeemed = false AND expiry_date IS NOT NULL;

-- Bill payments tracking
CREATE TABLE bill_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    billing_cycle_month INTEGER NOT NULL CHECK (billing_cycle_month >= 1 AND billing_cycle_month <= 12),
    billing_cycle_year INTEGER NOT NULL,
    bill_amount DECIMAL(10, 2) NOT NULL,
    payment_amount DECIMAL(10, 2),
    payment_date DATE,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'partial')),
    due_date DATE NOT NULL,
    payment_method VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, card_id, billing_cycle_month, billing_cycle_year)
);

CREATE INDEX idx_bill_payments_user ON bill_payments(user_id);
CREATE INDEX idx_bill_payments_status ON bill_payments(payment_status);
CREATE INDEX idx_bill_payments_due_date ON bill_payments(due_date);

-- Recurring transactions detection
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    merchant_name VARCHAR(255) NOT NULL,
    average_amount DECIMAL(10, 2),
    frequency VARCHAR(50) CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    last_transaction_date DATE,
    next_expected_date DATE,
    is_active BOOLEAN DEFAULT true,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recurring_transactions_user ON recurring_transactions(user_id);
CREATE INDEX idx_recurring_transactions_next_date ON recurring_transactions(next_expected_date) WHERE is_active = true;

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON credit_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_tracking_updated_at BEFORE UPDATE ON budget_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gmail_tokens_updated_at BEFORE UPDATE ON gmail_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reward_points_updated_at BEFORE UPDATE ON reward_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bill_payments_updated_at BEFORE UPDATE ON bill_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
-- Note: These will be refined when implementing authentication in Phase 1

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can manage their own credit cards
CREATE POLICY "Users can read own credit cards" ON credit_cards FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own credit cards" ON credit_cards FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own credit cards" ON credit_cards FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own credit cards" ON credit_cards FOR DELETE USING (auth.uid()::text = user_id::text);

-- Users can manage their own transactions
CREATE POLICY "Users can read own transactions" ON transactions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid()::text = user_id::text);

-- Similar policies for other tables
CREATE POLICY "Users can read own budget tracking" ON budget_tracking FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own budget tracking" ON budget_tracking FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own alerts" ON alerts FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own email logs" ON email_processing_log FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own analytics" ON analytics_cache FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own reward points" ON reward_points FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own reward points" ON reward_points FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own bill payments" ON bill_payments FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own bill payments" ON bill_payments FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read own recurring transactions" ON recurring_transactions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own recurring transactions" ON recurring_transactions FOR ALL USING (auth.uid()::text = user_id::text);

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user account information and preferences';
COMMENT ON TABLE credit_cards IS 'Credit card details including bill dates and limits';
COMMENT ON TABLE transactions IS 'All credit card transactions with categorization';
COMMENT ON TABLE budget_tracking IS 'Monthly budget tracking and alerts';
COMMENT ON TABLE alerts IS 'User notifications for various events';
COMMENT ON TABLE email_processing_log IS 'Log of email processing for transaction extraction';
COMMENT ON TABLE analytics_cache IS 'Cached analytics computations for performance';
COMMENT ON TABLE gmail_tokens IS 'Encrypted Gmail refresh tokens for API access';
COMMENT ON TABLE reward_points IS 'Credit card reward points tracking';
COMMENT ON TABLE bill_payments IS 'Bill payment history and status';
COMMENT ON TABLE recurring_transactions IS 'Detected recurring subscription/payment patterns';
