-- Create card_perks table
CREATE TABLE public.card_perks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    perk_type TEXT NOT NULL,
    perk_description TEXT NOT NULL,
    perk_value TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spending_limits table
CREATE TABLE public.spending_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    category TEXT,
    limit_amount DECIMAL(12,2) NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
    current_spent DECIMAL(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gmail_tokens table
CREATE TABLE public.gmail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processing_queue table
CREATE TABLE public.processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_card_perks_user_id ON public.card_perks(user_id);
CREATE INDEX idx_card_perks_card_id ON public.card_perks(card_id);
CREATE INDEX idx_card_perks_active ON public.card_perks(is_active);

CREATE INDEX idx_spending_limits_user_id ON public.spending_limits(user_id);
CREATE INDEX idx_spending_limits_card_id ON public.spending_limits(card_id);
CREATE INDEX idx_spending_limits_category ON public.spending_limits(category);
CREATE INDEX idx_spending_limits_active ON public.spending_limits(is_active);

CREATE INDEX idx_gmail_tokens_user_id ON public.gmail_tokens(user_id);
CREATE INDEX idx_gmail_tokens_active ON public.gmail_tokens(is_active);
CREATE INDEX idx_gmail_tokens_expires_at ON public.gmail_tokens(expires_at);

CREATE INDEX idx_processing_queue_user_id ON public.processing_queue(user_id);
CREATE INDEX idx_processing_queue_status ON public.processing_queue(status);
CREATE INDEX idx_processing_queue_created_at ON public.processing_queue(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.card_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for card_perks
CREATE POLICY "Users can view own card perks" ON public.card_perks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own card perks" ON public.card_perks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own card perks" ON public.card_perks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own card perks" ON public.card_perks
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for spending_limits
CREATE POLICY "Users can view own spending limits" ON public.spending_limits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spending limits" ON public.spending_limits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spending limits" ON public.spending_limits
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spending limits" ON public.spending_limits
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for gmail_tokens
CREATE POLICY "Users can view own gmail tokens" ON public.gmail_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail tokens" ON public.gmail_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail tokens" ON public.gmail_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail tokens" ON public.gmail_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for processing_queue
CREATE POLICY "Users can view own processing queue" ON public.processing_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing queue" ON public.processing_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processing queue" ON public.processing_queue
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own processing queue" ON public.processing_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Apply updated_at triggers to all supporting tables
CREATE TRIGGER card_perks_updated_at
    BEFORE UPDATE ON public.card_perks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER spending_limits_updated_at
    BEFORE UPDATE ON public.spending_limits
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER gmail_tokens_updated_at
    BEFORE UPDATE ON public.gmail_tokens
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER processing_queue_updated_at
    BEFORE UPDATE ON public.processing_queue
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();