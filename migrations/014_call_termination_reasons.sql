-- Migration 014: Call Termination Reasons and Ended By Tracking

ALTER TABLE calls ADD COLUMN IF NOT EXISTS end_reason VARCHAR(50);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_by_user_id VARCHAR(255);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_by_role VARCHAR(50);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calls_end_reason ON calls(end_reason);
CREATE INDEX IF NOT EXISTS idx_calls_ended_by_user_id ON calls(ended_by_user_id);

