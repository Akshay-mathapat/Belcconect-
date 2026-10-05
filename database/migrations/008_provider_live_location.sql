-- Migration 008: Add Live Location Tracking Columns to Bookings Table

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS provider_current_latitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS provider_current_longitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS provider_location_updated_at TIMESTAMPTZ;

-- Index for location updates lookup speed
CREATE INDEX IF NOT EXISTS idx_bookings_provider_location_updated_at ON bookings(provider_location_updated_at);
