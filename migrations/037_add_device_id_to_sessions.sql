-- Migration 037: Add device_id to Sessions Table & Hot-Path Index
-- Idempotent, safe migration for PostgreSQL

-- 1. Add device_id column to public.sessions
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);

-- 2. Partial index on active Android device sessions
-- Accelerates device-scoped session lookup, resume validation, and per-device rotation
CREATE INDEX IF NOT EXISTS idx_sessions_user_device_active 
  ON public.sessions (user_id, device_id) 
  WHERE revoked_at IS NULL AND client = 'android';

-- Rollback Note:
-- DROP INDEX IF EXISTS public.idx_sessions_user_device_active;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS device_id;

