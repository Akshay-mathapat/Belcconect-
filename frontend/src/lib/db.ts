import { Pool } from "pg";
import crypto from "crypto";
import argon2 from "argon2";

declare global {
  var postgresPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("FATAL: DATABASE_URL environment variable is missing on Vercel.");
    }
    const hostInfo = connectionString.includes("@") ? connectionString.split("@")[1].split("/")[0] : connectionString;
    
    if (process.env.NODE_ENV === "production" && (hostInfo.includes("127.0.0.1") || hostInfo.includes("localhost"))) {
      throw new Error(`FATAL: DATABASE_URL on Vercel is currently configured as a local address (${hostInfo}). Please update DATABASE_URL in Vercel Dashboard Settings -> Environment Variables to your Cloud PostgreSQL URL (e.g. Render or Neon).`);
    }

    console.log(`[Database] Initializing Pool connecting to: ${hostInfo}`);
    globalThis.postgresPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" || connectionString.includes("render.com") || connectionString.includes("neon.tech")
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return globalThis.postgresPool;
}

let dbInitialized = false;
let initPromise: Promise<void> | null = null;
let lastInitErrorTime = 0;
const INIT_RETRY_COOLDOWN_MS = 5000;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$argon2id$") || hash.startsWith("$argon2i$") || hash.startsWith("$argon2d$")) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  // Legacy SHA-256 fallback for seeded demo accounts
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  return legacyHash === hash;
}

export async function initDB() {
  if (dbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let client;
    try {
      client = await getPool().connect();
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
          google_id VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE`);

      // 2. Create Service Providers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_providers (
          id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          avatar TEXT,
          password_hash VARCHAR(255),
          google_id VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE`);

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
          google_id VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`ALTER TABLE job_providers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE`);

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

      // Real-time provider and customer live tracking columns
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_current_latitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_current_longitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_location_updated_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_location_accuracy NUMERIC`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_current_latitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_current_longitude NUMERIC(10,7)`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_location_updated_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_location_accuracy NUMERIC`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_provider_loc ON bookings(provider_location_updated_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_customer_loc ON bookings(customer_location_updated_at)`);

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

      // 13. Create Password Reset OTPs and Password Reset Sessions tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_otps (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          user_table VARCHAR(50) NOT NULL,
          email VARCHAR(255) NOT NULL,
          otp_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          verified_at TIMESTAMPTZ,
          used_at TIMESTAMPTZ,
          attempt_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pw_reset_otps_user ON password_reset_otps(user_id);
        CREATE INDEX IF NOT EXISTS idx_pw_reset_otps_email ON password_reset_otps(email);
        CREATE INDEX IF NOT EXISTS idx_pw_reset_otps_expires ON password_reset_otps(expires_at);

        CREATE TABLE IF NOT EXISTS password_reset_sessions (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          user_table VARCHAR(50) NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pw_reset_sess_user ON password_reset_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_pw_reset_sess_expires ON password_reset_sessions(expires_at);
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

      // 14. Create Google OAuth Transactions & Mobile Handoffs tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS google_oauth_transactions (
          state_hash TEXT PRIMARY KEY,
          code_challenge TEXT NOT NULL,
          account_type VARCHAR(32) NOT NULL CHECK (account_type IN ('customer', 'service_provider', 'job_provider')),
          code_verifier TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_google_oauth_transactions_expiry ON google_oauth_transactions(expires_at);

        CREATE TABLE IF NOT EXISTS google_mobile_handoffs (
          code_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          role VARCHAR(20) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_google_mobile_handoffs_expiry ON google_mobile_handoffs(expires_at);
      `);

      // Auto-expire lingering call sessions on server/DB initialization
      await client.query(`
        UPDATE calls 
        SET status = 'ENDED', ended_at = NOW() 
        WHERE status IN ('INITIATED', 'RINGING', 'ACCEPTED', 'CONNECTED')
      `);

      const defaultHash = await hashPassword("password123");

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

      // Clean up legacy Rohan Electrician mock seed data if present
      await client.query(`DELETE FROM messages WHERE conversation_id = 'conv-B-1001'`);
      await client.query(`DELETE FROM conversations WHERE provider_id = 'provider-1'`);
      await client.query(`DELETE FROM bookings WHERE provider_id = 'provider-1'`);
      await client.query(`DELETE FROM services WHERE provider_id = 'provider-1'`);
      await client.query(`DELETE FROM service_providers WHERE id = 'provider-1' OR email = 'provider@belconnect.com'`);

      await client.query("COMMIT");
      dbInitialized = true;
      console.log("Database initialized successfully.");
    } catch (error: any) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {}
      }
      const now = Date.now();
      if (now - lastInitErrorTime > INIT_RETRY_COOLDOWN_MS) {
        console.error("Database connection warning:", error?.message || error);
        lastInitErrorTime = now;
      }
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
  return getPool().query(text, params);
}

export async function getClient() {
  if (!dbInitialized) {
    await initDB();
  }
  return getPool().connect();
}
