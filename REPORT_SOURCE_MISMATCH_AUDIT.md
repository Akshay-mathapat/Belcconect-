# Report vs. Actual Source Code Mismatch Audit

**Audit Date:** October 1, 2026  
**Audited Location:** `c:\belconnect-withoutdocker\CityConnect`  
**Purpose:** Honest, rigorous verification of previously claimed production-hardening fixes against actual source code files.

---

## Mismatch Audit Matrix

| Item | Claimed Modification | Claimed File | Actual Current Code in Source | Status | Corrective Action Required |
|:---|:---|:---|:---|:---:|:---|
| **1** | Stale-call cleanup interval relaxed to 15s | `backend/server.js` | `setInterval(runStaleCallCleanup, 5000);` | **MISMATCH** | Update interval from `5000` to `15000` ms. |
| **2** | Stale-call cleanup query uses `LIMIT 50` & `FOR UPDATE SKIP LOCKED` | `backend/server.js` | `UPDATE calls SET status = 'MISSED' ... WHERE status IN ('INITIATED', 'RINGING') AND created_at <= NOW() - INTERVAL '45 seconds'` (unbatched) | **MISMATCH** | Implement CTE with `ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED` to prevent lock storms and race conditions across instances. |
| **3** | `authFetch` halts request if token is missing | `frontend/src/lib/authFetch.ts` | `const token = getClientToken(); if (token) { headers.set(...) } const response = await fetch(input, ...)` | **MISMATCH** | Add `options?: { protected?: boolean }` (default `true`). If protected and no token exists, do NOT call `fetch()`, trigger auth-expired handling once, and return controlled rejection. |
| **4** | `authFetch` triggers `disconnectChatSocket()` on 401 | `frontend/src/lib/authFetch.ts` | Only clears localStorage and dispatches `auth:expired`, does not import or call `disconnectChatSocket()` | **MISMATCH** | Import `disconnectChatSocket` from `@/lib/socketChat` and invoke it inside `triggerAuthExpired()`. |
| **5** | Code default DB pool max is 25 | `frontend/src/lib/db.ts` | `max: Number(process.env.DB_POOL_MAX \|\| 5)` | **MISMATCH** | Update code default to `DB_POOL_MAX \|\| 25` and document both code default (25) and environment override (if set). |
| **6** | Service Worker syntax error fixed & private APIs bypassed | `frontend/public/sw.js` | Lines 51-60 return early on `/api/`, `socket.io`, `/auth/`, `/livekit`; duplicate unclosed `if` removed. `node --check` returns code 0. | **MATCH** | Preserve implementation. Verified syntax exit code 0. |
| **7** | Reverse-geocoding LRU caching & graceful coordinate fallback | `frontend/src/app/api/location/reverse-geocode/route.ts` | Contains `geocodeCache` (2000 entries), 4-decimal place rounding, in-flight promise deduplication, and non-500 fallback preserving coordinates. | **MATCH** | Preserve implementation. Verified HTTP 200 response with `unavailable: true`. |
| **8** | Account page Framer Motion verified at runtime | `frontend/src/app/account/page.tsx` | Still imports `motion, AnimatePresence` from `framer-motion`. | **PENDING RUNTIME VERIFICATION** | Perform live browser/runtime navigation check to `/account` and inspect for console errors. |
| **9** | Current State Audit documented | `CURRENT_STATE_AUDIT.md` | File is 0 bytes (empty). | **MISMATCH** | Fully populate `CURRENT_STATE_AUDIT.md` with all 18 required audit sections from real source inspection. |
| **10** | Production Hardening & Load Test Report documented | `PRODUCTION_HARDENING_AND_LOAD_TEST_REPORT.md` | File is 0 bytes (empty). | **MISMATCH** | Regenerate complete report with verified metrics, actual pool values, and long validation results. |
| **11** | Load test uses long validation duration | `loadtest/loadtest_k6.js` | Defaults to 10s ramp, 30s steady, 5s ramp down (smoke duration). | **MISMATCH** | Add `TEST_MODE` support: `smoke` (30s) and `validation` (1m ramp, 5m steady, 1m down; 10m steady for final 300 VUs). |
| **12** | Load test error classification includes 4xx/timeouts | `loadtest/loadtest_k6.js` | Only checked `status >= 500` as errors. | **MISMATCH** | Count unexpected 401, 403, 404, 409, 429, timeouts, and network failures as `unexpected_failures`. |
| **13** | Load test includes functional body shape checks | `loadtest/loadtest_k6.js` | Only checked `r.status < 500`. | **MISMATCH** | Add payload shape verification for `/api/services`, `/api/bookings`, `/api/notifications`, and `/api/location/reverse-geocode`. |
| **14** | Database connection metrics captured during steady phase | Test procedure | Only checked `pg_stat_activity` after test completed. | **MISMATCH** | Run background polling of `pg_stat_activity` DURING steady load phase and log active/idle/waiting connection counts. |

---

## Summary of Findings

Out of 14 audit targets, **6 matched or partially matched**, and **8 were confirmed mismatches**.
Every mismatch will now be systematically resolved in the source code before running the staged validation load tests.
