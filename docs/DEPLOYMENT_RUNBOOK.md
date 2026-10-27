# BelConnect Production Deployment Runbook & Operational Guide

> **Strict Operational Rules**:
> 1. Migrations MUST be executed and recorded before code deployments.
> 2. Database migrations MUST always connect directly to PostgreSQL port 5432 (`DATABASE_DIRECT_URL`), NEVER through PgBouncer (port 6432).
> 3. The signaling server (Render) MUST be deployed before frontend client changes.
> 4. Transition flags (`AUTH_ACCEPT_LEGACY_JWT=true`, `AUTH_ISSUE_LEGACY_JWT=true`) MUST remain `true` until Phase 3b is thoroughly verified on web and Android devices.
> 5. Never pass secrets or admin cookies as command-line arguments (use environment variables).

---

## 1. Migration Sequence & Roadmap

| Number | Migration Name | Purpose | Status |
| :--- | :--- | :--- | :--- |
| **035** | `035_server_side_sessions.sql` | `sessions` table, `socket_tickets` table, `account_status` column | Staged / Ready |
| **036** | `036_session_hotpath_indexes.sql` | Partial indexes on active sessions & durable telemetry table `auth_daily_metrics` | Staged / Ready |
| **037** | `037_admin_mfa_totp.sql` | Admin TOTP secrets and recovery codes *(Phase 4)* | Draft / Phase 4 |

---

## 2. Step-by-Step Deployment Order

```
[1. DB Snapshot] ──> [2. Staging Migration] ──> [3. Staging Deploy & Smoke] ──> [4. Android APK Test]
                                                                                         │
[8. Vercel Next.js Deploy] <── [7. Render Signaling Deploy] <── [6. Preflight] <── [5. Prod Migration]
          │
          └──> [9. Fingerprint Check] ──> [10. Prod Smoke Test] ──> [11. 30-Min Telemetry Window]
```

### Step 1: Database Snapshot (Render PostgreSQL)
Before applying schema changes, create a complete binary snapshot:
```bash
pg_dump "$DATABASE_DIRECT_URL" --format=custom --no-owner --file="belconnect_pre_035_036_$(date +%Y%m%d_%H%M%S).dump"
```
Also trigger a manual snapshot from **Render Dashboard > Postgres > Backups > Take Snapshot**.

### Step 2: Staging Database Migration (Direct Port 5432)
Apply migrations 001 through 036 to the staging database:
```bash
# With TEST_DATABASE_URL or DATABASE_DIRECT_URL pointing to staging port 5432:
npm run migrate:test
```
Verify that all migrations apply cleanly and are recorded in `schema_migrations`.

### Step 3: Staging Deploy & Integration Suite
1. Deploy branch `auth/phase-3a` to a Vercel Preview environment connected to the staging database and staging signaling server.
2. Run the integration test suite against staging:
   ```bash
   node --test tests/integration/*.test.js
   ```
3. Run the automated smoke suite against staging:
   ```bash
   TARGET_URL="https://staging-preview.belconnect.in" \
   SIGNALING_URL="https://staging-signaling.onrender.com" \
   npm run smoke
   ```

### Step 4: Real Android Device Verification (Capacitor)
1. Build an Android APK pointing to the staging environment.
2. Verify on a real Android device (and second concurrent device if available):
   - **Login**: User logs in; HttpOnly `__Host-session` cookie is established in WebView.
   - **Native Session Exchange**: App calls `POST /api/auth/native-session` with `x-device-id: <uuid>`. Token is issued with `client = 'android'`.
   - **App Resume / Idempotent Check**: Background the app (switch to Google Maps), reopen it. Verify the app reuses the active session (`reused: true`) without revoking or recreating tokens.
   - **Background Location**: Verify provider background GPS updates continue transmitting to `/api/bookings/:id/provider-location-native` without 401 errors.
   - **Multi-Device**: Log into a second device with the same account. Verify device 1 remains active and is not logged out.

### Step 5: Production Database Migration (Port 5432)
Apply migrations 035 and 036 to production:
```bash
# Must use DATABASE_DIRECT_URL on port 5432:
node scripts/run-migrations.js --allow-production
```
Confirm in the terminal that `035_server_side_sessions.sql` and `036_session_hotpath_indexes.sql` report `APPLIED`.

