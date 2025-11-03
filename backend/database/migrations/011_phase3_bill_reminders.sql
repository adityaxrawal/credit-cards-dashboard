-- Phase 3 Week 12: Bill Reminders Enhancement
-- Advanced bill tracking, recurring detection, calendar integration

-- Bill reminders tracking
CREATE TABLE IF NOT EXISTS bill_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'paid', 'overdue', 'cancelled'
  recurrence_pattern VARCHAR(50), -- null, 'monthly', 'biweekly', 'quarterly', 'annually'
  recurrence_day INTEGER, -- Day of month for monthly recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  auto_detected BOOLEAN DEFAULT FALSE, -- Detected from transaction patterns
  confidence_score DECIMAL(5,2), -- For auto-detected bills
  last_sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount DECIMAL(12,2),
  reminder_channels TEXT[] DEFAULT ARRAY['in_app', 'email'], -- Notification channels
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bill_reminders_user ON bill_reminders(user_id, status);
CREATE INDEX idx_bill_reminders_due_date ON bill_reminders(due_date) WHERE status != 'paid';
CREATE INDEX idx_bill_reminders_recurring ON bill_reminders(user_id, is_recurring);
CREATE INDEX idx_bill_reminders_auto_detected ON bill_reminders(user_id, auto_detected);

-- Bill payment history
CREATE TABLE IF NOT EXISTS bill_payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_reminder_id UUID NOT NULL REFERENCES bill_reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(100),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bill_payment_history_reminder ON bill_payment_history(bill_reminder_id);
CREATE INDEX idx_bill_payment_history_user ON bill_payment_history(user_id, payment_date);

-- Bill reminder delivery log
CREATE TABLE IF NOT EXISTS bill_reminder_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_reminder_id UUID NOT NULL REFERENCES bill_reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL, -- 'email', 'sms', 'push', 'in_app'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bill_reminder_delivery_reminder ON bill_reminder_delivery(bill_reminder_id);
CREATE INDEX idx_bill_reminder_delivery_status ON bill_reminder_delivery(status, sent_at);

-- Calendar events for bills (virtual calendar)
CREATE TABLE IF NOT EXISTS bill_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_reminder_id UUID REFERENCES bill_reminders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'due_date', 'reminder', 'payment_made', 'overdue'
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20), -- Color code for UI display
  icon VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bill_calendar_events_user ON bill_calendar_events(user_id, event_date);
CREATE INDEX idx_bill_calendar_events_reminder ON bill_calendar_events(bill_reminder_id);
CREATE INDEX idx_bill_calendar_events_date ON bill_calendar_events(event_date);

-- Recurring bill templates
CREATE TABLE IF NOT EXISTS recurring_bill_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  merchant VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  typical_amount DECIMAL(12,2),
  amount_variance DECIMAL(12,2), -- Expected variance in amount
  recurrence_pattern VARCHAR(50) NOT NULL,
  recurrence_day INTEGER, -- Day of month
  reminder_days_before INTEGER DEFAULT 3,
  auto_create_reminders BOOLEAN DEFAULT TRUE,
  last_generated_date TIMESTAMP WITH TIME ZONE,
  next_generation_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  confidence_score DECIMAL(5,2),
  detection_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recurring_bill_templates_user ON recurring_bill_templates(user_id, is_active);
CREATE INDEX idx_recurring_bill_templates_next_gen ON recurring_bill_templates(next_generation_date) WHERE is_active = TRUE;

