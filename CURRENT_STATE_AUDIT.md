# Current State Audit: BelConnect Codebase

**Date:** October 1, 2026  
**Audited Location:** `c:\belconnect-withoutdocker\CityConnect`  
**Purpose:** Comprehensive baseline audit of timers, sockets, database pooling, auth, schemas, and load testing configurations before corrective hardening.

---

## 1. Every `setInterval` in Source

### Frontend
- **`frontend/src/app/bookings/page.tsx:114`**:
  `intervalId = setInterval(() => { if (!getSocket()?.connected) fetchBookings(); }, 60000);`  
  *Fallback polling for customer bookings list; only executes if socket is disconnected.*
- **`frontend/src/app/bookings/[id]/page.tsx:105`**:
  `intervalId = setInterval(() => { if (!getSocket()?.connected) fetchBookingDetail(); }, 60000);`  
  *Fallback polling for single booking details; only executes if socket is disconnected.*
- **`frontend/src/app/provider/bookings/page.tsx:114`**:
  `intervalId = setInterval(() => { if (!getSocket()?.connected) fetchProviderBookings(); }, 60000);`  
  *Fallback polling for provider bookings list; only executes if socket is disconnected.*
- **`frontend/src/app/provider/bookings/[id]/page.tsx:105`**:
  `intervalId = setInterval(() => { if (!getSocket()?.connected) fetchProviderBookings(); }, 60000);`  
  *Fallback polling for provider booking details; only executes if socket is disconnected.*
- **`frontend/src/app/provider/messages/page.tsx:68`**:
  `interval = setInterval(() => { if (!getSocket()?.connected) fetchConversations(); }, 60000);`  
  *Fallback polling for provider chat conversations; only executes if socket is disconnected.*
- **`frontend/src/components/calls/CallProvider.tsx:1184`**:
  `const interval = setInterval(() => { ... }, 60000);`  
  *Fallback polling for active call reconciliation; only executes if signaling socket is disconnected.*
- **`frontend/src/components/location/CustomerTrackingMap.tsx:301`**:
  `interval = setInterval(() => { if (!getSocket()?.connected) pollDbLocation(); }, 60000);`  
  *Fallback DB location poll; only executes if socket is disconnected and last ping > 10s.*
- **`frontend/src/components/location/CustomerTrackingMap.tsx:330`**:
  `const timerInterval = setInterval(updateFreshness, 1000);`  
  *UI-only timestamp freshness counter; creates zero network traffic.*
- **`frontend/src/components/location/CustomerTrackingMap.tsx:406`**:
  `const routeInterval = setInterval(fetchOsrmRoute, 35000);`  
  *OSRM route refresh while tracking screen is mounted.*

### Backend
- **`backend/server.js:886`**:
  `setInterval(runStaleCallCleanup, 5000);`  
  *Periodic cleanup worker for expired INITIATED/RINGING calls.*

---

## 2. Every Network-Producing Timer
1. `CustomerTrackingMap.tsx:406`: `setInterval(fetchOsrmRoute, 35000)` -> OSRM public route fetch.
2. `CustomerTrackingMap.tsx:301`: `setInterval(pollDbLocation, 60000)` -> `GET /api/bookings/:id/location` (only when socket disconnected).
3. `CallProvider.tsx:1184`: `setInterval(pollActiveCalls, 60000)` -> `GET /api/calls/active` (only when socket disconnected).
4. `CallProvider.tsx:412 & 873 & 1226`: `setTimeout(..., 45000)` -> `POST /api/calls/:id/timeout` (ring timeout trigger).
5. `bookings/page.tsx:114`: `setInterval(fetchBookings, 60000)` -> `GET /api/bookings` (only when socket disconnected).
6. `bookings/[id]/page.tsx:105`: `setInterval(fetchBookingDetail, 60000)` -> `GET /api/bookings/:id` (only when socket disconnected).
7. `provider/bookings/page.tsx:114`: `setInterval(fetchProviderBookings, 60000)` -> `GET /api/provider/bookings` (only when socket disconnected).
8. `provider/bookings/[id]/page.tsx:105`: `setInterval(fetchProviderBookings, 60000)` -> `GET /api/bookings/:id` (only when socket disconnected).
9. `provider/messages/page.tsx:68`: `setInterval(fetchConversations, 60000)` -> `GET /api/chat/conversations` (only when socket disconnected).

