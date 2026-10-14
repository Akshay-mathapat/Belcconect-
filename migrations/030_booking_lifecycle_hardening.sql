-- Migration 030: Booking Lifecycle Hardening
-- Adds lifecycle timestamp columns, no-show tracking, provider no-show penalty counts, and indexes.

-- 1. Add lifecycle timestamps & no-show columns to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_type CHARACTER VARYING(50);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_reported_by CHARACTER VARYING;

-- 2. Add no_show_count to service_providers table for tracking provider reliability
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0 NOT NULL;

-- 3. Add performance indexes for auto-expiry scans and lifecycle lookups
CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at ON public.bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_accepted_at ON public.bookings(provider_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_arrived_at ON public.bookings(arrived_at);
CREATE INDEX IF NOT EXISTS idx_bookings_no_show ON public.bookings(no_show_type, no_show_at);

