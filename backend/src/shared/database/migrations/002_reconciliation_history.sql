CREATE TABLE IF NOT EXISTS reconciliation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_balance DECIMAL(15, 2) NOT NULL,
  calculated_balance DECIMAL(15, 2) NOT NULL,
  difference DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('matched', 'partial_match', 'mismatch', 'reviewed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_reconciliation_per_statement UNIQUE (instrument_id, statement_date)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_user ON reconciliation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_instrument ON reconciliation_history(instrument_id);
