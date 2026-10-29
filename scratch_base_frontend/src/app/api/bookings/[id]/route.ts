import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendPushToUser } from "@/lib/pushNotifications";
import { sendBookingConfirmationSms } from "@/lib/sms/smsService";
import { validateStatusTransition } from "@/lib/bookingLifecycle";
import { throttledExpireStaleBookings, lazyExpireBookingById, getSuggestedProviders } from "@/lib/bookingExpiry";
import crypto from "crypto";

const parseCoord = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
};

// Helper to normalize and sanitize booking IDs
function normalizeBookingId(rawId: string): { raw: string; clean: string } {
  const raw = rawId ? String(rawId) : "";
  let clean = raw;
  try {
    clean = decodeURIComponent(raw);
  } catch {}
  clean = clean.trim().replace(/^#+/, "");
  return { raw, clean };
}

// Helper to map DB row to Frontend Booking type
function mapRowToBooking(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    customerName: row.customer_name || "Customer",
    customerPhone: "",
    customerPhoto: row.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    serviceName: row.service_name,
    category: row.category,
    date: row.date,
    time: row.time,
    address: row.address || "No address provided",
    status: row.status,
    providerName: row.provider_name || "Service Provider",
    uploadedImages: [],
    rating: row.rating,
    reviewComment: row.review_comment || "",
    cancellationReason: row.cancellation_reason || null,
    cancellationNote: row.cancellation_note || null,
    cancelledBy: row.cancelled_by || null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    destinationLatitude: parseCoord(row.destination_latitude),
    destinationLongitude: parseCoord(row.destination_longitude),
    destinationAddress: row.destination_address || null,
    destinationLandmark: row.destination_landmark || null,
    destinationInstructions: row.destination_instructions || null,
    providerCurrentLatitude: parseCoord(row.provider_current_latitude),
    providerCurrentLongitude: parseCoord(row.provider_current_longitude),
    providerLocationUpdatedAt: row.provider_location_updated_at ? new Date(row.provider_location_updated_at).toISOString() : null,
    providerLocationAccuracy: parseCoord(row.provider_location_accuracy),
    customerCurrentLatitude: parseCoord(row.customer_current_latitude),
    customerCurrentLongitude: parseCoord(row.customer_current_longitude),
    customerLocationUpdatedAt: row.customer_location_updated_at ? new Date(row.customer_location_updated_at).toISOString() : null,
    customerLocationAccuracy: parseCoord(row.customer_location_accuracy),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    arrivedAt: row.arrived_at ? new Date(row.arrived_at).toISOString() : null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    expiredAt: row.expired_at ? new Date(row.expired_at).toISOString() : null,
    noShowAt: row.no_show_at ? new Date(row.no_show_at).toISOString() : null,
    noShowType: row.no_show_type || null,
    noShowReason: row.no_show_reason || null,
    noShowReportedBy: row.no_show_reported_by || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    // 1. Enforce authentication via JWT session token
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=GET rawId=${rawId} cleanId=${cleanId} authenticated=false`);
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    // Lazy check: throttled sweep for stale bookings across server instance (at most once per 60s)
    await throttledExpireStaleBookings().catch(() => {});
    // Lazy check: auto-expire if pending for > 10 minutes
    await lazyExpireBookingById(cleanId).catch(() => {});

    let res;
    try {
      res = await query(
        `SELECT
          b.id,
          b.customer_id,
          b.provider_id,
          b.provider_name,
          b.service_name,
          b.category,
          b.date,
          b.time,
          b.status,
          b.rating,
          b.review_comment,
          b.cancellation_reason,
          b.cancellation_note,
          b.cancelled_by,
          b.cancelled_at,
          b.destination_latitude,
          b.destination_longitude,
          b.destination_address,
          b.destination_landmark,
          b.destination_instructions,
          b.provider_current_latitude,
          b.provider_current_longitude,
          b.provider_location_updated_at,
          b.provider_location_accuracy,
          b.customer_current_latitude,
          b.customer_current_longitude,
          b.customer_location_updated_at,
          b.customer_location_accuracy,
          b.accepted_at,
          b.arrived_at,
          b.started_at,
          b.completed_at,
          b.expired_at,
          b.no_show_at,
          b.no_show_type,
          b.no_show_reason,
          b.no_show_reported_by,
          b.created_at,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.avatar AS customer_photo,
          COALESCE(b.destination_address, addr.text, 'No address provided') AS address
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) user_id, text
          FROM addresses
          ORDER BY user_id, created_at ASC
        ) addr ON b.customer_id = addr.user_id
        WHERE (b.id = $1 OR LOWER(b.id) = LOWER($1) OR b.id = $2 OR LOWER(b.id) = LOWER($2))
        LIMIT 1`,
        [cleanId, rawId]
      );
    } catch (queryErr: any) {
      if (queryErr?.code === "42703" || queryErr?.message?.includes("accepted_at")) {
        console.warn("[Bookings] Lifecycle columns missing, using fallback query with NULL lifecycle timestamps");
        res = await query(
          `SELECT
            b.id,
            b.customer_id,
            b.provider_id,
            b.provider_name,
            b.service_name,
            b.category,
            b.date,
            b.time,
            b.status,
            b.rating,
            b.review_comment,
            b.cancellation_reason,
            b.cancellation_note,
            b.cancelled_by,
            b.cancelled_at,
            b.destination_latitude,
            b.destination_longitude,
            b.destination_address,
            b.destination_landmark,
            b.destination_instructions,
            b.provider_current_latitude,
            b.provider_current_longitude,
            b.provider_location_updated_at,
            b.provider_location_accuracy,
            b.customer_current_latitude,
            b.customer_current_longitude,
            b.customer_location_updated_at,
            b.customer_location_accuracy,
            NULL::timestamp with time zone AS accepted_at,
            NULL::timestamp with time zone AS arrived_at,
            NULL::timestamp with time zone AS started_at,
            NULL::timestamp with time zone AS completed_at,
            NULL::timestamp with time zone AS expired_at,
            NULL::timestamp with time zone AS no_show_at,
            NULL::character varying AS no_show_type,
            NULL::text AS no_show_reason,
            NULL::character varying AS no_show_reported_by,
            b.created_at,
            c.name AS customer_name,
            c.phone AS customer_phone,
            c.avatar AS customer_photo,
            COALESCE(b.destination_address, addr.text, 'No address provided') AS address
          FROM bookings b
          LEFT JOIN customers c ON b.customer_id = c.id
          LEFT JOIN (
            SELECT DISTINCT ON (user_id) user_id, text
            FROM addresses
            ORDER BY user_id, created_at ASC
          ) addr ON b.customer_id = addr.user_id
          WHERE (b.id = $1 OR LOWER(b.id) = LOWER($1) OR b.id = $2 OR LOWER(b.id) = LOWER($2))
          LIMIT 1`,
          [cleanId, rawId]
        );
      } else {
        throw queryErr;
      }
    }

    if (res.rows.length === 0) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=GET rawId=${rawId} cleanId=${cleanId} userId=${authUser.userId} role=${authUser.role} found=false`);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingRow = res.rows[0];
    const canonicalId = bookingRow.id;

    // 2. Enforce server-side authorization: only assigned customer, assigned provider, or admin
    const isCustomer = authUser.userId === bookingRow.customer_id;
    const isProvider = authUser.userId === bookingRow.provider_id;
    const isAdmin = authUser.role === "admin";
    const authorized = isCustomer || isProvider || isAdmin;

    console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=GET bookingId=${canonicalId} userId=${authUser.userId} role=${authUser.role} found=true authorized=${authorized}`);

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this booking" },
        { status: 403 }
      );
    }

    const mapped = mapRowToBooking(bookingRow);

    // If booking is expired, attach alternative suggested verified providers
    if (mapped.status === "Expired") {
      const suggestedProviders = await getSuggestedProviders(bookingRow.category, bookingRow.provider_id);
      return NextResponse.json({
        success: true,
        booking: { ...mapped, suggestedProviders }
      });
    }

    return NextResponse.json({ success: true, booking: mapped });
  } catch (error: any) {
    console.error(`Error fetching booking ${cleanId}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    // 1. Enforce authentication via JWT session token
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=PATCH rawId=${rawId} cleanId=${cleanId} authenticated=false`);
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, date, time, rating, reviewComment, cancellationReason, cancellationNote, reason, noShowReason } = body;

    // Check if booking exists and fetch previous record with flexible ID match
    const checkRes = await query(
      "SELECT * FROM bookings WHERE (id = $1 OR LOWER(id) = LOWER($1) OR id = $2 OR LOWER(id) = LOWER($2)) LIMIT 1",
      [cleanId, rawId]
    );
    if (checkRes.rows.length === 0) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=PATCH rawId=${rawId} cleanId=${cleanId} userId=${authUser.userId} role=${authUser.role} found=false`);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const previousBooking = checkRes.rows[0];
    const canonicalId = previousBooking.id;
    const previousStatus = previousBooking.status;
    const customerId = previousBooking.customer_id;
    const providerId = previousBooking.provider_id;

    // 2. Enforce server-side authorization
    const isCustomer = authUser.userId === customerId;
    const isProvider = authUser.userId === providerId;
    const isAdmin = authUser.role === "admin";
    const authorized = isCustomer || isProvider || isAdmin;

    console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=PATCH bookingId=${canonicalId} userId=${authUser.userId} role=${authUser.role} found=true authorized=${authorized}`);

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to update this booking" },
        { status: 403 }
      );
    }

    const userRole = isAdmin ? "admin" : isProvider ? "provider" : "customer";

    // Strict state machine validation & role-based transition checks
    let canonicalStatus = previousStatus;
    if (status !== undefined) {
      const transitionResult = validateStatusTransition(previousStatus, status, userRole, {
        createdAt: previousBooking.created_at,
        acceptedAt: previousBooking.accepted_at,
        arrivedAt: previousBooking.arrived_at
      });

      if (!transitionResult.allowed) {
        return NextResponse.json(
          { error: transitionResult.reason || "Invalid status transition" },
          { status: transitionResult.httpStatus || 400 }
        );
      }
      canonicalStatus = transitionResult.normalizedStatus!;
    }

    // Build update parameters dynamically
    const updateFields: string[] = [];
    const queryParams: any[] = [canonicalId];
    let paramIndex = 2;

    if (status !== undefined && canonicalStatus !== previousStatus) {
      updateFields.push(`status = $${paramIndex++}`);
      queryParams.push(canonicalStatus);

      // 1. Accepted: stamp accepted_at (and validate phone if dummy placeholder, maintaining PHONE_REQUIRED compliance)
      if (canonicalStatus === "Accepted") {
        const proRes = await query("SELECT id, phone FROM service_providers WHERE id = $1 LIMIT 1", [authUser.userId]);
        const proPhone = proRes.rows[0]?.phone;
        if (proPhone && proPhone.includes("98765 00000")) {
          return NextResponse.json(
            {
              error: "A valid mobile number is required before accepting bookings. Please update your profile.",
              code: "PHONE_REQUIRED"
            },
            { status: 400 }
          );
        }
        updateFields.push(`accepted_at = CURRENT_TIMESTAMP`);
      }

      // 2. Arrived: stamp arrived_at
      if (canonicalStatus === "Arrived") {
        updateFields.push(`arrived_at = CURRENT_TIMESTAMP`);
      }

      // 3. Started: stamp started_at
      if (canonicalStatus === "Started") {
        updateFields.push(`started_at = CURRENT_TIMESTAMP`);
      }

      // 4. Completed: stamp completed_at
      if (canonicalStatus === "Completed") {
        updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
      }

      // 5. Cancelled: record actor, reason, note, and timestamp
      if (canonicalStatus === "Cancelled") {
        const ALLOWED_CANCELLATION_REASONS = [
          "Schedule changed",
          "Provider unavailable",
          "Customer unavailable",
          "Booked by mistake",
          "Unable to contact",
          "Other"
        ];

        const rawReason = cancellationReason || reason || "Schedule changed";
        const trimmedReason = typeof rawReason === "string" ? rawReason.trim() : "Other";
        const finalReason = ALLOWED_CANCELLATION_REASONS.includes(trimmedReason) ? trimmedReason : "Other";

        updateFields.push(`cancellation_reason = $${paramIndex++}`);
        queryParams.push(finalReason);

        if (cancellationNote !== undefined && cancellationNote !== null) {
          updateFields.push(`cancellation_note = $${paramIndex++}`);
          queryParams.push(typeof cancellationNote === "string" ? cancellationNote.trim().slice(0, 1000) : null);
        }

        updateFields.push(`cancelled_by = $${paramIndex++}`);
        queryParams.push(authUser.userId);
        updateFields.push(`cancelled_at = CURRENT_TIMESTAMP`);
      }

      // 6. Provider No-Show: customer reports provider did not show up
      if (canonicalStatus === "ProviderNoShow") {
        const finalReason = typeof noShowReason === "string" && noShowReason.trim()
          ? noShowReason.trim()
          : typeof reason === "string" && reason.trim()
          ? reason.trim()
          : "Provider did not arrive within 30 minutes of acceptance";

        updateFields.push(`no_show_at = CURRENT_TIMESTAMP`);
        updateFields.push(`no_show_type = 'provider_no_show'`);
        updateFields.push(`no_show_reported_by = $${paramIndex++}`);
        queryParams.push(authUser.userId);
        updateFields.push(`no_show_reason = $${paramIndex++}`);
        queryParams.push(finalReason);

        // Record reliability penalty on provider
        if (providerId) {
          await query("UPDATE service_providers SET no_show_count = no_show_count + 1 WHERE id = $1", [providerId]).catch(() => {});
        }

        // Audit log for administrator review
        const auditLogId = `audit-${crypto.randomUUID()}`;
        query(
          `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
           VALUES ($1, 'system', 'provider_no_show_reported', 'service_provider', $2, $3)`,
          [auditLogId, providerId || "unknown", JSON.stringify({ bookingId: canonicalId, customerId: authUser.userId, reason: finalReason })]
        ).catch(() => {});
      }

      // 7. Customer No-Show: provider reports customer unavailable after waiting 10 mins
      if (canonicalStatus === "CustomerNoShow") {
        const finalReason = typeof noShowReason === "string" && noShowReason.trim()
          ? noShowReason.trim()
          : typeof reason === "string" && reason.trim()
          ? reason.trim()
          : "Customer unavailable after waiting 10 minutes on-site";

        updateFields.push(`no_show_at = CURRENT_TIMESTAMP`);
        updateFields.push(`no_show_type = 'customer_no_show'`);
        updateFields.push(`no_show_reported_by = $${paramIndex++}`);
        queryParams.push(authUser.userId);
        updateFields.push(`no_show_reason = $${paramIndex++}`);
        queryParams.push(finalReason);

        // Audit log for administrator review
        const auditLogId = `audit-${crypto.randomUUID()}`;
        query(
          `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
           VALUES ($1, 'system', 'customer_no_show_reported', 'customer', $2, $3)`,
          [auditLogId, customerId || "unknown", JSON.stringify({ bookingId: canonicalId, providerId: authUser.userId, reason: finalReason })]
        ).catch(() => {});
      }
    }

    if (date !== undefined) {
      updateFields.push(`date = $${paramIndex++}`);
      queryParams.push(date);
    }

    if (time !== undefined) {
      updateFields.push(`time = $${paramIndex++}`);
      queryParams.push(time);
    }

    if (rating !== undefined) {
      updateFields.push(`rating = $${paramIndex++}`);
      queryParams.push(rating);
    }

    if (reviewComment !== undefined) {
      updateFields.push(`review_comment = $${paramIndex++}`);
      queryParams.push(reviewComment);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updateQuery = `
      UPDATE bookings
      SET ${updateFields.join(", ")}
      WHERE id = $1
      RETURNING *
    `;

    await query(updateQuery, queryParams);

    // Notifications for lifecycle events
    if (canonicalStatus !== previousStatus) {
      void (async () => {
        try {
          const serviceName = previousBooking.service_name || "Service";
          const dateVal = date || previousBooking.date || "scheduled date";
          const timeVal = time || previousBooking.time || "scheduled time";
          const providerName = previousBooking.provider_name || "Service Provider";

          if (canonicalStatus === "Accepted" && customerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "Booking Confirmed";
            const notifBody = `Your booking for ${serviceName} on ${dateVal} at ${timeVal} has been confirmed by ${providerName}.`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, customerId, 'booking_confirmed', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(customerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "booking_confirmed", bookingId: canonicalId, url: `/bookings/${canonicalId}` }
            }).catch(() => {});

            sendBookingConfirmationSms(canonicalId, customerId, {
              bookingId: canonicalId,
              serviceName,
              date: dateVal,
              time: timeVal,
              providerName
            }).catch(() => {});
          } else if (canonicalStatus === "Arrived" && customerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "Provider Arrived";
            const notifBody = `${providerName} has arrived at your location for ${serviceName}.`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, customerId, 'provider_arrived', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(customerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "provider_arrived", bookingId: canonicalId, url: `/bookings/${canonicalId}` }
            }).catch(() => {});
          } else if (canonicalStatus === "Started" && customerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "Service In Progress";
            const notifBody = `${providerName} has started work on ${serviceName}.`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, customerId, 'service_started', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(customerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "service_started", bookingId: canonicalId, url: `/bookings/${canonicalId}` }
            }).catch(() => {});
          } else if (canonicalStatus === "Completed" && customerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "Service Completed";
            const notifBody = `Your service ${serviceName} has been completed. Please rate your experience!`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, customerId, 'service_completed', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(customerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "service_completed", bookingId: canonicalId, url: `/bookings/${canonicalId}` }
            }).catch(() => {});
          } else if (canonicalStatus === "Cancelled") {
            const targetRecipientId = isCustomer ? providerId : customerId;
            if (targetRecipientId) {
              const actorLabel = isCustomer ? "customer" : "service provider";
              const notifId = `notif-${crypto.randomUUID()}`;
              const notifTitle = "Booking Cancelled";
              const notifBody = `Booking #${canonicalId} for ${serviceName} was cancelled by the ${actorLabel}.`;

              await query(
                `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
                 VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
                [notifId, targetRecipientId, 'booking_cancelled', notifTitle, notifBody, canonicalId]
              ).catch(() => {});

              sendPushToUser(targetRecipientId, {
                title: notifTitle,
                body: notifBody,
                data: { type: "booking_cancelled", bookingId: canonicalId, url: isCustomer ? `/provider/bookings/${canonicalId}` : `/bookings/${canonicalId}` }
              }).catch(() => {});
            }
          } else if (canonicalStatus === "ProviderNoShow" && providerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "No-Show Reported";
            const notifBody = `The customer reported a provider no-show for booking #${canonicalId}.`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, providerId, 'provider_no_show', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(providerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "provider_no_show", bookingId: canonicalId, url: `/provider/bookings/${canonicalId}` }
            }).catch(() => {});
          } else if (canonicalStatus === "CustomerNoShow" && customerId) {
            const notifId = `notif-${crypto.randomUUID()}`;
            const notifTitle = "Customer No-Show Reported";
            const notifBody = `The provider reported a customer no-show after waiting on-site for booking #${canonicalId}.`;

            await query(
              `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
              [notifId, customerId, 'customer_no_show', notifTitle, notifBody, canonicalId]
            ).catch(() => {});

            sendPushToUser(customerId, {
              title: notifTitle,
              body: notifBody,
              data: { type: "customer_no_show", bookingId: canonicalId, url: `/bookings/${canonicalId}` }
            }).catch(() => {});
          }
        } catch (err) {
          console.error("[Notifications] Status update trigger exception:", err);
        }
      })();
    }

    let finalRes;
    try {
      finalRes = await query(
        `SELECT
          b.id,
          b.customer_id,
          b.provider_id,
          b.provider_name,
          b.service_name,
          b.category,
          b.date,
          b.time,
          b.status,
          b.rating,
          b.review_comment,
          b.cancellation_reason,
          b.cancellation_note,
          b.cancelled_by,
          b.cancelled_at,
          b.destination_latitude,
          b.destination_longitude,
          b.destination_address,
          b.destination_landmark,
          b.destination_instructions,
          b.provider_current_latitude,
          b.provider_current_longitude,
          b.provider_location_updated_at,
          b.provider_location_accuracy,
          b.customer_current_latitude,
          b.customer_current_longitude,
          b.customer_location_updated_at,
          b.customer_location_accuracy,
          b.accepted_at,
          b.arrived_at,
          b.started_at,
          b.completed_at,
          b.expired_at,
          b.no_show_at,
          b.no_show_type,
          b.no_show_reason,
          b.no_show_reported_by,
          b.created_at,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.avatar AS customer_photo,
          COALESCE(b.destination_address, addr.text, 'No address provided') AS address
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) user_id, text
          FROM addresses
          ORDER BY user_id, created_at ASC
        ) addr ON b.customer_id = addr.user_id
        WHERE b.id = $1`,
        [canonicalId]
      );
    } catch (queryErr: any) {
      if (queryErr?.code === "42703" || queryErr?.message?.includes("accepted_at")) {
        console.warn("[Bookings] Lifecycle columns missing, using fallback query with NULL lifecycle timestamps in PATCH finalRes");
        finalRes = await query(
          `SELECT
            b.id,
            b.customer_id,
            b.provider_id,
            b.provider_name,
            b.service_name,
            b.category,
            b.date,
            b.time,
            b.status,
            b.rating,
            b.review_comment,
            b.cancellation_reason,
            b.cancellation_note,
            b.cancelled_by,
            b.cancelled_at,
            b.destination_latitude,
            b.destination_longitude,
            b.destination_address,
            b.destination_landmark,
            b.destination_instructions,
            b.provider_current_latitude,
            b.provider_current_longitude,
            b.provider_location_updated_at,
            b.provider_location_accuracy,
            b.customer_current_latitude,
            b.customer_current_longitude,
            b.customer_location_updated_at,
            b.customer_location_accuracy,
            NULL::timestamp with time zone AS accepted_at,
            NULL::timestamp with time zone AS arrived_at,
            NULL::timestamp with time zone AS started_at,
            NULL::timestamp with time zone AS completed_at,
            NULL::timestamp with time zone AS expired_at,
            NULL::timestamp with time zone AS no_show_at,
            NULL::character varying AS no_show_type,
            NULL::text AS no_show_reason,
            NULL::character varying AS no_show_reported_by,
            b.created_at,
            c.name AS customer_name,
            c.phone AS customer_phone,
            c.avatar AS customer_photo,
            COALESCE(b.destination_address, addr.text, 'No address provided') AS address
          FROM bookings b
          LEFT JOIN customers c ON b.customer_id = c.id
          LEFT JOIN (
            SELECT DISTINCT ON (user_id) user_id, text
            FROM addresses
            ORDER BY user_id, created_at ASC
          ) addr ON b.customer_id = addr.user_id
          WHERE b.id = $1`,
          [canonicalId]
        );
      } else {
        throw queryErr;
      }
    }

    const updatedRow = finalRes.rows[0];
    const mappedBooking = mapRowToBooking(updatedRow);

    if (mappedBooking.status === "Expired") {
      const suggestedProviders = await getSuggestedProviders(updatedRow.category, updatedRow.provider_id);
      return NextResponse.json({
        success: true,
        booking: { ...mappedBooking, suggestedProviders },
        notification: canonicalStatus === "Accepted" ? { sms: "QUEUED" } : undefined
      });
    }

    return NextResponse.json({
      success: true,
      booking: mappedBooking,
      notification: canonicalStatus === "Accepted" ? { sms: "QUEUED" } : undefined
    });
  } catch (error: any) {
    console.error(`Error updating booking ${cleanId}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=DELETE rawId=${rawId} cleanId=${cleanId} authenticated=false`);
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const checkRes = await query(
      "SELECT id, customer_id, provider_id FROM bookings WHERE (id = $1 OR LOWER(id) = LOWER($1) OR id = $2 OR LOWER(id) = LOWER($2)) LIMIT 1",
      [cleanId, rawId]
    );
    if (checkRes.rows.length === 0) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=DELETE rawId=${rawId} cleanId=${cleanId} userId=${authUser.userId} role=${authUser.role} found=false`);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = checkRes.rows[0];
    const canonicalId = booking.id;
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;
    const isAdmin = authUser.role === "admin";
    const authorized = isCustomer || isProvider || isAdmin;

    console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id] method=DELETE bookingId=${canonicalId} userId=${authUser.userId} role=${authUser.role} found=true authorized=${authorized}`);

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to delete this booking" },
        { status: 403 }
      );
    }

    await query("DELETE FROM bookings WHERE id = $1 RETURNING id", [canonicalId]);
    return NextResponse.json({ success: true, message: "Booking deleted successfully", id: canonicalId });
  } catch (error: any) {
    console.error(`Error deleting booking ${cleanId}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
