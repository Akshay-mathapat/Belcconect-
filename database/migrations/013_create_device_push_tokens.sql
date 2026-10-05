-- Migration 013: Device Push Tokens for Native Android FCM Push Notifications

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(50) DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_push_tokens(user_id);

