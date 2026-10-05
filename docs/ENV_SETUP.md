# Production Environment Configuration Guide

## Architecture Overview
BelConnect / CityConnect runs on a hybrid cloud deployment:
1. **Frontend**: Next.js App Router deployed on **Vercel** (`https://belcconect.vercel.app`)
2. **Signaling Server**: Socket.IO + Express Node.js server deployed on **Render** (`https://belcconect-backend.onrender.com`)
3. **Database**: Hosted PostgreSQL (Render / Neon / Supabase)

---

## CRITICAL: No-Quotes Rule
> [!IMPORTANT]
> When entering environment variables in the **Render Dashboard** or **Vercel Project Settings**, **DO NOT wrap values in quotes** (`"..."` or `'...'`).
> While both the frontend and backend include automated secret normalizers that strip outer quotes, entering unquoted values prevents edge-case parsing mismatches.

---

## 1. Vercel Environment Variables (Frontend)

Set these in **Vercel Dashboard** -> **Settings** -> **Environment Variables**:

| Variable Name | Environment | Required | Example / Description |
|---------------|-------------|----------|----------------------|
| `NODE_ENV` | Production | Yes | `production` |
| `NEXT_PUBLIC_APP_URL` | Production | Yes | `https://belcconect.vercel.app` |
| `APP_URL` | Production | Yes | `https://belcconect.vercel.app` |
| `NEXT_PUBLIC_SIGNALING_URL` | Production | Yes | `https://belcconect-backend.onrender.com` (NO trailing slash) |
| `SIGNALING_SERVER_URL` | Production | Yes | `https://belcconect-backend.onrender.com` (NO trailing slash) |
| `DATABASE_URL` | Production | Yes | `postgresql://user:password@host/database?sslmode=require` |
| `JWT_SECRET` | Production | Yes | Random 64+ char secret string (Must match Render) |
| `SIGNALING_INTERNAL_SECRET` | Production | Yes | Random 64+ char secret string (Must match Render) |
| `NEXT_PUBLIC_DEMO_MODE` | Production | Yes | `false` |
| `DB_POOL_MAX` | Production | Optional | `2` (Default is 2 on Vercel to preserve connection slots) |
| `DB_CONNECTION_TIMEOUT_MS` | Production | Optional | `10000` |
| `DB_STATEMENT_TIMEOUT_MS` | Production | Optional | `10000` |

---

## 2. Render Environment Variables (Signaling Backend)

Set these in **Render Dashboard** -> **Web Service** -> **Environment**:

| Variable Name | Required | Example / Description |
|---------------|----------|----------------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Render sets this automatically (or `4001`) |
| `DATABASE_URL` | Yes | `postgresql://user:password@host/database?sslmode=require` |
| `JWT_SECRET` | Yes | **Exact same string as Vercel JWT_SECRET** (no quotes) |
| `SIGNALING_INTERNAL_SECRET` | Yes | **Exact same string as Vercel SIGNALING_INTERNAL_SECRET** |
| `ALLOWED_ORIGIN` | Yes | `https://belcconect.vercel.app` |
| `APP_URL` | Yes | `https://belcconect.vercel.app` |

---

## 3. Comparing Secrets Without Leaking Values (SHA-256 Fingerprint)

Both the frontend and backend log the first 8 hexadecimal characters of the SHA-256 hash of `JWT_SECRET` and `SIGNALING_INTERNAL_SECRET` at boot time:

### Frontend (Vercel Build/Runtime Logs):
```text
[AUTH] Frontend JWT_SECRET initialized (SHA-256 fingerprint: a1b2c3d4)
```

### Backend (Render Service Logs):
```text
[BOOT] Backend JWT_SECRET initialized (SHA-256 fingerprint: a1b2c3d4)
[BOOT] Backend SIGNALING_INTERNAL_SECRET initialized (SHA-256 fingerprint: e5f6a7b8)
```

If the 8-character fingerprints match between Vercel and Render, the secrets are **100% identical**. If they differ, check for whitespace or mismatched values.

---

## 4. Database Connection Budget Math

Render PostgreSQL (Hobby/Free/Starter tier) typically limits connections to **50–100** max clients.

- **Backend (Render)**: Uses a persistent connection pool of **max 10**.
- **Frontend (Vercel Serverless)**: Each concurrent lambda container runs with `defaultPoolMax = 2`.
  - 25 concurrent serverless lambdas × 2 connections = **50 connections**.
  - Total = 10 (Render backend) + 50 (Vercel lambdas) = **60 connections**.
- **Pool Exhaustion Protection**: If the pool runs out of client connections during high traffic spikes, `frontend/src/lib/db.ts` and `api/auth/login/route.ts` gracefully return `HTTP 503 (Service Busy)` with a `Retry-After: 3` header rather than crashing with 500 errors.

---

## 5. Render Free-Tier Cold Start Prevention

Render free web services spin down after 15 minutes of inactivity. To prevent cold starts (which cause 50-second delays for the first user connecting to Socket.IO):

1. Set up a free HTTP health ping on [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org).
2. Point it to:
   ```text
   GET https://belcconect-backend.onrender.com/health
   ```
3. Set the interval to **every 10 minutes**.
4. The endpoint verifies database connectivity, active Socket.IO connections, and server uptime.

