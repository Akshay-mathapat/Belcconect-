/**
 * BelConnect Signaling Server - Socket Authentication & Revocation Sweep Module
 * Shared between backend/src/server.js and integration test suites.
 */

const crypto = require("crypto");

/**
 * Creates Socket.IO authentication middleware supporting single-use tickets
 * with atomic PostgreSQL consumption and legacy JWT fallback.
 */
function createSocketAuthMiddleware({ pool, jwt, jwtSecret, acceptLegacy = true }) {
  return async function socketAuthMiddleware(socket, next) {
    const ticket = socket.handshake.auth?.ticket;
    const legacyToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    // 1. Primary Path: Single-use socket ticket (consumed atomically in PostgreSQL)
    if (ticket && typeof ticket === "string" && ticket.trim().length > 0) {
      try {
        const ticketHash = crypto
          .createHash("sha256")
          .update(ticket.trim())
          .digest("hex");

        const ticketSql = `
          DELETE FROM public.socket_tickets st
          USING public.sessions s
          LEFT JOIN public.customers c ON s.role = 'user' AND c.id = s.user_id
          LEFT JOIN public.service_providers sp ON s.role = 'provider' AND sp.id = s.user_id
          LEFT JOIN public.job_providers jp ON s.role = 'job_provider' AND jp.id = s.user_id
          WHERE st.ticket_hash = $1
            AND st.session_id = s.id
            AND st.expires_at > CURRENT_TIMESTAMP
            AND s.revoked_at IS NULL
            AND CURRENT_TIMESTAMP < s.idle_expires_at
            AND CURRENT_TIMESTAMP < s.absolute_expires_at
            AND (
              (s.role = 'user' AND c.account_status = 'active') OR
              (s.role = 'provider' AND sp.account_status = 'active') OR
              (s.role = 'job_provider' AND jp.account_status = 'active') OR
              (s.role = 'admin')
            )
          RETURNING st.session_id, st.user_id, st.role;
        `;

        const result = await pool.query(ticketSql, [ticketHash]);
        if (result.rows && result.rows.length > 0) {
          const row = result.rows[0];
          socket.sessionId = row.session_id;
          socket.userId = String(row.user_id);
          socket.userRole = row.role;
          socket.authType = "ticket";
          return next();
        } else {
          console.warn("[Signaling Server] Connection rejected: Invalid, expired, or already consumed socket ticket");
          return next(new Error("Authentication failed: Invalid or expired socket ticket"));
        }
      } catch (err) {
        console.error("[Signaling Server] Database error validating socket ticket:", err.message);
        return next(new Error("Authentication failed: Internal verification error"));
      }
    }

    // 2. Legacy Fallback Path: JWT (controlled by acceptLegacy flag)
    if (acceptLegacy && legacyToken && jwt && jwtSecret) {
      let decoded = null;
      let lastError = null;

      try {
        const token = legacyToken;
        const JWT_SECRET = jwtSecret;
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        lastError = err;
      }

      if (decoded && decoded.userId) {
        socket.userId = String(decoded.userId);
        socket.userRole = decoded.role;
        socket.authType = "legacy_jwt";
        return next();
      }

      try {
        const unverified = jwt.decode(legacyToken);
        console.warn(`[Signaling Server] Connection rejected (user: ${unverified?.userId || "unknown"}): Legacy token verification failed (${lastError ? lastError.message : "invalid payload"})`);
      } catch (_) {
        console.warn(`[Signaling Server] Connection rejected: Legacy token verification failed (${lastError ? lastError.message : "invalid payload"})`);
      }
      return next(new Error("Authentication failed: Invalid or expired legacy token"));
    }

    console.warn("[Signaling Server] Connection rejected: Missing socket ticket or authentication token");
    return next(new Error("Authentication failed: Missing authentication credentials"));
  };
}

/**
 * Creates the periodic revocation sweep function.
 * Disconnects live ticket-authenticated sockets whose parent session was revoked,
 * idle/absolute expired, or whose user account was suspended in customers, service_providers, or job_providers.
 */
function createRevocationSweep({ io, pool }) {
  return async function runRevokedSessionDisconnectSweep() {
    try {
      const sockets = Array.from(io.sockets.sockets.values());
      const sessionSockets = sockets.filter((s) => s.sessionId && s.authType === "ticket");
      if (sessionSockets.length === 0) return;

      const uniqueSessionIds = [...new Set(sessionSockets.map((s) => s.sessionId))];
      const checkSql = `
        SELECT s.id
        FROM public.sessions s
        LEFT JOIN public.customers c ON s.role = 'user' AND c.id = s.user_id
        LEFT JOIN public.service_providers sp ON s.role = 'provider' AND sp.id = s.user_id
        LEFT JOIN public.job_providers jp ON s.role = 'job_provider' AND jp.id = s.user_id
        WHERE s.id = ANY($1::uuid[])
          AND (
            s.revoked_at IS NOT NULL
            OR CURRENT_TIMESTAMP >= s.idle_expires_at
            OR CURRENT_TIMESTAMP >= s.absolute_expires_at
            OR (s.role = 'user' AND (c.id IS NULL OR c.account_status IS DISTINCT FROM 'active'))
            OR (s.role = 'provider' AND (sp.id IS NULL OR sp.account_status IS DISTINCT FROM 'active'))
            OR (s.role = 'job_provider' AND (jp.id IS NULL OR jp.account_status IS DISTINCT FROM 'active'))
          );
      `;

      const result = await pool.query(checkSql, [uniqueSessionIds]);
      if (result.rows && result.rows.length > 0) {
        const revokedIds = new Set(result.rows.map((r) => r.id));
        for (const s of sessionSockets) {
          if (revokedIds.has(s.sessionId)) {
            console.warn(`[Signaling Server] Disconnecting socket ${s.id} for revoked/expired session ${s.sessionId} (user: ${s.userId})`);
            s.emit("auth:revoked", { reason: "session_revoked" });
            s.disconnect(true);
          }
        }
      }
    } catch (err) {
      console.error("[Signaling Server] Error in revoked session disconnect sweep:", err.message);
    }
  };
}

/**
 * Starts periodic revocation sweep interval.
 * Interval defaults to 30000ms but is env-configurable via SESSION_SWEEP_INTERVAL_MS.
 */
function startRevocationSweepInterval({ io, pool, intervalMs }) {
  const sweepInterval = intervalMs || Number(process.env.SESSION_SWEEP_INTERVAL_MS) || 30000;
  const sweepFn = createRevocationSweep({ io, pool });
  const timer = setInterval(sweepFn, sweepInterval);
  return { timer, sweepFn, intervalMs: sweepInterval };
}

module.exports = {
  createSocketAuthMiddleware,
  createRevocationSweep,
  startRevocationSweepInterval
};