---

## 3. Every DB-Producing Timer
1. `backend/server.js:886`: `setInterval(runStaleCallCleanup, 5000)` executes `UPDATE calls ... WHERE status IN ('INITIATED', 'RINGING')`.
2. Any REST fallback timer when client is disconnected from Socket.IO queries PostgreSQL (`bookings`, `conversations`, `calls`).

---

## 4. All Socket.IO Instances
1. **Chat / App Socket:** Singleton in `frontend/src/lib/socketChat.ts`:
   - `chatSocket = io(serverUrl, { autoConnect: Boolean(token), transports: ["websocket", "polling"], auth: { token, userId } })`
   - Shared across chat, customer tracking, booking status sync, and live location broadcasting via `frontend/src/lib/socket.ts:getSocket()`.
2. **Call Signaling Socket:** Managed in `frontend/src/components/calls/CallProvider.tsx:536`:
   - `const socket = io(signalingUrl, { path: "/socket.io", auth: { token } })`
   - Dedicated signaling socket instance for WebRTC/LiveKit call negotiations.
3. **Backend Signaling Server:** Hosted in `backend/server.js`:
   - `const io = new Server(server, { cors: { origin: ... } })`

---

## 5. All `socket.connect()` Calls
1. `frontend/src/lib/socketChat.ts:80`: `chatSocket.connect()` on user ID change when token is valid.
2. `frontend/src/lib/socketChat.ts:86`: `chatSocket.connect()` when token becomes available and socket is disconnected.
3. `frontend/src/hooks/useLiveLocationBroadcast.ts:407`: `curSocket.connect()` when starting provider location broadcast if disconnected.

---

## 6. authFetch Architecture
- **Location:** `frontend/src/lib/authFetch.ts`
- **Current Behavior:** Reads token via `getClientToken()`. Injects `Authorization: Bearer <token>` and `credentials: "include"`. Dispatches `auth:expired` on HTTP 401.
- **Required Hardening:** Default parameter `options?: { protected?: boolean }` (default `true`). For protected calls, if `!token`, reject immediately without firing an unauthenticated network request. On session expiry, disconnect chat socket via `disconnectChatSocket()`.

---

## 7. Protected Frontend Fetches
- `/api/bookings` (`GET`, `POST`)
- `/api/bookings/:id` (`GET`, `PATCH`, `DELETE`)
- `/api/bookings/:id/reviews` (`POST`, `GET`)
- `/api/bookings/:id/report` (`POST`)
- `/api/provider/bookings` (`GET`)
- `/api/provider/availability` (`GET`, `POST`)
- `/api/provider/profile` (`GET`, `PUT`)
- `/api/notifications` (`GET`, `PATCH`)
- `/api/chat/conversations` (`GET`, `POST`)
- `/api/chat/conversations/:id/messages` (`GET`, `POST`)
- `/api/calls` (`GET`, `POST`)
- `/api/calls/:id` (`GET`)
- `/api/calls/:id/accept`, `reject`, `end`, `timeout` (`POST`)
- `/api/push/subscribe` (`POST`)
- `/api/jobprovider/*` (`GET`, `POST`, `PUT`, `DELETE`)

---

## 8. `x-user-id` Usage
- Attached as a fallback metadata header in:
  - `frontend/src/app/book/page.tsx:169`
  - `frontend/src/app/bookings/page.tsx:73`
  - `frontend/src/app/bookings/[id]/page.tsx:267`
  - `frontend/src/app/provider/bookings/[id]/page.tsx:225`
  - `frontend/src/app/provider/profile/page.tsx:190`
  - `frontend/src/components/calls/CallProvider.tsx:115`
  - `frontend/src/components/chat/ChatButton.tsx:68`
  - `frontend/src/components/location/CustomerTrackingMap.tsx:276`
  - `frontend/src/components/notifications/NotificationBell.tsx:57, 182, 197, 251`
  - `frontend/src/store/useAuthStore.ts:344, 426`
  - `frontend/src/store/useProviderStore.ts:158, 201, 241, 284, 325`
