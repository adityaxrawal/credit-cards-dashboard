-- Migration: 019_add_bills_and_payments.sql
-- Purpose: Add missing tables for bills module (bills, payments, bill_reminder_settings)
-- Date: 2025-11-09
-- Description: Creates tables for bill management, payment tracking, and reminder configuration

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  minimum_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
  payment_date DATE,
  statement_period_start DATE NOT NULL,
  statement_period_end DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, card_id, bill_date)
);

-- Indexes for bills table
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_card_id ON bills(card_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_user_status ON bills(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_user_due_date ON bills(user_id, due_date) WHERE status IN ('pending', 'overdue');

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(100),
  status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  transaction_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_card_id ON payments(card_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Bill reminder settings table
CREATE TABLE IF NOT EXISTS bill_reminder_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  enable_reminders BOOLEAN DEFAULT true,
  reminder_days INTEGER[] DEFAULT ARRAY[7, 3, 1],
  enable_autopay_reminders BOOLEAN DEFAULT false,
  preferred_time VARCHAR(10) DEFAULT '09:00',
  channels TEXT[] DEFAULT ARRAY['email', 'in_app'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for bill_reminder_settings table
CREATE INDEX IF NOT EXISTS idx_bill_reminder_settings_user_id ON bill_reminder_settings(user_id);

-- Bill reminders table (for tracking individual reminder records)
CREATE TABLE IF NOT EXISTS bill_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  reminder_date DATE NOT NULL,
  days_before INTEGER NOT NULL,
  sent BOOLEAN DEFAULT false,
  last_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for bill_reminders table
CREATE INDEX IF NOT EXISTS idx_bill_reminders_user_id ON bill_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_reminders_bill_id ON bill_reminders(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_reminders_reminder_date ON bill_reminders(reminder_date) WHERE NOT sent;
CREATE INDEX IF NOT EXISTS idx_bill_reminders_pending ON bill_reminders(user_id, reminder_date) WHERE NOT sent;

-- Add updated_at triggers
CREATE TRIGGER update_bills_updated_at 
BEFORE UPDATE ON bills 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
BEFORE UPDATE ON payments 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_reminder_settings_updated_at 
BEFORE UPDATE ON bill_reminder_settings 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bills
CREATE POLICY "Users can read own bills" ON bills 
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own bills" ON bills 
FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own bills" ON bills 
FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own bills" ON bills 
FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for payments
CREATE POLICY "Users can read own payments" ON payments 
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own payments" ON payments 
FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own payments" ON payments 
FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own payments" ON payments 
FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for bill_reminder_settings
CREATE POLICY "Users can read own reminder settings" ON bill_reminder_settings 
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own reminder settings" ON bill_reminder_settings 
FOR ALL USING (auth.uid()::text = user_id::text);

-- RLS Policies for bill_reminders
CREATE POLICY "Users can read own reminders" ON bill_reminders 
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage own reminders" ON bill_reminders 
FOR ALL USING (auth.uid()::text = user_id::text);

-- Comments for documentation
COMMENT ON TABLE bills IS 'Credit card bills with due dates and payment tracking';
COMMENT ON TABLE payments IS 'Bill payment history and transaction records';
COMMENT ON TABLE bill_reminder_settings IS 'User preferences for bill reminder notifications';
COMMENT ON TABLE bill_reminders IS 'Individual reminder records for upcoming bill due dates';

-- Constraints check
DO $$
BEGIN
    -- Verify due_date is after bill_date
    IF EXISTS (
        SELECT 1 FROM bills WHERE due_date <= bill_date
    ) THEN
        RAISE EXCEPTION 'Invalid data: due_date must be after bill_date';
    END IF;

    RAISE NOTICE 'Migration 019 completed successfully';
    RAISE NOTICE 'Created tables: bills, payments, bill_reminder_settings, bill_reminders';
    RAISE NOTICE 'Added indexes, RLS policies, and triggers';
END $$;