### Step 6: Production Preflight Check
Execute the read-only preflight check:
```bash
npm run preflight
```
Ensure all items report `[PASS]`:
- Database connectivity (`SELECT 1`)
- `schema_migrations` contains 035 and 036
- Required tables (`sessions`, `socket_tickets`, `auth_daily_metrics`) exist
- Environment variables (secrets $\ge 32$ chars, no placeholders)

### Step 7: Deploy Signaling Server (Render)
1. Deploy `backend/src/server.js` to Render.
2. Verify startup logs:
   - Prints 8-character fingerprints for `JWT_SECRET` and `INTERNAL_API_SECRET`.
   - Database connection reports `[Database] PostgreSQL connection: ok`.
   - `/health` responds with HTTP 200: `{ "status": "ok", "db": "ok" }`.

### Step 8: Deploy Next.js Frontend (Vercel)
1. Promote the deployment to production on Vercel.
2. Ensure Vercel environment variables contain:
   - `AUTH_ACCEPT_LEGACY_JWT=true`
   - `AUTH_ISSUE_LEGACY_JWT=true`
   - Matching `JWT_SECRET` and `INTERNAL_API_SECRET` (or `SIGNALING_INTERNAL_SECRET`)
   - `CRON_SECRET`, `OAUTH_STATE_SECRET`

### Step 9: Verify Cross-Service Secret Fingerprints
Verify that Vercel and Render share identical secret fingerprints:
```bash
INTERNAL_API_SECRET="your_production_secret" \
node scripts/compare-fingerprints.js \
  --frontend https://belconnect.in \
  --backend https://belconnect-signaling.onrender.com
```

### Step 10: Production Smoke Test
```bash
TARGET_URL="https://belconnect.in" \
SIGNALING_URL="https://belconnect-signaling.onrender.com" \
npm run smoke
```

### Step 11: 30-Minute Monitoring Window & Metric Validation
Monitor production telemetry for 30 minutes before declaring readiness.

---

## 3. Go / No-Go Checklist (Numeric Thresholds)

All conditions must be satisfied to declare deployment success:

| Metric | Pass Target | Hard Failure (Trigger Rollback) |
| :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | $< 0.05\%$ of total requests | $> 0.2\%$ sustained for 3 minutes |
| **HTTP 503 Count** | $0$ | $> 5$ in any 60-second window |
| **API Latency (p95)** | $< 200\text{ ms}$ | $> 500\text{ ms}$ sustained |
| **Active DB Connections** | $< 58$ connections ($< 60\%$ of 97 max) | $> 75$ connections ($> 77\%$) |
| **Legacy Fallback Rate** | Tracked via `auth_daily_metrics` | Unexpected sudden spike in 401s |
| **Unhandled Rejections** | $0$ | $\ge 1$ fatal crash in signaling logs |

---

## 4. Render PgBouncer Connection Pooler Guide

Render PostgreSQL includes an integrated PgBouncer pooler on port **6432** in **Transaction Mode**.

### When to Enable PgBouncer
- **Trigger**: Peak database connections consistently exceed **60% of plan capacity** (e.g. $> 58$ connections on Starter plan) as reported by:
  ```sql
  SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
  ```
- **When NOT to Enable**: In early production when concurrency is well within the direct connection limit (31 concurrent Lambdas with `DB_POOL_MAX=2`).

### Transaction Mode Constraints & Caveats
1. **Migrations MUST use Port 5432**: DDL operations, table locks, and advisory locks are incompatible with transaction pooling. Always use `DATABASE_DIRECT_URL` for migration scripts.
2. **Prepared Statements**: PgBouncer transaction mode assigns a different backend connection per transaction. Do not use named prepared statements across transactions.
3. **`statement_timeout` Handling**: Some PgBouncer configurations reject connection-string parameters like `options: "-c statement_timeout=5000"`. If rejected on staging, set `statement_timeout` at the role level:
   ```sql
   ALTER ROLE <app_user> SET statement_timeout = '5000ms';
   ```

### Enable Procedure
1. In the **Render Dashboard**, open your PostgreSQL database, click **Connection Pooling**, and enable PgBouncer on port **6432**.
2. Copy the connection string (port 6432) and update `DATABASE_URL` in Vercel environment variables.
3. Retain the direct connection string (port 5432) as `DATABASE_DIRECT_URL` in Vercel and CI environments.
4. Redeploy Vercel.

