-- Migration 016: Phase 3 Trust, Safety, Two-Sided Reviews, Cancellation Metadata, and Feedback/Support

-- 1. Cancellation Metadata Columns on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(100) NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_note TEXT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100) NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL;

-- 2. Two-Sided Booking Reviews Table
-- Supports: Customer -> Provider and Provider -> Customer
-- Supports only valid opposite review directions: Customer -> Provider or Provider -> Customer
CREATE TABLE IF NOT EXISTS booking_reviews (
  id VARCHAR(100) PRIMARY KEY,
  booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id VARCHAR(100) NOT NULL,
  reviewer_role VARCHAR(50) NOT NULL, -- 'customer' or 'provider'
  reviewer_role VARCHAR(50) NOT NULL,
  reviewee_id VARCHAR(100) NOT NULL,
  reviewee_role VARCHAR(50) NOT NULL, -- 'provider' or 'customer'
  reviewee_role VARCHAR(50) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_booking_reviews_direction UNIQUE (booking_id, reviewer_id, reviewee_id)
  CONSTRAINT uq_booking_reviews_direction UNIQUE (booking_id, reviewer_id, reviewee_id),
  CONSTRAINT chk_booking_reviews_roles CHECK (
    reviewer_role IN ('customer', 'provider') AND
    reviewee_role IN ('customer', 'provider')
  ),
  CONSTRAINT chk_booking_reviews_opposite_direction CHECK (
    (reviewer_role = 'customer' AND reviewee_role = 'provider') OR
    (reviewer_role = 'provider' AND reviewee_role = 'customer')
  )
);

-- 3. Booking Reports Table (Private Safety Flagging)
CREATE TABLE IF NOT EXISTS booking_reports (
  id VARCHAR(100) PRIMARY KEY,
  booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reporter_id VARCHAR(100) NOT NULL,
  reported_user_id VARCHAR(100) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Blocks Table (Foundation)
CREATE TABLE IF NOT EXISTS user_blocks (
  id VARCHAR(100) PRIMARY KEY,
  blocker_id VARCHAR(100) NOT NULL,
  blocked_user_id VARCHAR(100) NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_blocks UNIQUE (blocker_id, blocked_user_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_user_id)
);

-- 5. App Feedback Table
CREATE TABLE IF NOT EXISTS app_feedback (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Support Requests Table
CREATE TABLE IF NOT EXISTS support_requests (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_booking_reviews_booking_id ON booking_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_reviewee_id ON booking_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_reviewer_id ON booking_reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_booking_reports_booking_id ON booking_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reports_reporter_id ON booking_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_booking_reports_status ON booking_reports(status);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);

CREATE INDEX IF NOT EXISTS idx_app_feedback_user_id ON app_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
