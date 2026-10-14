-- Migration 028: Admin Approval System & Audit Logs
-- Creates admins table, audit logging table, and adds rejection_reason to service_providers

-- 1. Create admins table for back-office administrators
CREATE TABLE IF NOT EXISTS public.admins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email_lower ON public.admins (LOWER(email));

-- 2. Create audit logs table for administrator actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_id ON public.admin_audit_logs (target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs (admin_id, created_at DESC);

-- 3. Add rejection_reason column to service_providers
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

