-- Migration 009: Add Customer Live Location & Accuracy Tracking Columns to Bookings Table

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS customer_current_latitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS customer_current_longitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS customer_location_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_location_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS provider_location_accuracy NUMERIC;

CREATE INDEX IF NOT EXISTS idx_bookings_customer_location_updated_at ON bookings(customer_location_updated_at);
