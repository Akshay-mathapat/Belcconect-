-- Migration 035: Server-Side Opaque Sessions, Socket Tickets & Account Status
-- Idempotent, safe migration for PostgreSQL

-- 1. Add account_status column to user tables (active | suspended)
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'active';

ALTER TABLE public.service_providers 
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'active';

ALTER TABLE public.job_providers 
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'active';

-- Add check constraints to enforce allowed statuses if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_customers_account_status'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT chk_customers_account_status 
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_providers_account_status'
  ) THEN
    ALTER TABLE public.service_providers ADD CONSTRAINT chk_service_providers_account_status 
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_providers_account_status'
  ) THEN
    ALTER TABLE public.job_providers ADD CONSTRAINT chk_job_providers_account_status 
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
END $$;

-- 2. Server-side Sessions Table
-- Stores SHA-256 token hashes (NEVER raw tokens)
-- user_id is VARCHAR(255) to be fully compatible with admins (VARCHAR(255)) and customers/providers (VARCHAR)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    idle_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip VARCHAR(45),
    user_agent TEXT,
    device_label TEXT,
    client VARCHAR(16) DEFAULT 'web' NOT NULL
);

-- Indexes for rapid lookup, user session invalidation, and background cleanup
-- Note: token_hash already has an implicit unique B-tree index from the UNIQUE constraint
CREATE INDEX IF NOT EXISTS idx_sessions_user_lookup ON public.sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup ON public.sessions (revoked_at, idle_expires_at, absolute_expires_at);

-- 3. Socket Tickets Table
-- One-time, single-use ticket for WebRTC / Socket.IO signaling authentication (60s TTL)
-- Uses ticket_hash (SHA-256) so raw tickets are never stored in the database
CREATE TABLE IF NOT EXISTS public.socket_tickets (
    ticket_hash VARCHAR(64) PRIMARY KEY,
    session_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_socket_tickets_expires ON public.socket_tickets (expires_at);
CREATE INDEX IF NOT EXISTS idx_socket_tickets_session ON public.socket_tickets (session_id);

-- Rollback Note:
-- To rollback migration 035:
-- DROP TABLE IF EXISTS public.socket_tickets CASCADE;
-- DROP TABLE IF EXISTS public.sessions CASCADE;
-- ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS chk_customers_account_status;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS account_status;
-- ALTER TABLE public.service_providers DROP CONSTRAINT IF EXISTS chk_service_providers_account_status;
-- ALTER TABLE public.service_providers DROP COLUMN IF EXISTS account_status;
-- ALTER TABLE public.job_providers DROP CONSTRAINT IF EXISTS chk_job_providers_account_status;
-- ALTER TABLE public.job_providers DROP COLUMN IF EXISTS account_status;
