/**
 * BelConnect - Production Auth Observability & Structured Logging
 * 
 * Emits NDJSON formatted log lines for security audits and telemetry:
 * - Sanitized / masked user identifiers (never logs tokens, hashes, passwords, OTPs)
 * - Distinct event codes for login, session creation, revocation, validation failures
 * - Aggregated rolling minute metrics for legacy fallback count, 503 errors, and latency
 */

export type AuthEventCode =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "SESSION_CREATED"
  | "SESSION_REVOKED"
  | "ALL_SESSIONS_REVOKED"
  | "VALIDATE_SUCCESS"
  | "VALIDATE_FAILED"
  | "LEGACY_FALLBACK_USED"
  | "NATIVE_SESSION_ISSUED"
  | "RATE_LIMIT_BLOCKED"
  | "DB_UNAVAILABLE";

export type ValidationFailureReason =
  | "missing_token"
  | "invalid_hash"
  | "revoked"
  | "idle_expired"
  | "absolute_expired"
  | "suspended"
  | "deleted_user"
  | "admin_role_rejected"
  | "disallowed_route"
  | "db_error";

export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export interface LogAuthEventParams {
  event: AuthEventCode;
  requestId?: string;
  userId?: string | null;
  role?: string | null;
  email?: string | null;
  client?: string | null;
  route?: string | null;
  method?: string | null;
  reason?: ValidationFailureReason | string;
  durationMs?: number;
  ip?: string | null;
  details?: Record<string, unknown>;
}

// Rolling 1-minute metrics accumulator
interface MinuteMetrics {
  minuteTimestamp: number;
  legacyFallbackCount: number;
  dbError503Count: number;
  validationCount: number;
  totalValidationLatencyMs: number;
}

let currentMinuteMetrics: MinuteMetrics = {
  minuteTimestamp: Math.floor(Date.now() / 60000) * 60000,
  legacyFallbackCount: 0,
  dbError503Count: 0,
  validationCount: 0,
  totalValidationLatencyMs: 0
};

function flushMinuteMetricsIfNeeded() {
  const nowMinute = Math.floor(Date.now() / 60000) * 60000;
  if (nowMinute > currentMinuteMetrics.minuteTimestamp) {
    if (
      currentMinuteMetrics.legacyFallbackCount > 0 ||
      currentMinuteMetrics.dbError503Count > 0 ||
      currentMinuteMetrics.validationCount > 0
    ) {
      const avgLatency =
        currentMinuteMetrics.validationCount > 0
          ? Math.round(currentMinuteMetrics.totalValidationLatencyMs / currentMinuteMetrics.validationCount)
          : 0;

      console.info(
        JSON.stringify({
          tag: "AUTH_METRICS_MINUTE",
          minute: new Date(currentMinuteMetrics.minuteTimestamp).toISOString(),
          legacyFallbackCount: currentMinuteMetrics.legacyFallbackCount,
          dbError503Count: currentMinuteMetrics.dbError503Count,
          validationCount: currentMinuteMetrics.validationCount,
          avgLatencyMs: avgLatency
        })
      );
    }

    currentMinuteMetrics = {
      minuteTimestamp: nowMinute,
      legacyFallbackCount: 0,
      dbError503Count: 0,
      validationCount: 0,
      totalValidationLatencyMs: 0
    };
  }
}

/**
 * Emits a structured JSON log line for an authentication or security event.
 */
export function logAuthEvent(params: LogAuthEventParams) {
  flushMinuteMetricsIfNeeded();

  // Update minute counters
  if (params.event === "LEGACY_FALLBACK_USED") {
    currentMinuteMetrics.legacyFallbackCount++;
  }
  if (params.event === "DB_UNAVAILABLE" || params.reason === "db_error") {
    currentMinuteMetrics.dbError503Count++;
  }
  if (params.durationMs && typeof params.durationMs === "number") {
    currentMinuteMetrics.validationCount++;
    currentMinuteMetrics.totalValidationLatencyMs += params.durationMs;
  }

  const payload = {
    tag: "AUTH_EVENT",
    event: params.event,
    timestamp: new Date().toISOString(),
    requestId: params.requestId || undefined,
    userId: params.userId || undefined,
    role: params.role || undefined,
    email: params.email ? maskEmail(params.email) : undefined,
    client: params.client || undefined,
    route: params.route || undefined,
    method: params.method || undefined,
    reason: params.reason || undefined,
    durationMs: params.durationMs !== undefined ? Math.round(params.durationMs * 100) / 100 : undefined,
    details: params.details || undefined
  };

  if (params.event === "VALIDATE_FAILED" || params.event === "LOGIN_FAILED" || params.event === "DB_UNAVAILABLE") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

