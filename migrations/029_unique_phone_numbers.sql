-- Migration 029: Unique Phone Numbers & Safe Duplicate Resolution
-- Cleans dummy placeholders, resolves duplicate numbers keeping the earliest account, and adds partial unique indexes

-- 1. Clear placeholder/dummy phones from all tables
UPDATE public.customers
SET phone = NULL
WHERE phone IN ('+91 98765 00000', '+919876500000', '9876500000', '+91 98765 43210', '');

UPDATE public.service_providers
SET phone = NULL
WHERE phone IN ('+91 98765 00000', '+919876500000', '9876500000', '');

UPDATE public.job_providers
SET phone = NULL
WHERE phone IN ('+91 98765 00000', '+919876500000', '9876500000', '');

-- 2. Safely resolve existing duplicates by keeping the earliest registered account
WITH ranked_customers AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC NULLS LAST, id ASC) as rn
  FROM public.customers
  WHERE phone IS NOT NULL AND phone != ''
)
UPDATE public.customers
SET phone = NULL
WHERE id IN (SELECT id FROM ranked_customers WHERE rn > 1);

WITH ranked_providers AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC NULLS LAST, id ASC) as rn
  FROM public.service_providers
  WHERE phone IS NOT NULL AND phone != ''
)
UPDATE public.service_providers
SET phone = NULL
WHERE id IN (SELECT id FROM ranked_providers WHERE rn > 1);

WITH ranked_job_providers AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC NULLS LAST, id ASC) as rn
  FROM public.job_providers
  WHERE phone IS NOT NULL AND phone != ''
)
UPDATE public.job_providers
SET phone = NULL
WHERE id IN (SELECT id FROM ranked_job_providers WHERE rn > 1);

-- 3. Create partial unique indexes (where phone IS NOT NULL AND phone != '')
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
ON public.customers (phone)
WHERE phone IS NOT NULL AND phone != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_providers_phone_unique
ON public.service_providers (phone)
WHERE phone IS NOT NULL AND phone != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_providers_phone_unique
ON public.job_providers (phone)
WHERE phone IS NOT NULL AND phone != '';

