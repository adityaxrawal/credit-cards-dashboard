-- Phase 6: Feedback Collection System
-- Migration: 015_feedback_system.sql

-- User Feedback Table
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'improvement', 'general', 'complaint')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    page_url VARCHAR(500),
    browser_info JSONB DEFAULT '{}'::jsonb,
    screenshot_url TEXT,
    status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'planned', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
    admin_notes TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_feedback_status ON user_feedback(status);
CREATE INDEX idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_feedback_priority ON user_feedback(priority);
CREATE INDEX idx_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_upvotes ON user_feedback(upvotes DESC);

-- Feedback Upvotes (to track who upvoted what)
CREATE TABLE IF NOT EXISTS feedback_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID REFERENCES user_feedback(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(feedback_id, user_id)
);

CREATE INDEX idx_feedback_upvotes_feedback ON feedback_upvotes(feedback_id);
CREATE INDEX idx_feedback_upvotes_user ON feedback_upvotes(user_id);

-- Feedback Comments (for admin responses)
CREATE TABLE IF NOT EXISTS feedback_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID REFERENCES user_feedback(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_admin_response BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feedback_comments_feedback ON feedback_comments(feedback_id);
CREATE INDEX idx_feedback_comments_created_at ON feedback_comments(created_at DESC);

-- Feedback Categories (for better organization)
CREATE TABLE IF NOT EXISTS feedback_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP DEFAULT NOW()
);

-- Feedback Category Mapping
CREATE TABLE IF NOT EXISTS feedback_category_mapping (
    feedback_id UUID REFERENCES user_feedback(id) ON DELETE CASCADE,
    category_id UUID REFERENCES feedback_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (feedback_id, category_id)
);

-- Feature Requests (specialized feedback type)
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    use_case TEXT,
    expected_behavior TEXT,
    alternatives_considered TEXT,
    status VARCHAR(30) DEFAULT 'under_review' CHECK (status IN ('under_review', 'planned', 'in_development', 'shipped', 'declined')),
    priority_score INTEGER DEFAULT 0,
    estimated_effort VARCHAR(20) CHECK (estimated_effort IN ('low', 'medium', 'high', 'very_high')),
    target_release VARCHAR(50),
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feature_requests_user_id ON feature_requests(user_id);
CREATE INDEX idx_feature_requests_status ON feature_requests(status);
CREATE INDEX idx_feature_requests_priority ON feature_requests(priority_score DESC);
CREATE INDEX idx_feature_requests_upvotes ON feature_requests(upvotes DESC);

-- NPS Surveys (Net Promoter Score)
CREATE TABLE IF NOT EXISTS nps_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    feedback TEXT,
    follow_up_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nps_surveys_user_id ON nps_surveys(user_id);
CREATE INDEX idx_nps_surveys_score ON nps_surveys(score);
CREATE INDEX idx_nps_surveys_created_at ON nps_surveys(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_user_feedback_updated_at 
BEFORE UPDATE ON user_feedback 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at 
BEFORE UPDATE ON feature_requests 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Function to update upvote count
CREATE OR REPLACE FUNCTION update_feedback_upvotes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE user_feedback 
        SET upvotes = upvotes + 1 
        WHERE id = NEW.feedback_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE user_feedback 
        SET upvotes = upvotes - 1 
        WHERE id = OLD.feedback_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feedback_upvotes
AFTER INSERT OR DELETE ON feedback_upvotes
FOR EACH ROW
EXECUTE FUNCTION update_feedback_upvotes();

-- Insert default feedback categories
INSERT INTO feedback_categories (name, description, color) VALUES
('UI/UX', 'User interface and experience improvements', '#3B82F6'),
('Performance', 'Performance and speed related issues', '#10B981'),
('Security', 'Security concerns and improvements', '#EF4444'),
('API', 'Backend API related feedback', '#8B5CF6'),
('Analytics', 'Analytics and reporting features', '#F59E0B'),
('Mobile', 'Mobile experience improvements', '#EC4899')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE user_feedback IS 'General user feedback and bug reports';
COMMENT ON TABLE feature_requests IS 'Detailed feature requests with use cases';
COMMENT ON TABLE nps_surveys IS 'Net Promoter Score survey responses';
COMMENT ON TABLE feedback_upvotes IS 'Tracks user upvotes on feedback items';
COMMENT ON TABLE feedback_comments IS 'Comments and admin responses on feedback';
