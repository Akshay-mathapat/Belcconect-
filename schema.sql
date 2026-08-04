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
  base_price NUMERIC(10, 2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  provider_id VARCHAR(100) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  customer_photo TEXT,
  date VARCHAR(50) NOT NULL,
  time VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  distance VARCHAR(50) DEFAULT '1.2 km',
  price NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'Requested', 'Accepted', 'OnTheWay', 'Started', 'Completed', 'Rejected', 'Cancelled', 'PaymentReceived', 'ReviewSubmitted'
  problem_description TEXT,
  internal_notes TEXT,
  before_images TEXT[], -- Array of strings (base64 or URL)
  after_images TEXT[],  -- Array of strings (base64 or URL)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
