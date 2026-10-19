-- Migration 033: Account Deletion Admin Review Columns
-- Adds rejection_reason and processed_by for administrator audit & moderation

ALTER TABLE public.account_deletion_requests 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

ALTER TABLE public.account_deletion_requests 
ADD COLUMN IF NOT EXISTS processed_by VARCHAR(255) NULL;

