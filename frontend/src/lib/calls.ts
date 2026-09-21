import { query } from "@/lib/db";

export type CallStatus =
  | "INITIATED"
  | "RINGING"
  | "ACCEPTED"
  | "CONNECTED"
  | "ENDED"
  | "REJECTED"
  | "MISSED"
  | "FAILED"
  | "CANCELLED"
  | "BUSY";

export type CallEndReason =
  | "ended"
  | "declined"
  | "cancelled"
  | "missed"
  | "timeout"
  | "connection_failed";

export type CallParticipantRole = "customer" | "provider";

export interface CallRecord {
  id: string;
  callerId: string;
  receiverId: string;
  bookingId: string;
  status: CallStatus;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds: number;
  createdAt: string;
  callerName?: string;
  callerAvatar?: string;
  receiverName?: string;
  receiverAvatar?: string;
  serviceName?: string;
  endReason?: CallEndReason | null;
  endedByUserId?: string | null;
  endedByRole?: CallParticipantRole | null;
}

function generateCallId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `call-${crypto.randomUUID()}`;
  }
  return `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function createCallRecord(
  callerId: string,
  receiverId: string,
  bookingId: string
): Promise<CallRecord> {
  const id = generateCallId();
  const res = await query(
    `INSERT INTO calls (id, caller_id, receiver_id, booking_id, status)
     VALUES ($1, $2, $3, $4, 'INITIATED')
     RETURNING *`,
    [id, callerId, receiverId, bookingId]
  );

  const row = res.rows[0];
  return mapRowToCallRecord(row);
}

export async function getCallById(callId: string): Promise<CallRecord | null> {
  const res = await query(
    `SELECT c.*, 
            b.service_name,
            COALESCE(cust.name, sp.name, jp.name, 'User') as caller_name,
            COALESCE(cust.avatar, sp.avatar, jp.avatar) as caller_avatar,
            COALESCE(rcust.name, rsp.name, rjp.name, 'User') as receiver_name,
            COALESCE(rcust.avatar, rsp.avatar, rjp.avatar) as receiver_avatar
     FROM calls c
     LEFT JOIN bookings b ON c.booking_id = b.id
     LEFT JOIN customers cust ON c.caller_id = cust.id
     LEFT JOIN service_providers sp ON c.caller_id = sp.id
     LEFT JOIN job_providers jp ON c.caller_id = jp.id
     LEFT JOIN customers rcust ON c.receiver_id = rcust.id
     LEFT JOIN service_providers rsp ON c.receiver_id = rsp.id
     LEFT JOIN job_providers rjp ON c.receiver_id = rjp.id
     WHERE c.id = $1`,
    [callId]
  );

  if (res.rows.length === 0) return null;
  return mapRowToCallRecord(res.rows[0]);
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus,
  extra?: {
    answeredAt?: Date;
    endedAt?: Date;
    durationSeconds?: number;
    endReason?: CallEndReason;
    endedByUserId?: string;
    endedByRole?: CallParticipantRole;
  }
): Promise<CallRecord | null> {
  const current = await getCallById(callId);
  if (!current) return null;

  // Idempotency: if call is already in a terminal status, do not overwrite the original terminal state
  const terminalStatuses: CallStatus[] = ["ENDED", "REJECTED", "MISSED", "CANCELLED", "FAILED", "BUSY"];
  const isCurrentlyTerminal = terminalStatuses.includes(current.status);
  if (isCurrentlyTerminal) {
    return current;
  }

  let answeredAt = extra?.answeredAt ? extra.answeredAt.toISOString() : current.answeredAt;
  let endedAt = extra?.endedAt ? extra.endedAt.toISOString() : current.endedAt;
  let durationSeconds = extra?.durationSeconds ?? current.durationSeconds;
  let endReason = extra?.endReason ?? current.endReason ?? null;
  let endedByUserId = extra?.endedByUserId ?? current.endedByUserId ?? null;
  let endedByRole = extra?.endedByRole ?? current.endedByRole ?? null;

  if (status === "ACCEPTED" && !answeredAt) {
    answeredAt = new Date().toISOString();
  }

  const isTransitioningToTerminal = terminalStatuses.includes(status);
  if (isTransitioningToTerminal && !endedAt) {
    endedAt = new Date().toISOString();
  }

  // Duration is strictly calculated as acceptedAt (answeredAt) -> endedAt
  if (answeredAt && endedAt) {
    const startMs = new Date(answeredAt).getTime();
    const endMs = new Date(endedAt).getTime();
    durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  } else if (isTransitioningToTerminal && !answeredAt) {
    durationSeconds = 0;
  }

  const res = await query(
    `UPDATE calls 
     SET status = $1, 
         answered_at = COALESCE($2, answered_at),
         ended_at = COALESCE($3, ended_at),
         duration_seconds = $4,
         end_reason = COALESCE($5, end_reason),
         ended_by_user_id = COALESCE($6, ended_by_user_id),
         ended_by_role = COALESCE($7, ended_by_role)
     WHERE id = $8
     RETURNING *`,
    [status, answeredAt, endedAt, durationSeconds, endReason, endedByUserId, endedByRole, callId]
  );

  if (res.rows.length === 0) return null;
  return getCallById(callId);
}

export async function getActiveCallForBooking(bookingId: string, maxAgeSeconds = 60): Promise<CallRecord | null> {
  const res = await query(
    `SELECT id FROM calls 
     WHERE booking_id = $1 
       AND status IN ('INITIATED', 'RINGING', 'ACCEPTED', 'CONNECTED')
       AND created_at >= NOW() - INTERVAL '${maxAgeSeconds} seconds'
     ORDER BY created_at DESC 
     LIMIT 1`,
    [bookingId]
  );

  if (res.rows.length === 0) return null;
  return getCallById(res.rows[0].id);
}

export async function getActiveCallForUser(userId: string): Promise<CallRecord | null> {
  if (!userId) return null;

  const res = await query(
    `SELECT id FROM calls 
     WHERE (caller_id = $1 OR receiver_id = $1)
       AND (
         (status IN ('INITIATED', 'RINGING') AND created_at >= NOW() - INTERVAL '60 seconds')
         (status IN ('INITIATED', 'RINGING') AND created_at >= NOW() - INTERVAL '45 seconds')
         OR
         (status IN ('ACCEPTED', 'CONNECTED') AND ended_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours')
       )
     ORDER BY created_at DESC 
     LIMIT 1`,
    [userId]
  );

  if (res.rows.length === 0) return null;
  return getCallById(res.rows[0].id);
}

export async function getRecentTerminalCallForUser(userId: string, secondsAgo = 20): Promise<CallRecord | null> {
  if (!userId) return null;
  const safeSeconds = Math.max(1, Math.min(60, Number(secondsAgo) || 20));
  const res = await query(
    `SELECT id FROM calls 
     WHERE (caller_id = $1 OR receiver_id = $1)
       AND status IN ('REJECTED', 'CANCELLED', 'ENDED', 'MISSED', 'BUSY', 'FAILED')
       AND (ended_at >= NOW() - ($2 || ' seconds')::INTERVAL OR created_at >= NOW() - ($2 || ' seconds')::INTERVAL)
     ORDER BY COALESCE(ended_at, created_at) DESC 
     LIMIT 1`,
    [userId, safeSeconds.toString()]
  );

  if (res.rows.length === 0) return null;
  return getCallById(res.rows[0].id);
}

export async function checkUserBusy(userId: string): Promise<boolean> {
  if (!userId) return false;
  const active = await getActiveCallForUser(userId);
  return !!active;
}


export async function getCallHistoryForUser(userId: string): Promise<CallRecord[]> {
  const res = await query(
    `SELECT c.id
     FROM calls c
     WHERE c.caller_id = $1 OR c.receiver_id = $1
     ORDER BY c.created_at DESC
     LIMIT 50`,
    [userId]
  );

  const records: CallRecord[] = [];
  for (const row of res.rows) {
    const rec = await getCallById(row.id);
    if (rec) records.push(rec);
  }
  return records;
}

export async function getUserRateLimitCount(userId: string, windowHours = 1): Promise<number> {
  const res = await query(
    `SELECT COUNT(*) as count 
     FROM calls 
     WHERE caller_id = $1 
       AND created_at >= NOW() - INTERVAL '${windowHours} hour'`,
    [userId]
  );
  return parseInt(res.rows[0]?.count || "0", 10);
}

export async function acceptCall(callId: string): Promise<{ success: boolean; call: CallRecord | null; error?: string }> {
  if (!callId) return { success: false, call: null, error: "Missing callId" };

  const res = await query(
    `UPDATE calls
     SET status = 'ACCEPTED',
         answered_at = NOW()
     WHERE id = $1
       AND status IN ('INITIATED', 'RINGING')
     RETURNING id`,
    [callId]
  );

  if (res.rows.length > 0) {
    const updated = await getCallById(callId);
    return { success: true, call: updated };
  }

  const current = await getCallById(callId);
  if (!current) {
    return { success: false, call: null, error: "Call not found" };
  }

  if (current.status === "ACCEPTED" || current.status === "CONNECTED") {
    return { success: true, call: current };
  }

  return {
    success: false,
    call: current,
    error: `Cannot accept call in status '${current.status}'`
  };
}

export async function timeoutCall(callId: string): Promise<CallRecord | null> {
  if (!callId) return null;
  const res = await query(
    `UPDATE calls
     SET status = 'MISSED',
         end_reason = 'timeout',
         ended_at = NOW(),
         duration_seconds = 0
     WHERE id = $1
       AND status IN ('INITIATED', 'RINGING')
     RETURNING id`,
    [callId]
  );
  if (res.rows.length === 0) return null;
  return getCallById(callId);
}

export async function autoExpireStaleCalls(timeoutSeconds = 45): Promise<CallRecord[]> {
  const res = await query(
    `UPDATE calls
     SET status = 'MISSED',
         ended_at = NOW()
         end_reason = 'timeout',
         ended_at = NOW(),
         duration_seconds = 0
     WHERE status IN ('INITIATED', 'RINGING')
       AND created_at <= NOW() - INTERVAL '${timeoutSeconds} seconds'
     RETURNING id`,
    []
  );

  const expiredRecords: CallRecord[] = [];
  for (const row of res.rows) {
    const rec = await getCallById(row.id);
    if (rec) expiredRecords.push(rec);
  }
  return expiredRecords;
}

export const autoExpireRingingCalls = autoExpireStaleCalls;

export async function createCallReport(callId: string, reporterId: string, reason: string): Promise<boolean> {
  const reportId = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await query(
    `INSERT INTO call_reports (id, call_id, reporter_id, reason)
     VALUES ($1, $2, $3, $4)`,
    [reportId, callId, reporterId, reason]
  );
  return true;
}

function mapRowToCallRecord(row: any): CallRecord {
  return {
    id: row.id,
    callerId: row.caller_id,
    receiverId: row.receiver_id,
    bookingId: row.booking_id,
    status: row.status as CallStatus,
    startedAt: row.started_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
    durationSeconds: parseInt(row.duration_seconds || "0", 10),
    createdAt: row.created_at,
    callerName: row.caller_name,
    callerAvatar: row.caller_avatar,
    receiverName: row.receiver_name,
    receiverAvatar: row.receiver_avatar,
    serviceName: row.service_name,
    endReason: row.end_reason as CallEndReason | null,
    endedByUserId: row.ended_by_user_id || null,
    endedByRole: row.ended_by_role as CallParticipantRole | null,
  };
}
