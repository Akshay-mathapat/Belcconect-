-- Migration 015: Provider Server-Backed Availability and Verification Tracking

ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) NOT NULL DEFAULT 'unverified';
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL;
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100) NULL;

-- Backfill verification_status from existing is_verified / kyc_status columns if present
UPDATE service_providers
SET verification_status = CASE
  WHEN is_verified = TRUE THEN 'verified'
  WHEN LOWER(COALESCE(kyc_status, '')) = 'pending' THEN 'pending'
  WHEN LOWER(COALESCE(kyc_status, '')) = 'rejected' THEN 'rejected'
  ELSE 'unverified'
END
WHERE verification_status IS NULL OR verification_status = 'unverified';

-- Create index for fast customer discovery queries
CREATE INDEX IF NOT EXISTS idx_service_providers_is_available ON service_providers(is_available);
CREATE INDEX IF NOT EXISTS idx_service_providers_verification_status ON service_providers(verification_status);
