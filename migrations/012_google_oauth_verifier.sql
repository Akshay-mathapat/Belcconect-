ALTER TABLE google_oauth_transactions
  ADD COLUMN IF NOT EXISTS code_verifier TEXT;