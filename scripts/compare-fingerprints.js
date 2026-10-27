#!/usr/bin/env node

/**
 * BelConnect - Cross-Service Secret Fingerprint Comparator
 * 
 * Compares the first 8 characters of SHA-256 secret fingerprints between
 * Vercel (Next.js API) and Render (Express Signaling Server) without ever
 * exposing or printing the actual secret values.
 * 
 * Security Rule:
 *   Admin cookies or bearer tokens MUST be supplied via environment variables
 *   (ADMIN_SESSION_COOKIE, INTERNAL_API_SECRET), NEVER as command-line arguments,
 *   to avoid exposure in shell history and system process listings.
 * 
 * Usage:
 *   # Inspect local environment fingerprints:
 *   node scripts/compare-fingerprints.js
 * 
 *   # Compare live environments via env vars:
 *   INTERNAL_API_SECRET="your_shared_secret" \
 *     node scripts/compare-fingerprints.js --frontend https://belconnect.in --backend https://belconnect-signaling.onrender.com
 * 
 *   # Or compare via admin session cookie:
 *   ADMIN_SESSION_COOKIE="raw_admin_cookie" \
 *     node scripts/compare-fingerprints.js --frontend https://belconnect.in --backend https://belconnect-signaling.onrender.com
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load local .env if available
const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(envFile); } catch (_) {}
}

function getFingerprint(val) {
  if (!val || typeof val !== "string" || !val.trim()) return "--------";
  return crypto.createHash("sha256").update(val.trim()).digest("hex").slice(0, 8);
}

async function run() {
  const args = process.argv.slice(2);

  // Security guard: Check if user attempted to pass sensitive credentials as CLI args
  if (args.includes("--admin-cookie") || args.includes("--cookie") || args.includes("--secret")) {
    console.error("\n[SECURITY WARNING] Do not pass admin cookies or secret tokens via command-line arguments.");
    console.error("CLI arguments are visible in process tables ('ps aux') and shell history.");
    console.error("Please supply credentials via environment variables instead:");
    console.error("  ADMIN_SESSION_COOKIE=\"...\" or INTERNAL_API_SECRET=\"...\" node scripts/compare-fingerprints.js\n");
    process.exit(1);
  }

  const frontendUrl = args[args.indexOf("--frontend") + 1];
  const backendUrl = args[args.indexOf("--backend") + 1];
  const secret = process.env.INTERNAL_API_SECRET || process.env.SIGNALING_INTERNAL_SECRET;
  const adminCookie = process.env.ADMIN_SESSION_COOKIE || process.env.ADMIN_COOKIE;

  if (frontendUrl && backendUrl && (secret || adminCookie)) {
    console.log(`\n[FINGERPRINT COMPARISON] Querying live services...`);
    console.log(`  Frontend: ${frontendUrl}`);
    console.log(`  Backend:  ${backendUrl}\n`);

    try {
      const feHeaders = {};
      if (adminCookie) {
        feHeaders["Cookie"] = adminCookie.includes("=")
          ? adminCookie
          : `__Host-admin_session=${adminCookie}; admin_session=${adminCookie}`;
      } else if (secret) {
        feHeaders["Authorization"] = `Bearer ${secret}`;
      }

      const feRes = await fetch(`${frontendUrl}/api/admin/system/fingerprints`, {
        headers: feHeaders
      });
      const feData = await feRes.json();

      const beHeaders = {};
      if (secret) {
        beHeaders["Authorization"] = `Bearer ${secret}`;
      }
      const beRes = await fetch(`${backendUrl}/internal/fingerprints`, {
        headers: beHeaders
      });
      const beData = await beRes.json();

      console.log(`----------------------------------------------------------------`);
      console.log(` Secret Name                 | Frontend (Vercel) | Backend (Render) | Status`);
      console.log(`----------------------------------------------------------------`);

      const secretsToCompare = ["JWT_SECRET", "INTERNAL_API_SECRET"];
      let allMatch = true;

      for (const s of secretsToCompare) {
        const feFp = feData?.fingerprints?.[s] || feData?.fingerprints?.["SIGNALING_INTERNAL_SECRET"] || "MISSING";
        const beFp = beData?.fingerprints?.[s] || beData?.fingerprints?.["SIGNALING_INTERNAL_SECRET"] || "MISSING";
        const match = feFp === beFp && feFp !== "MISSING" && feFp !== "--------";
        if (!match) allMatch = false;

        const statusLabel = match ? "[MATCH]" : "[MISMATCH / MISSING]";
        console.log(` ${s.padEnd(27)} | ${feFp.padEnd(17)} | ${beFp.padEnd(16)} | ${statusLabel}`);
      }
      console.log(`----------------------------------------------------------------\n`);

      if (allMatch) {
        console.log(`[VERIFICATION PASS] Shared secret fingerprints match across Vercel and Render.`);
      } else {
        console.error(`[VERIFICATION FAIL] Secret mismatch detected. Services will reject cross-boundary calls.`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`[ERROR] Failed to query live service fingerprints:`, err.message);
      process.exit(1);
    }
    return;
  }

  // Local Inspection Mode
  console.log(`\n================================================================`);
  console.log(` Local Environment Secret Fingerprints (First 8 SHA-256 chars)`);
  console.log(`================================================================`);

  const { validateFrontendEnv, validateBackendEnv } = require("./env-validator");
  const feResult = validateFrontendEnv(process.env);
  const beResult = validateBackendEnv(process.env);

  console.log(`\nFrontend (Vercel) Configured Fingerprints:`);
  for (const [k, v] of Object.entries(feResult.fingerprints)) {
    console.log(`  ${k.padEnd(30)}: ${v}`);
  }

  console.log(`\nBackend (Render) Configured Fingerprints:`);
  for (const [k, v] of Object.entries(beResult.fingerprints)) {
    console.log(`  ${k.padEnd(30)}: ${v}`);
  }

  console.log(`\nLocal Status:`);
  console.log(`  Frontend Configuration Valid : ${feResult.valid ? "YES" : "NO (" + feResult.errors.length + " errors)"}`);
  console.log(`  Backend Configuration Valid  : ${beResult.valid ? "YES" : "NO (" + beResult.errors.length + " errors)"}`);

  if (feResult.fingerprints.JWT_SECRET !== beResult.fingerprints.JWT_SECRET) {
    console.warn(`  [WARNING] Local JWT_SECRET mismatch between frontend and backend.`);
  } else {
    console.log(`  [OK] JWT_SECRET matches between frontend and backend.`);
  }

  console.log(`================================================================\n`);
}

run().catch(err => {
  console.error("Comparison error:", err);
  process.exit(1);
});
