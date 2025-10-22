-- Add enhanced columns to current_transactions table
ALTER TABLE public.current_transactions 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'debit' CHECK (transaction_type IN ('debit', 'credit')),
ADD COLUMN IF NOT EXISTS card_last_4 TEXT,
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE;

-- Update existing data to populate new columns
UPDATE public.current_transactions 
SET 
    date = transaction_date,
    transaction_type = CASE 
        WHEN amount < 0 THEN 'debit' 
        ELSE 'credit' 
    END
WHERE date IS NULL;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_current_transactions_tags ON public.current_transactions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_current_transactions_recurring ON public.current_transactions(is_recurring);
CREATE INDEX IF NOT EXISTS idx_current_transactions_type ON public.current_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_current_transactions_gmail_id ON public.current_transactions(gmail_message_id);

-- Create budget_categories table for custom budget management
CREATE TABLE IF NOT EXISTS public.budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    monthly_budget DECIMAL(12,2) NOT NULL,
    color_code TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category_name)
);

-- Create indexes for budget_categories
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON public.budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_active ON public.budget_categories(is_active);

-- Enable RLS for budget_categories
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budget_categories
CREATE POLICY "Users can view own budget categories" ON public.budget_categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget categories" ON public.budget_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget categories" ON public.budget_categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget categories" ON public.budget_categories
    FOR DELETE USING (auth.uid() = user_id);

-- Apply updated_at trigger to budget_categories table
CREATE TRIGGER budget_categories_updated_at
    BEFORE UPDATE ON public.budget_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default budget categories
INSERT INTO public.budget_categories (user_id, category_name, monthly_budget, color_code)
SELECT 
    p.id as user_id,
    category_data.category_name,
    category_data.monthly_budget,
    category_data.color_code
FROM public.profiles p
CROSS JOIN (
    VALUES 
        ('Food & Dining', 15000.00, '#EF4444'),
        ('Shopping', 10000.00, '#8B5CF6'),
        ('Transportation', 5000.00, '#06B6D4'),
        ('Entertainment', 8000.00, '#F59E0B'),
        ('Bills & Utilities', 12000.00, '#10B981'),
        ('Healthcare', 5000.00, '#EC4899'),
        ('Travel', 20000.00, '#3B82F6'),
        ('Groceries', 8000.00, '#84CC16'),
        ('Fuel', 6000.00, '#F97316'),
        ('Others', 5000.00, '#6B7280')
) AS category_data(category_name, monthly_budget, color_code)
ON CONFLICT (user_id, category_name) DO NOTHING;

-- Add enhanced columns to spending_limits table if they don't exist
ALTER TABLE public.spending_limits 
ADD COLUMN IF NOT EXISTS alert_threshold DECIMAL(5,2) DEFAULT 80.00 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create credit_utilization table for tracking credit usage patterns
CREATE TABLE IF NOT EXISTS public.credit_utilization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    month_year DATE NOT NULL, -- First day of the month
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    credit_limit DECIMAL(12,2) NOT NULL,
    utilization_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN credit_limit > 0 THEN (total_spent / credit_limit * 100)
            ELSE 0
        END
    ) STORED,
    average_daily_balance DECIMAL(12,2) DEFAULT 0.00,
    peak_utilization DECIMAL(5,2) DEFAULT 0.00,
    days_over_30_percent INTEGER DEFAULT 0,
    days_over_50_percent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, card_id, month_year)
);

-- Create indexes for credit_utilization
CREATE INDEX IF NOT EXISTS idx_credit_utilization_user_id ON public.credit_utilization(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_utilization_card_id ON public.credit_utilization(card_id);
CREATE INDEX IF NOT EXISTS idx_credit_utilization_month_year ON public.credit_utilization(month_year);
CREATE INDEX IF NOT EXISTS idx_credit_utilization_percentage ON public.credit_utilization(utilization_percentage);

-- Enable RLS for credit_utilization
ALTER TABLE public.credit_utilization ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_utilization
CREATE POLICY "Users can view own credit utilization" ON public.credit_utilization
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit utilization" ON public.credit_utilization
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit utilization" ON public.credit_utilization
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit utilization" ON public.credit_utilization
    FOR DELETE USING (auth.uid() = user_id);

-- Apply updated_at trigger to credit_utilization table
CREATE TRIGGER credit_utilization_updated_at
    BEFORE UPDATE ON public.credit_utilization
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();