CREATE TABLE IF NOT EXISTS notification_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  provider_message_id VARCHAR(255),
  error_message TEXT,
  attempt_count INTEGER DEFAULT 1,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_booking_type ON notification_logs(booking_id, type, channel);
CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