### Rollback Procedure
1. In Vercel, change `DATABASE_URL` back to the direct port 5432 connection string.
2. Redeploy the previous production deployment in Vercel (< 15 seconds).

---

## 5. Rollback Procedures

### A. Vercel Instant Rollback (Next.js Frontend/API)
- **Action**: In the Vercel Dashboard, navigate to **Deployments**, locate the previous healthy deployment, and click **Instant Rollback**.
- **Time to Recover**: Under 15 seconds.
- **Database Impact**: Zero. Schema changes in 035 and 036 are 100% backward-compatible.

### B. Render Rollback (Signaling Server)
- **Action**: In the Render Dashboard under **Web Services > Deploys**, select the previous commit and click **Rollback to this deploy**.
- **Time to Recover**: ~1 to 2 minutes.

### C. Feature Flag Fallback (No Code Redeploy)
If session validation experiences database connection saturation, ensure `AUTH_ACCEPT_LEGACY_JWT=true` and `AUTH_ISSUE_LEGACY_JWT=true` in Vercel environment variables. The dual-validation engine will accept legacy JWTs automatically.

### D. Emergency SQL Down-Migration
```sql
-- Down-migration 036
DROP INDEX IF EXISTS public.idx_sessions_user_role_active;
DROP INDEX IF EXISTS public.idx_sessions_idle_expires;
DROP INDEX IF EXISTS public.idx_sessions_cleanup_sweep;
DROP INDEX IF EXISTS public.idx_customers_account_status;
DROP INDEX IF EXISTS public.idx_service_providers_account_status;
DROP INDEX IF EXISTS public.idx_job_providers_account_status;
DROP TABLE IF EXISTS public.auth_daily_metrics;

-- Down-migration 035
DROP TABLE IF EXISTS public.socket_tickets CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS chk_customers_account_status;
ALTER TABLE public.customers DROP COLUMN IF EXISTS account_status;
ALTER TABLE public.service_providers DROP CONSTRAINT IF EXISTS chk_service_providers_account_status;
ALTER TABLE public.service_providers DROP COLUMN IF EXISTS account_status;
ALTER TABLE public.job_providers DROP CONSTRAINT IF EXISTS chk_job_providers_account_status;
ALTER TABLE public.job_providers DROP COLUMN IF EXISTS account_status;
DELETE FROM public.schema_migrations WHERE name IN ('035_server_side_sessions.sql', '036_session_hotpath_indexes.sql');
```

---

## 6. Official Citations & Infrastructure Limits

### Render PostgreSQL Connection Limits
- **Official Documentation**: [Render PostgreSQL Connection Limits](https://render.com/docs/databases#connection-limits) and [Render Connection Pooling](https://render.com/docs/database-connection-pools).
- **Plan Table**:
  - **Free**: 97 maximum concurrent connections.
  - **Starter ($7/mo, 1 GB RAM, 0.5 CPU)**: 97 maximum concurrent connections.
  - **Standard (4 GB RAM, 1 CPU)**: 250 maximum concurrent connections.
  - **Pro (8 GB RAM, 2 CPU)**: 500 maximum concurrent connections.
- *Usable connection capacity*: On Starter (97 max), 10 connections are reserved for superuser maintenance, yielding **~87 to 90 usable application connections**.

### Vercel Plan Limits (Cron & Serverless Duration)
- **Official Documentation**: [Vercel Cron Jobs Limits](https://vercel.com/docs/cron-jobs) and [Serverless Function Execution Duration](https://vercel.com/docs/functions/runtimes#max-duration).
- **Hobby Plan**:
  - Cron Frequency: Maximum **once per day** (e.g. `0 3 * * *`). Sub-daily cron schedules (`*/5 * * * *`) are rejected at build/deploy time.
  - Function Duration: Default **10 seconds**, configurable up to **60 seconds** (`maxDuration: 60`).
- **Pro Plan**:
  - Cron Frequency: Up to **once per minute** (`* * * * *`).
  - Function Duration: Default **15 seconds**, configurable up to **300 seconds** (5 minutes).
- **BelConnect Compliance**: `/api/cron/cleanup-sessions` is scheduled at `0 3 * * *` (once daily at 03:00 UTC) with internal execution capped at 20 seconds, ensuring full compliance on both Hobby and Pro plans.
