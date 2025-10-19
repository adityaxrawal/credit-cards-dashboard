-- 1. Users (handled by Supabase Auth automatically)
-- No need to create this, Supabase provides auth.users

-- 2. user_profiles (extends Supabase auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  profile_picture_url TEXT,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000,
  gmail_refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. credit_cards
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT, -- VISA, MC, etc.
  statement_day INT, -- 1-31
  sender_pattern TEXT,
  current_due DECIMAL(12, 2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_last_4, bank_name)
);

-- 4. transactions (SINGLE TABLE for all transactions)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID,
  transaction_date TIMESTAMPTZ NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_type TEXT DEFAULT 'DEBIT', -- DEBIT, CREDIT, REVERSAL
  is_in_statement BOOLEAN DEFAULT FALSE,
  email_id TEXT UNIQUE, -- Gmail message ID for deduplication
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. statements
CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_month INT NOT NULL,
  statement_year INT NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  due_date DATE NOT NULL,
  total_due DECIMAL(12, 2) NOT NULL,
  minimum_due DECIMAL(12, 2),
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, statement_month, statement_year)
);

-- Add foreign key constraint to transactions table
ALTER TABLE transactions
ADD CONSTRAINT fk_statement
FOREIGN KEY (statement_id)
REFERENCES statements(id)
ON DELETE SET NULL;

-- 6. spending_limits
CREATE TABLE spending_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL, -- GLOBAL, CATEGORY
  category_name TEXT,
  limit_amount DECIMAL(12, 2) NOT NULL,
  current_spending DECIMAL(12, 2) DEFAULT 0,
  alert_threshold INT DEFAULT 90,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (minimal, for performance)
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_email ON transactions(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_transactions_statement ON transactions(statement_id) WHERE is_in_statement = TRUE;
CREATE INDEX idx_cards_user ON credit_cards(user_id);
CREATE INDEX idx_limits_user_active ON spending_limits(user_id) WHERE is_active = TRUE;

-- Enable Row Level Security (RLS)
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cards" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

-- Repeat for other tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own statements" ON statements
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own limits" ON spending_limits
  FOR SELECT USING (auth.uid() = user_id);