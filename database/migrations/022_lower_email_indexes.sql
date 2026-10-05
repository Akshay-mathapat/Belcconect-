-- Migration 022: Hotpath lower(email) functional indexes for sub-millisecond login resolution
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_service_providers_email_lower ON service_providers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_job_providers_email_lower ON job_providers (LOWER(email));

