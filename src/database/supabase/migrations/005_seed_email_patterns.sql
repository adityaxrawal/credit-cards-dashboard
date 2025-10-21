-- Create email_patterns table
CREATE TABLE public.email_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject_pattern TEXT,
    amount_regex TEXT NOT NULL,
    description_regex TEXT,
    date_regex TEXT,
    merchant_regex TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_email_patterns_bank_name ON public.email_patterns(bank_name);
CREATE INDEX idx_email_patterns_sender_email ON public.email_patterns(sender_email);
CREATE INDEX idx_email_patterns_active ON public.email_patterns(is_active);

-- Apply updated_at trigger to email_patterns table
CREATE TRIGGER email_patterns_updated_at
    BEFORE UPDATE ON public.email_patterns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert seed data for common Indian banks
INSERT INTO public.email_patterns (bank_name, sender_email, subject_pattern, amount_regex, description_regex, date_regex, merchant_regex) VALUES
-- HDFC Bank
('HDFC Bank', 'alerts@hdfcbank.net', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('HDFC Bank', 'creditcards@hdfcbank.net', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- ICICI Bank
('ICICI Bank', 'credit-cards@icicibank.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('ICICI Bank', 'donotreply@icicibank.com', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- SBI Bank
('SBI', 'sbicard.care@sbicard.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('SBI', 'alerts@sbi.co.in', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- Axis Bank
('Axis Bank', 'alerts@axisbank.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('Axis Bank', 'creditcard@axisbank.com', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- Kotak Mahindra Bank
('Kotak Mahindra Bank', 'creditcard@kotak.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('Kotak Mahindra Bank', 'alerts@kotak.com', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- IndusInd Bank
('IndusInd Bank', 'creditcard@indusind.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('IndusInd Bank', 'alerts@indusind.com', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- Yes Bank
('Yes Bank', 'creditcard@yesbank.in', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('Yes Bank', 'alerts@yesbank.in', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- Standard Chartered Bank
('Standard Chartered', 'creditcard@sc.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('Standard Chartered', 'alerts@standardchartered.co.in', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- Citibank
('Citibank', 'creditcard@citibank.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('Citibank', 'alerts@citibank.co.in', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),

-- American Express
('American Express', 'customercare-cards@aexp.com', '%transaction%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)'),
('American Express', 'alerts@americanexpress.co.in', '%spent%', 'Rs\.?\s*([0-9,]+\.?[0-9]*)', 'at\s+([^.]+)', '(\d{2}-\d{2}-\d{4})', 'at\s+([^.]+)');

-- Note: This table is not user-specific and doesn't need RLS policies
-- It contains global email patterns that all users can reference