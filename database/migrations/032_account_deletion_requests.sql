-- Migration 032: Account Deletion Requests & Legal Audit Log
-- Tracks account deletion requests for Play Store and DPDP/GDPR compliance

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    role VARCHAR(32) NOT NULL, -- 'customer', 'service_provider', 'job_provider'
    email VARCHAR(255) NULL,
    phone VARCHAR(32) NULL,
    reason TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'completed', -- 'completed', 'pending', 'rejected'
    requested_via VARCHAR(32) NOT NULL DEFAULT 'in_app', -- 'in_app', 'web_portal'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_phone ON public.account_deletion_requests(phone);
CREATE INDEX IF NOT EXISTS idx_account_deletion_created ON public.account_deletion_requests(created_at DESC);

