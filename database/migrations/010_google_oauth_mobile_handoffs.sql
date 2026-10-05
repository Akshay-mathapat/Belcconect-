-- Server-side OAuth transaction and native handoff records.
CREATE TABLE IF NOT EXISTS google_oauth_transactions (
  state_hash TEXT PRIMARY KEY,
  code_challenge TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_transactions_expiry
  ON google_oauth_transactions(expires_at);

CREATE TABLE IF NOT EXISTS google_mobile_handoffs (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_google_mobile_handoffs_expiry
  ON google_mobile_handoffs(expires_at);