-- Function to create calendar events when bill reminder is created/updated
CREATE OR REPLACE FUNCTION create_bill_calendar_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing events for this bill
  DELETE FROM bill_calendar_events WHERE bill_reminder_id = NEW.id;
  
  -- Create reminder event (3 days before due date by default)
  INSERT INTO bill_calendar_events (
    user_id,
    bill_reminder_id,
    event_type,
    event_date,
    title,
    description,
    color,
    icon
  ) VALUES (
    NEW.user_id,
    NEW.id,
    'reminder',
    NEW.reminder_date,
    NEW.title || ' - Reminder',
    NEW.description,
    '#FFD700',
    'bell'
  );
  
  -- Create due date event
  INSERT INTO bill_calendar_events (
    user_id,
    bill_reminder_id,
    event_type,
    event_date,
    title,
    description,
    color,
    icon
  ) VALUES (
    NEW.user_id,
    NEW.id,
    'due_date',
    NEW.due_date,
    NEW.title || ' - Due',
    NEW.description,
    '#FF4444',
    'calendar'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_bill_calendar_events
  AFTER INSERT OR UPDATE ON bill_reminders
  FOR EACH ROW
  WHEN (NEW.status != 'cancelled' AND NEW.status != 'paid')
  EXECUTE FUNCTION create_bill_calendar_events();

-- Function to mark bill as overdue
CREATE OR REPLACE FUNCTION check_overdue_bills()
RETURNS void AS $$
BEGIN
  -- Update bills that are past due date
  UPDATE bill_reminders
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < NOW()
    AND status != 'paid';
  
  -- Create overdue calendar events
  INSERT INTO bill_calendar_events (
    user_id,
    bill_reminder_id,
    event_type,
    event_date,
    title,
    description,
    color,
    icon
  )
  SELECT
    br.user_id,
    br.id,
    'overdue',
    NOW(),
    br.title || ' - OVERDUE',
    'This bill is now overdue',
    '#CC0000',
    'alert-circle'
  FROM bill_reminders br
  WHERE br.status = 'overdue'
    AND NOT EXISTS (
      SELECT 1 FROM bill_calendar_events
      WHERE bill_reminder_id = br.id
        AND event_type = 'overdue'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to generate recurring bills
CREATE OR REPLACE FUNCTION generate_recurring_bills()
RETURNS INTEGER AS $$
DECLARE
  template_record RECORD;
  generated_count INTEGER := 0;
  next_due_date TIMESTAMP WITH TIME ZONE;
  reminder_date TIMESTAMP WITH TIME ZONE;
BEGIN
  FOR template_record IN
    SELECT * FROM recurring_bill_templates
    WHERE is_active = TRUE
      AND (next_generation_date IS NULL OR next_generation_date <= NOW())
  LOOP
    -- Calculate next due date based on recurrence pattern
    CASE template_record.recurrence_pattern
      WHEN 'monthly' THEN
        next_due_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month' + 
                        (template_record.recurrence_day || ' days')::INTERVAL;
      WHEN 'quarterly' THEN
        next_due_date = DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months' + 
                        (template_record.recurrence_day || ' days')::INTERVAL;
      WHEN 'annually' THEN
        next_due_date = DATE_TRUNC('year', NOW()) + INTERVAL '1 year' + 
                        (template_record.recurrence_day || ' days')::INTERVAL;
      ELSE
        next_due_date = NOW() + INTERVAL '1 month';
    END CASE;
    
    -- Calculate reminder date
    reminder_date = next_due_date - (template_record.reminder_days_before || ' days')::INTERVAL;
    
    -- Create bill reminder
    INSERT INTO bill_reminders (
      user_id,
      card_id,
      title,
      description,
      amount,
      due_date,
      reminder_date,
      status,
      recurrence_pattern,
      recurrence_day,
      is_recurring,
      auto_detected,
      confidence_score
    ) VALUES (
      template_record.user_id,
      template_record.card_id,
      template_record.title,
      template_record.description,
      template_record.typical_amount,
      next_due_date,
      reminder_date,
      'pending',
      template_record.recurrence_pattern,
      template_record.recurrence_day,
      TRUE,
      TRUE,
      template_record.confidence_score
    );
    
    -- Update template
    UPDATE recurring_bill_templates
    SET 
      last_generated_date = NOW(),
      next_generation_date = next_due_date + INTERVAL '1 day',
      updated_at = NOW()
    WHERE id = template_record.id;
    
    generated_count := generated_count + 1;
  END LOOP;
  
  RETURN generated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to detect recurring bills from transaction history
CREATE OR REPLACE FUNCTION detect_recurring_bills(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  pattern_record RECORD;
  created_count INTEGER := 0;
BEGIN
  -- Find merchants with regular monthly transactions
  FOR pattern_record IN
    SELECT
      merchant,
      category,
      AVG(amount) as avg_amount,
      STDDEV(amount) as amount_stddev,
      COUNT(*) as transaction_count,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(DAY FROM date)) as typical_day
    FROM transactions
    WHERE user_id = p_user_id
      AND merchant IS NOT NULL
      AND date >= NOW() - INTERVAL '6 months'
    GROUP BY merchant, category
    HAVING COUNT(*) >= 4
      AND STDDEV(amount) < AVG(amount) * 0.2  -- Low variance indicates regular bill
  LOOP
    -- Create or update recurring bill template
    INSERT INTO recurring_bill_templates (
      user_id,
      merchant,
      title,
      typical_amount,
      amount_variance,
      recurrence_pattern,
      recurrence_day,
      confidence_score,
      detection_data
    ) VALUES (
      p_user_id,
      pattern_record.merchant,
      'Auto-detected: ' || pattern_record.merchant,
      pattern_record.avg_amount,
      pattern_record.amount_stddev,
      'monthly',
      pattern_record.typical_day::INTEGER,
      LEAST(100, (pattern_record.transaction_count * 10 + 50)::DECIMAL),
      jsonb_build_object(
        'transaction_count', pattern_record.transaction_count,
        'category', pattern_record.category,
        'detected_at', NOW()
      )
    )
    ON CONFLICT DO NOTHING;
    
    created_count := created_count + 1;
  END LOOP;
  
  RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE bill_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reminder_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bill_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY bill_reminders_policy ON bill_reminders FOR ALL USING (user_id = auth.uid());
CREATE POLICY bill_payment_history_policy ON bill_payment_history FOR ALL USING (user_id = auth.uid());
CREATE POLICY bill_reminder_delivery_policy ON bill_reminder_delivery FOR ALL USING (user_id = auth.uid());
CREATE POLICY bill_calendar_events_policy ON bill_calendar_events FOR ALL USING (user_id = auth.uid());
CREATE POLICY recurring_bill_templates_policy ON recurring_bill_templates FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON bill_reminders TO authenticated;
GRANT ALL ON bill_payment_history TO authenticated;
GRANT ALL ON bill_reminder_delivery TO authenticated;
GRANT ALL ON bill_calendar_events TO authenticated;
GRANT ALL ON recurring_bill_templates TO authenticated;

-- Comments
COMMENT ON TABLE bill_reminders IS 'Bill reminders with recurring support';
COMMENT ON TABLE bill_payment_history IS 'Payment history for bills';
COMMENT ON TABLE bill_reminder_delivery IS 'Delivery tracking for bill reminders';
COMMENT ON TABLE bill_calendar_events IS 'Calendar view events for bills';
COMMENT ON TABLE recurring_bill_templates IS 'Templates for auto-generating recurring bills';
COMMENT ON FUNCTION check_overdue_bills() IS 'Cron job to mark bills as overdue';
COMMENT ON FUNCTION generate_recurring_bills() IS 'Cron job to create bills from recurring templates';
COMMENT ON FUNCTION detect_recurring_bills(UUID) IS 'ML-based detection of recurring bills from transactions';
