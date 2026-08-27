import { Pool } from "pg";
import crypto from "crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Akshay_a015@127.0.0.1:5432/cityconnect";


declare global {
  var postgresPool: Pool | undefined;
}

const pool =
  globalThis.postgresPool ||
  new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresPool = pool;
}

let dbInitialized = false;
let initPromise: Promise<void> | null = null;

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function initDB() {
  if (dbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // 1. Create Customers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          avatar TEXT,
          password_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Create Service Providers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_providers (
          id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          avatar TEXT,
          password_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migration columns for KYC verification documents
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS kyc_document_type VARCHAR(100)`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS kyc_document_number VARCHAR(100)`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS kyc_document_photo TEXT`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'Unverified'`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS pan_number VARCHAR(100)`);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(100)`);

      // 3. Create Job Providers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS job_providers (
          id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          avatar TEXT,
          password_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 4. Create Addresses table (references customers)
      await client.query(`
        CREATE TABLE IF NOT EXISTS addresses (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) REFERENCES customers(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 5. Create Services table (references service_providers)
      await client.query(`
        CREATE TABLE IF NOT EXISTS services (
          id VARCHAR(100) PRIMARY KEY,
          provider_id VARCHAR(100) REFERENCES service_providers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          subcategory VARCHAR(100),
          description TEXT,
          is_available BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 6. Create Bookings table (references customers and service_providers)
      await client.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(100) PRIMARY KEY,
          customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE SET NULL,
          provider_id VARCHAR(100) REFERENCES service_providers(id) ON DELETE SET NULL,
          provider_name VARCHAR(255),
          service_name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          date VARCHAR(50) NOT NULL,
          time VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          rating INTEGER
        )
      `);

      await client.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating INTEGER
      `);

      await client.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_comment TEXT
      `);

      await client.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);

      // Location system migration columns for addresses
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS place_id TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS house_number TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS building_name TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS floor TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS landmark TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS locality TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS city TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS state TEXT`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)`);
      await client.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS delivery_instructions TEXT`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_addresses_lat_lng ON addresses(latitude, longitude)`);

      // Location system snapshot columns for bookings
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_address_id VARCHAR(100)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_latitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_longitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_place_id TEXT`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_address TEXT`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_landmark TEXT`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination_instructions TEXT`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_dest_lat_lng ON bookings(destination_latitude, destination_longitude)`);

      await client.query(`
        ALTER TABLE services DROP COLUMN IF EXISTS base_price
      `);

      // 7. Create Calls table
      await client.query(`
        CREATE TABLE IF NOT EXISTS calls (
          id VARCHAR(100) PRIMARY KEY,
          caller_id VARCHAR(100) NOT NULL,
          receiver_id VARCHAR(100) NOT NULL,
          booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          answered_at TIMESTAMP,
          ended_at TIMESTAMP,
          duration_seconds INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_receiver ON calls(receiver_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_booking ON calls(booking_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)
      `);

      // 8. Create Call Reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS call_reports (
          id VARCHAR(100) PRIMARY KEY,
          call_id VARCHAR(100) REFERENCES calls(id) ON DELETE CASCADE,
          reporter_id VARCHAR(100) NOT NULL,
          reason TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 9. Create Conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(100) PRIMARY KEY,
          customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE CASCADE,
          provider_id VARCHAR(100) REFERENCES service_providers(id) ON DELETE CASCADE,
          booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(provider_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_booking ON conversations(booking_id)`);

      // 10. Create Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(100) PRIMARY KEY,
          conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id VARCHAR(100) NOT NULL,
          sender_role VARCHAR(50) NOT NULL,
          body TEXT,
          media_url TEXT,
          location_url TEXT,
          latitude NUMERIC(10,7),
          longitude NUMERIC(10,7),
          message_type VARCHAR(50) DEFAULT 'text',
          is_deleted_from_ui BOOLEAN DEFAULT FALSE,
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);

      // 11. Create Push Subscriptions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_push_sub_user_id ON push_subscriptions(user_id);
      `);

      // 12. Create Notifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          booking_id VARCHAR(255),
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      `);

      // 13. Create Notification Logs table for SMS & Push idempotency tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          booking_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          channel VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          provider_message_id VARCHAR(255),
          error_message TEXT,
          attempt_count INTEGER DEFAULT 1,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notif_logs_booking_type ON notification_logs(booking_id, type, channel);
        CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON notification_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
      `);

      // Auto-expire lingering call sessions on server/DB initialization
      await client.query(`
        UPDATE calls 
        SET status = 'ENDED', ended_at = NOW() 
        WHERE status IN ('INITIATED', 'RINGING', 'ACCEPTED', 'CONNECTED')
      `);

      const defaultHash = hashPassword("password123");

      // Seed default customer
      await client.query(`
        INSERT INTO customers (id, email, name, phone, avatar, password_hash)
        VALUES (
          'customer-1', 
          'customer@belconnect.com', 
          'Akshay Mathapati', 
          '+91 98765 43210', 
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          $1
        )
        ON CONFLICT (id) DO NOTHING
      `, [defaultHash]);

      // Seed default service provider
      await client.query(`
        INSERT INTO service_providers (id, email, name, phone, avatar, password_hash)
        VALUES (
          'provider-1', 
          'provider@belconnect.com', 
          'Rohan Electrician', 
          '+91 91234 56789', 
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
          $1
        )
        ON CONFLICT (id) DO NOTHING
      `, [defaultHash]);

      // Seed default job provider
      await client.query(`
        INSERT INTO job_providers (id, email, name, phone, avatar, password_hash)
        VALUES (
          'jobprovider-1', 
          'jobprovider@belconnect.com', 
          'Belagavi Tech Solutions', 
          '+91 98888 77777', 
          'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
          $1
        )
        ON CONFLICT (id) DO NOTHING
      `, [defaultHash]);

      // Seed default addresses for customer-1
      await client.query(`
        INSERT INTO addresses (id, user_id, type, text)
        VALUES 
          ('addr-1', 'customer-1', 'Home', '123 Main St, Tilakwadi, Belagavi, 590006'),
          ('addr-2', 'customer-1', 'Office', '45 Business Park, Camp, Belagavi, 590001')
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed initial services for provider-1 (Rohan Electrician)
      await client.query(`
        INSERT INTO services (id, provider_id, name, category, description, is_available)
        VALUES
          ('srv-1', 'provider-1', 'Fan Repair & Installation', 'electrical', 'Complete fan repair and new ceiling fan installation.', true),
          ('srv-2', 'provider-1', 'House Wiring Checkup', 'electrical', 'Full inspection of home electrical points and safety audit.', true)
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed initial bookings for customer-1 and provider-1
      await client.query(`
        INSERT INTO bookings (id, customer_id, provider_id, provider_name, service_name, category, date, time, status)
        VALUES
          ('B-1001', 'customer-1', 'provider-1', 'Rohan Electrician', 'Fan Repair & Installation', 'electrical', 'Today', '10:00 AM', 'Accepted'),
          ('B-1002', 'customer-1', 'provider-1', 'Rohan Electrician', 'House Wiring Checkup', 'electrical', 'Tomorrow', '02:30 PM', 'Requested')
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed initial conversation for B-1001
      await client.query(`
        INSERT INTO conversations (id, customer_id, provider_id, booking_id)
        VALUES ('conv-B-1001', 'customer-1', 'provider-1', 'B-1001')
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed initial messages for conv-B-1001
      await client.query(`
        INSERT INTO messages (id, conversation_id, sender_id, sender_role, body, message_type)
        VALUES
          ('msg-1', 'conv-B-1001', 'customer-1', 'customer', 'Hello Rohan! Are you on the way for the fan repair?', 'text'),
          ('msg-2', 'conv-B-1001', 'provider-1', 'provider', 'Hi Akshay! Yes, I am leaving now and will arrive in 10 minutes.', 'text')
        ON CONFLICT (id) DO NOTHING
      `);

      await client.query("COMMIT");
      dbInitialized = true;
      console.log("Database initialized successfully.");
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {}
      }
      console.error("Error during database initialization:", error);
      initPromise = null;
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export async function query(text: string, params?: any[]) {
  if (!dbInitialized) {
    await initDB();
  }
  return pool.query(text, params);
}

export async function getClient() {
  if (!dbInitialized) {
    await initDB();
  }
  return pool.connect();
}
