-- Migration 027: KYC Privacy and Last-4 Digit Compliance
-- Removes full storage of sensitive Indian government identity numbers (Aadhaar & PAN).
-- Idempotent and safe to run on test database.

-- 1. Add last4 columns to service_providers
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4);
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS pan_last4 VARCHAR(4);
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS kyc_document_last4 VARCHAR(4);

-- Ensure legacy source columns exist for safe backfill/migration
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS kyc_document_number TEXT;

-- 2. Backfill last4 columns from existing records before clearing full numbers
UPDATE public.service_providers
SET aadhaar_last4 = RIGHT(REGEXP_REPLACE(aadhaar_number, '[^0-9]', '', 'g'), 4)
WHERE aadhaar_number IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(aadhaar_number, '[^0-9]', '', 'g')) >= 4
  AND aadhaar_last4 IS NULL;

UPDATE public.service_providers
SET pan_last4 = UPPER(RIGHT(REGEXP_REPLACE(pan_number, '[^A-Za-z0-9]', '', 'g'), 4))
WHERE pan_number IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(pan_number, '[^A-Za-z0-9]', '', 'g')) >= 4
  AND pan_last4 IS NULL;

UPDATE public.service_providers
SET kyc_document_last4 = UPPER(RIGHT(REGEXP_REPLACE(kyc_document_number, '[^A-Za-z0-9]', '', 'g'), 4))
WHERE kyc_document_number IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(kyc_document_number, '[^A-Za-z0-9]', '', 'g')) >= 4
  AND kyc_document_last4 IS NULL;

-- 3. Clear raw full identity numbers to satisfy privacy and compliance rules
UPDATE public.service_providers
SET 
  aadhaar_number = NULL,
  pan_number = NULL,
  kyc_document_number = NULL
WHERE aadhaar_number IS NOT NULL
   OR pan_number IS NOT NULL
   OR kyc_document_number IS NOT NULL;

-- 4. Clean up any raw base64 data blobs from kyc_document_photo (relational DB hygiene)
UPDATE public.service_providers
SET kyc_document_photo = NULL
WHERE kyc_document_photo LIKE 'data:%';

-- 5. Add index on verification status and provider ID for admin search/filter
CREATE INDEX IF NOT EXISTS idx_service_providers_verification ON public.service_providers (verification_status, created_at DESC);