- **Security Check:** Backend authenticates identity via verified JWT tokens. `x-user-id` is never trusted for authorization.

---

## 9. Service Worker Behavior
- **File:** `frontend/public/sw.js`
- **Syntax Check:** `node --check frontend/public/sw.js` exits with code 0.
- **Private API Bypass:** Lines 51-60 return early for `/api/`, `socket.io`, `/auth/`, `/livekit` without invoking `event.respondWith()`.
- **Push Notification Handling:** Handles `call:incoming`, `call:cancelled`, `call:ended`, `chat:message`, and general notifications.

---

## 10. Database Pool Instances
1. **Next.js App Pool (`frontend/src/lib/db.ts`)**:
   - Singleton attached to `globalThis.postgresPool`.
   - Code default: `max: Number(process.env.DB_POOL_MAX || 5)`. (Hardening will raise code default to `25`).
   - Idle timeout: `10000ms`.
   - Connection timeout: `10000ms`.
2. **Backend Server Pool (`backend/server.js:83`)**:
   - `const pool = new Pool({ connectionString: DATABASE_URL })` (pg default: 10 connections).
3. **Database Capacity:** PostgreSQL `max_connections` is 100.

---

## 11. Stale-Call Cleanup
- **File:** `backend/server.js:826-886`
- **Current Behavior:** Executes `setInterval(runStaleCallCleanup, 5000)` running unbatched `UPDATE calls SET status = 'MISSED' ...`.
- **Required Hardening:** Change interval to `15000ms`, add `WITH stale AS (SELECT id FROM calls ... ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED)`.

---

## 12. Reverse-Geocode Behavior
- **File:** `frontend/src/app/api/location/reverse-geocode/route.ts`
- **Current Behavior:** Contains 2000-entry in-memory LRU cache, 4-decimal place rounded coordinates (~11m resolution), and in-flight promise deduplication.
- **Fallback:** On upstream rate-limiting or network outage, preserves coordinates with `{ success: true, unavailable: true, address: "Location (lat, lng)", ... }` (HTTP 200) without throwing 500/502 errors.

---

## 13. Push Subscription Flow
- Implemented in `frontend/src/lib/registerSW.ts:registerAndSubscribeUser`.
- Guards: Checks `getClientToken()`; if token is absent, subscription is skipped.
- Error handling: On 401, calls `triggerAuthExpired()` to halt further retries.

---

## 14. Booking Schema Status
- Verified columns in `bookings`:
  - `cancellation_reason` (text)
  - `cancellation_note` (text)
  - `cancelled_by` (character varying)
  - `cancelled_at` (timestamp with time zone)
- Migrations 019 and 020 applied. Queries in `/api/bookings` execute with HTTP 200.

---

## 15. Pagination
- `/api/jobs`: Supports `page` and `limit`.
- `/api/bookings`: Filtered by authenticated customer or provider.
- `/api/notifications`: Scoped to authenticated user.
- `/api/chat/conversations`: Scoped to participants.

---

## 16. Rate Limiting
- Managed in `frontend/src/lib/rateLimit.ts` via in-memory sliding window:
  - `/api/auth/login`: 5 req / 5 min
  - `/api/auth/register`: 5 req / 5 min
  - `/api/auth/forgot-password`: 5 req / 15 min
  - `/api/auth/reset-password`: 3 req / 5 min
  - `/api/auth/verify-reset-otp`: 5 req / 5 min
  - `/api/calls`: 1 req / min per user
- Note: In-memory store is per-process and non-distributed.

---

## 17. Current k6 Thresholds
- `unexpected_failures: ["rate<0.01"]` (< 1.0%)
- `server_errors_5xx: ["rate<0.005"]` (< 0.5%)
- `http_req_duration: ["p(95)<2000", "p(99)<5000"]`

---

## 18. Load-Test Duration
- Current smoke mode: 10s ramp, 30s steady, 5s ramp down (45s total).
- Required validation mode: 1m ramp, 5m steady, 1m ramp down (7m total).
- Final 300-user validation: 1m ramp, 10m steady, 1m ramp down (12m total).
