-- Migration 031: Drop Legacy Plaintext KYC Columns
-- Follow-up to Migration 027 (which migrated data to last-4 columns and nulled plaintext values).
-- This migration permanently drops legacy plaintext KYC columns to guarantee zero retention of raw identity numbers.
-- NOTE: Written per review batch R1 task 8. DO NOT EXECUTE until production cutover sign-off.

ALTER TABLE public.service_providers 
    DROP COLUMN IF EXISTS aadhaar_number,
    DROP COLUMN IF EXISTS pan_number,
    DROP COLUMN IF EXISTS kyc_document_number;

