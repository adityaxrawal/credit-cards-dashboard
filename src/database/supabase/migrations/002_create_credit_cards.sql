-- Create credit_cards table
CREATE TABLE public.credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    card_last_4 TEXT NOT NULL,
    card_holder_name TEXT NOT NULL,
    card_type TEXT NOT NULL,
    statement_day INTEGER CHECK (statement_day >= 1 AND statement_day <= 31),
    sender_pattern TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on (user_id, card_last_4)
ALTER TABLE public.credit_cards 
ADD CONSTRAINT unique_user_card_last_4 UNIQUE (user_id, card_last_4);

-- Create indexes for better performance
CREATE INDEX idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX idx_credit_cards_card_last_4 ON public.credit_cards(card_last_4);

-- Enable Row Level Security (RLS)
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_cards
CREATE POLICY "Users can view own cards" ON public.credit_cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON public.credit_cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON public.credit_cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards" ON public.credit_cards
    FOR DELETE USING (auth.uid() = user_id);

-- Apply updated_at trigger to credit_cards table
CREATE TRIGGER credit_cards_updated_at
    BEFORE UPDATE ON public.credit_cards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();