-- Migration 036: Hot-Path Performance Indexes for Sessions & Sharded Durable Auth Metrics
-- Idempotent, safe migration for PostgreSQL

-- 1. Optimized Partial Indexes for Active Sessions Lookup and Revocation
-- Accelerates validateSession and revokeAllUserSessions for active users
CREATE INDEX IF NOT EXISTS idx_sessions_user_role_active 
  ON public.sessions (user_id, role, revoked_at) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_idle_expires 
  ON public.sessions (idle_expires_at) 
  WHERE revoked_at IS NULL;

-- 2. Index for Background Session Cleanup Sweep
-- Accelerates cron /api/cron/cleanup-sessions batch deletions
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup_sweep 
  ON public.sessions (revoked_at, idle_expires_at, absolute_expires_at);

-- 3. Filtered Indexes for Account Status Checks
-- Accelerates validateSession account_status check and legacy fallback check
CREATE INDEX IF NOT EXISTS idx_customers_account_status 
  ON public.customers (account_status);

CREATE INDEX IF NOT EXISTS idx_service_providers_account_status 
  ON public.service_providers (account_status);

CREATE INDEX IF NOT EXISTS idx_job_providers_account_status 
  ON public.job_providers (account_status);

-- 4. Sharded Durable Telemetry Table for Auth Metrics & Legacy Fallbacks
-- Uses 16 shards (0-15) per day to completely eliminate single-row lock contention
CREATE TABLE IF NOT EXISTS public.auth_daily_metrics (
  metric_date DATE NOT NULL,
  shard_id SMALLINT NOT NULL DEFAULT 0,
  legacy_fallback_count BIGINT DEFAULT 0,
  db_unavailable_count BIGINT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, shard_id)
);

-- Rollback Note:
-- DROP INDEX IF EXISTS public.idx_sessions_user_role_active;
-- DROP INDEX IF EXISTS public.idx_sessions_idle_expires;
-- DROP INDEX IF EXISTS public.idx_sessions_cleanup_sweep;
-- DROP INDEX IF EXISTS public.idx_customers_account_status;
-- DROP INDEX IF EXISTS public.idx_service_providers_account_status;
-- DROP INDEX IF EXISTS public.idx_job_providers_account_status;
-- DROP TABLE IF EXISTS public.auth_daily_metrics;
