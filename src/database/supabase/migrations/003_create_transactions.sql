-- Create current_transactions table
CREATE TABLE public.current_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    category TEXT,
    merchant TEXT,
    email_id TEXT,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create statement_transactions table
CREATE TABLE public.statement_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    statement_id UUID,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    category TEXT,
    merchant TEXT,
    email_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create statements table
CREATE TABLE public.statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    minimum_amount DECIMAL(12,2) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for statement_transactions
ALTER TABLE public.statement_transactions 
ADD CONSTRAINT fk_statement_transactions_statement_id 
FOREIGN KEY (statement_id) REFERENCES public.statements(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_current_transactions_user_id ON public.current_transactions(user_id);
CREATE INDEX idx_current_transactions_card_id ON public.current_transactions(card_id);
CREATE INDEX idx_current_transactions_date ON public.current_transactions(transaction_date);
CREATE INDEX idx_current_transactions_processed ON public.current_transactions(is_processed);

CREATE INDEX idx_statement_transactions_user_id ON public.statement_transactions(user_id);
CREATE INDEX idx_statement_transactions_card_id ON public.statement_transactions(card_id);
CREATE INDEX idx_statement_transactions_statement_id ON public.statement_transactions(statement_id);
CREATE INDEX idx_statement_transactions_date ON public.statement_transactions(transaction_date);

CREATE INDEX idx_statements_user_id ON public.statements(user_id);
CREATE INDEX idx_statements_card_id ON public.statements(card_id);
CREATE INDEX idx_statements_date ON public.statements(statement_date);
CREATE INDEX idx_statements_due_date ON public.statements(due_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.current_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for current_transactions
CREATE POLICY "Users can view own current transactions" ON public.current_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own current transactions" ON public.current_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own current transactions" ON public.current_transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own current transactions" ON public.current_transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for statement_transactions
CREATE POLICY "Users can view own statement transactions" ON public.statement_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statement transactions" ON public.statement_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statement transactions" ON public.statement_transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own statement transactions" ON public.statement_transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for statements
CREATE POLICY "Users can view own statements" ON public.statements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statements" ON public.statements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statements" ON public.statements
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own statements" ON public.statements
    FOR DELETE USING (auth.uid() = user_id);

-- Apply updated_at triggers to all transaction tables
CREATE TRIGGER current_transactions_updated_at
    BEFORE UPDATE ON public.current_transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER statement_transactions_updated_at
    BEFORE UPDATE ON public.statement_transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER statements_updated_at
    BEFORE UPDATE ON public.statements
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();