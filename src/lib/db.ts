import { Pool } from "pg";
import crypto from "crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/cityconnect";

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

let dbInitialized = false;

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function initDB() {
  if (dbInitialized) return;

  const client = await pool.connect();
  try {
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
        base_price NUMERIC(10, 2) NOT NULL,
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
        status VARCHAR(50) NOT NULL
      )
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
      INSERT INTO services (id, provider_id, name, category, description, base_price, is_available)
      VALUES
        ('srv-1', 'provider-1', 'Fan Repair & Installation', 'electrical', 'Complete fan repair and new ceiling fan installation.', 299.00, true),
        ('srv-2', 'provider-1', 'House Wiring Checkup', 'electrical', 'Full inspection of home electrical points and safety audit.', 599.00, true)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query("COMMIT");
    dbInitialized = true;
    console.log("Database initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error during database initialization:", error);
    throw error;
  } finally {
    client.release();
  }
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
