-- Migration 034: Complete Provider eKYC Verification System
-- Idempotent, safe migration for PostgreSQL

-- 0. Ensure service_providers has updated_at column
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 1. Main KYC Application Table
CREATE TABLE IF NOT EXISTS public.provider_kyc (
    id VARCHAR(64) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', 
    current_step INT NOT NULL DEFAULT 1,
    rejection_reason TEXT,
    action_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_provider_kyc_provider UNIQUE (provider_id)
);

-- 2. Document Details Table (Last-4 masked, never full numbers)
CREATE TABLE IF NOT EXISTS public.provider_kyc_documents (
    id VARCHAR(64) PRIMARY KEY,
    kyc_id VARCHAR(64) NOT NULL REFERENCES public.provider_kyc(id) ON DELETE CASCADE,
    document_type VARCHAR(32) NOT NULL,
    document_last4 VARCHAR(4) NOT NULL,
    document_photo_url TEXT NOT NULL,
    document_back_photo_url TEXT,
    extracted_name TEXT,
    is_valid_format BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Live Selfie & Liveness Verification Table
CREATE TABLE IF NOT EXISTS public.provider_kyc_selfies (
    id VARCHAR(64) PRIMARY KEY,
    kyc_id VARCHAR(64) NOT NULL REFERENCES public.provider_kyc(id) ON DELETE CASCADE,
    selfie_url TEXT NOT NULL,
    liveness_score NUMERIC(5,2) DEFAULT 98.50,
    face_match_score NUMERIC(5,2),
    capture_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. DPDP Statutory Consent Table
CREATE TABLE IF NOT EXISTS public.provider_kyc_consents (
    id VARCHAR(64) PRIMARY KEY,
    kyc_id VARCHAR(64) NOT NULL REFERENCES public.provider_kyc(id) ON DELETE CASCADE,
    consent_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    consent_text TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    consented_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Decisions & History Table
CREATE TABLE IF NOT EXISTS public.provider_kyc_reviews (
    id VARCHAR(64) PRIMARY KEY,
    kyc_id VARCHAR(64) NOT NULL REFERENCES public.provider_kyc(id) ON DELETE CASCADE,
    admin_id VARCHAR(64) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rapid retrieval
CREATE INDEX IF NOT EXISTS idx_provider_kyc_status ON public.provider_kyc(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_kyc_provider_id ON public.provider_kyc(provider_id);

