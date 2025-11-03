-- Create recurring_transactions table for Phase 4: Recurring Transactions
-- Manages automated recurring payments and subscription-like transactions

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Transaction details
    merchant_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
    category VARCHAR(100),
    description TEXT,
    
    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    next_execution TIMESTAMP WITH TIME ZONE NOT NULL,
    last_execution TIMESTAMP WITH TIME ZONE,
    
    -- Status and tracking
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    execution_count INTEGER NOT NULL DEFAULT 0,
    max_executions INTEGER, -- Null for indefinite
    
    -- Configuration
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    notification_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_execute BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata stored as JSONB
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for recurring_transactions
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_card_id ON recurring_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_status ON recurring_transactions(status);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_execution ON recurring_transactions(next_execution);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_status ON recurring_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_frequency ON recurring_transactions(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_next ON recurring_transactions(user_id, next_execution) WHERE status = 'active';

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_metadata ON recurring_transactions USING GIN (metadata);

-- Create recurring_transaction_executions table for execution history
CREATE TABLE IF NOT EXISTS recurring_transaction_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_transaction_id UUID NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Execution tracking
    execution_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
    error_message TEXT,
    amount_executed DECIMAL(15,2) NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for recurring_transaction_executions
CREATE INDEX IF NOT EXISTS idx_recurring_executions_recurring_id ON recurring_transaction_executions(recurring_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recurring_executions_transaction_id ON recurring_transaction_executions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recurring_executions_status ON recurring_transaction_executions(status);
CREATE INDEX IF NOT EXISTS idx_recurring_executions_execution_date ON recurring_transaction_executions(execution_date);
CREATE INDEX IF NOT EXISTS idx_recurring_executions_recurring_status ON recurring_transaction_executions(recurring_transaction_id, status);

-- Create trigger for updated_at
CREATE TRIGGER update_recurring_transactions_updated_at 
    BEFORE UPDATE ON recurring_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for upcoming recurring transactions (next 30 days)
CREATE OR REPLACE VIEW upcoming_recurring_transactions AS
SELECT 
    rt.*,
    c.card_name,
    c.bank_name,
    EXTRACT(DAY FROM (rt.next_execution - NOW())) as days_until_execution
FROM recurring_transactions rt
JOIN cards c ON rt.card_id = c.id
WHERE rt.status = 'active'
  AND rt.next_execution <= (NOW() + INTERVAL '30 days')
ORDER BY rt.next_execution ASC;

-- Create view for recurring transaction statistics
CREATE OR REPLACE VIEW recurring_transaction_stats AS
SELECT 
    rt.user_id,
    rt.status,
    rt.frequency,
    COUNT(*) as transaction_count,
    SUM(rt.amount) as total_amount,
    AVG(rt.amount) as average_amount,
    -- Calculate monthly equivalent
    SUM(
        CASE rt.frequency
            WHEN 'daily' THEN rt.amount * 30
            WHEN 'weekly' THEN rt.amount * 4.33
            WHEN 'biweekly' THEN rt.amount * 2.17
            WHEN 'monthly' THEN rt.amount
            WHEN 'quarterly' THEN rt.amount / 3.0
            WHEN 'annually' THEN rt.amount / 12.0
        END
    ) as monthly_equivalent_total
FROM recurring_transactions rt
GROUP BY rt.user_id, rt.status, rt.frequency;

-- Create view for execution success rate
CREATE OR REPLACE VIEW recurring_execution_success_rate AS
SELECT 
    rte.recurring_transaction_id,
    COUNT(*) as total_executions,
    SUM(CASE WHEN rte.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN rte.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    SUM(CASE WHEN rte.status = 'skipped' THEN 1 ELSE 0 END) as skipped_executions,
    SUM(CASE WHEN rte.status = 'pending' THEN 1 ELSE 0 END) as pending_executions,
    ROUND(
        (SUM(CASE WHEN rte.status = 'completed' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as success_rate
FROM recurring_transaction_executions rte
GROUP BY rte.recurring_transaction_id;

-- Add helpful comments
COMMENT ON TABLE recurring_transactions IS 'Stores recurring transaction schedules with automatic execution capabilities';
COMMENT ON TABLE recurring_transaction_executions IS 'Tracks execution history and status for each recurring transaction run';
COMMENT ON VIEW upcoming_recurring_transactions IS 'Shows all active recurring transactions due in the next 30 days';
COMMENT ON VIEW recurring_transaction_stats IS 'Aggregated statistics for recurring transactions by user and frequency';
COMMENT ON VIEW recurring_execution_success_rate IS 'Success rate metrics for recurring transaction executions';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transactions TO api_user;
-- GRANT SELECT, INSERT, UPDATE ON recurring_transaction_executions TO api_user;
-- GRANT SELECT ON upcoming_recurring_transactions TO api_user;
-- GRANT SELECT ON recurring_transaction_stats TO api_user;
-- GRANT SELECT ON recurring_execution_success_rate TO api_user;
