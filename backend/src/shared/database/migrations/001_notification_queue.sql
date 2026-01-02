-- Create notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    retry_count INTEGER DEFAULT 0
);

-- Create index for polling
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_user ON notification_queue(status, user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(created_at);
