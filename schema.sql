-- PostgreSQL Database Schema for CityConnect Booking System

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL, -- 'user', 'provider', 'job_provider'
  avatar TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'Home', 'Office', 'Other'
  text TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  place_id TEXT,
  location_accuracy NUMERIC,
  house_number TEXT,
  building_name TEXT,
  floor TEXT,
  landmark TEXT,
  locality TEXT,
  city TEXT,
  state TEXT,
  pincode VARCHAR(10),
  delivery_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Services Table
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  provider_id VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255),
  service_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  date VARCHAR(50) NOT NULL,
  time VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'Requested', 'Accepted', 'OnTheWay', 'Started', 'Completed', 'Rejected', 'Cancelled', 'PaymentReceived', 'ReviewSubmitted'
  rating INTEGER,
  review_comment TEXT,
  service_address_id VARCHAR(100),
  destination_latitude NUMERIC(10,7),
  destination_longitude NUMERIC(10,7),
  destination_place_id TEXT,
  destination_address TEXT,
  destination_landmark TEXT,
  destination_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
