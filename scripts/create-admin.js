#!/usr/bin/env node
/**
 * scripts/create-admin.js
 * 
 * Script to create or update a BelConnect administrator account.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD strictly from environment variables.
 * Enforces minimum 12-character password length and hashes with Argon2id.
 * 
 * NEVER hardcode passwords or secrets.
 * Refuses connection if DATABASE_URL points to production (*.render.com).
 * 
 * Usage:
 *   ADMIN_EMAIL="admin@belconnect.in" ADMIN_PASSWORD="your-secure-password-12chars" node scripts/create-admin.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 1. Resolve environment variables (from process.env, .env.local, or .env)
function loadEnvIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvIfPresent(path.resolve(__dirname, "../frontend/.env.local"));
loadEnvIfPresent(path.resolve(__dirname, "../frontend/.env"));
loadEnvIfPresent(path.resolve(__dirname, "../.env"));

const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : "";
const adminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : "";

if (!adminEmail) {
  console.error("ERROR: ADMIN_EMAIL environment variable is missing.");
  console.error("Usage: ADMIN_EMAIL=\"admin@belconnect.in\" ADMIN_PASSWORD=\"...\" node scripts/create-admin.js");
  process.exit(1);
}

if (!adminPassword || adminPassword.length < 12) {
  console.error("ERROR: ADMIN_PASSWORD environment variable is missing or shorter than 12 characters.");
  console.error("Admin passwords must be at least 12 characters long.");
  process.exit(1);
}

// 2. Validate DATABASE_URL and enforce production safety rule
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL environment variable is missing.");
  process.exit(1);
}

if (databaseUrl.includes("render.com")) {
  console.error("FATAL SAFETY CHECK: DATABASE_URL points to a production host (render.com).");
  console.error("Connecting to or running scripts against production database is strictly prohibited.");
  process.exit(1);
}

// 3. Resolve modules (from frontend/node_modules if running from root)
let argon2;
let pg;

try {
  argon2 = require("argon2");
} catch (_) {
  try {
    argon2 = require(path.resolve(__dirname, "../frontend/node_modules/argon2"));
  } catch (err) {
    console.error("ERROR: Could not resolve 'argon2' dependency. Please run 'npm install' in frontend.");
    process.exit(1);
  }
}

try {
  pg = require("pg");
} catch (_) {
  try {
    pg = require(path.resolve(__dirname, "../frontend/node_modules/pg"));
  } catch (err) {
    console.error("ERROR: Could not resolve 'pg' dependency. Please run 'npm install' in frontend.");
    process.exit(1);
  }
}

async function main() {
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Ensure admins table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.admins (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Hash password with Argon2id OWASP parameters
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    // Check if admin already exists
    const existing = await client.query(
      "SELECT id FROM public.admins WHERE LOWER(email) = LOWER($1)",
      [adminEmail]
    );

    if (existing.rows.length > 0) {
      await client.query(
        "UPDATE public.admins SET password_hash = $1 WHERE LOWER(email) = LOWER($2)",
        [passwordHash, adminEmail]
      );
      console.log(`[SUCCESS] Admin account for '${adminEmail}' updated successfully.`);
    } else {
      const adminId = crypto.randomUUID();
      await client.query(
        "INSERT INTO public.admins (id, email, password_hash) VALUES ($1, $2, $3)",
        [adminId, adminEmail, passwordHash]
      );
      console.log(`[SUCCESS] Admin account for '${adminEmail}' created successfully (ID: ${adminId}).`);
    }
  } catch (err) {
    console.error("Database error during admin provisioning:", err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();

