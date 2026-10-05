ALTER TABLE google_oauth_transactions
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(32);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_oauth_transactions' AND column_name = 'role'
  ) THEN
    UPDATE google_oauth_transactions
    SET account_type = CASE role
      WHEN 'user' THEN 'customer'
      WHEN 'provider' THEN 'service_provider'
      WHEN 'job_provider' THEN 'job_provider'
      ELSE NULL
    END
    WHERE account_type IS NULL;
  END IF;
END $$;

UPDATE google_oauth_transactions SET account_type = 'customer' WHERE account_type IS NULL;

ALTER TABLE google_oauth_transactions
  DROP COLUMN IF EXISTS role,
  ALTER COLUMN account_type SET NOT NULL,
  ADD CONSTRAINT google_oauth_transactions_account_type_check
    CHECK (account_type IN ('customer', 'service_provider', 'job_provider'));