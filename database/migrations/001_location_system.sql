-- Migration 001: Customer Location & Provider Navigation System

-- 1. Extend addresses table with GPS coordinates and structured address fields
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS house_number TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS floor TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS locality TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_addresses_lat_lng ON addresses(latitude, longitude);

-- 2. Extend bookings table to snapshot location information for assigned provider navigation
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_address_id VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_latitude NUMERIC(10,7);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_longitude NUMERIC(10,7);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_place_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_landmark TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_dest_lat_lng ON bookings(destination_latitude, destination_longitude);
