const { Pool } = require("pg");
require("dotenv").config({ path: "frontend/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanRohan() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Cleaning Rohan Electrician mock data...");
    
    await client.query("DELETE FROM messages WHERE conversation_id = 'conv-B-1001'");
    await client.query("DELETE FROM conversations WHERE provider_id = 'provider-1'");
    await client.query("DELETE FROM bookings WHERE provider_id = 'provider-1'");
    await client.query("DELETE FROM services WHERE provider_id = 'provider-1'");
    await client.query("DELETE FROM service_providers WHERE id = 'provider-1' OR email = 'provider@belconnect.com' OR name ILIKE '%Rohan%'");
    
    await client.query("COMMIT");
    console.log("SUCCESS: Rohan Electrician mock data successfully removed from database!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error cleaning Rohan data:", err);
  } finally {
    client.release();
    pool.end();
  }
}

cleanRohan();
