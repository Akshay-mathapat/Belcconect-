import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendPushToUser } from "@/lib/pushNotifications";
import { sendBookingConfirmationSms } from "@/lib/sms/smsService";

const parseCoord = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
};

// Helper to map DB row to Frontend Booking type
function mapRowToBooking(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    customerName: row.customer_name || "Customer",
    customerPhone: row.customer_phone || "",
    customerPhoto: row.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    serviceName: row.service_name,
    category: row.category,
    date: row.date,
    time: row.time,
    address: row.address || "No address provided",
    status: row.status,
    providerName: row.provider_name || "Verified Expert",
    uploadedImages: [],
    rating: row.rating,
    reviewComment: row.review_comment || "",
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
    customerLocationAccuracy: parseCoord(row.customer_location_accuracy)
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 1. Enforce authentication via JWT session token
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const res = await query(
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
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingRow = res.rows[0];

    // 2. Enforce server-side authorization: only assigned customer, assigned provider, or admin
    const isCustomer = authUser.userId === bookingRow.customer_id;
    const isProvider = authUser.userId === bookingRow.provider_id;
    const isAdmin = authUser.role === "admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this booking" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, booking: mapRowToBooking(bookingRow) });
  } catch (error: any) {
    console.error(`Error fetching booking ${id}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 1. Enforce authentication via JWT session token
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, date, time, rating, reviewComment } = body;

    // Check if booking exists and fetch previous record
    const checkRes = await query("SELECT * FROM bookings WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const previousBooking = checkRes.rows[0];
    const previousStatus = previousBooking.status;
    const customerId = previousBooking.customer_id;
    const providerId = previousBooking.provider_id;

    // 2. Enforce server-side authorization
    const isCustomer = authUser.userId === customerId;
    const isProvider = authUser.userId === providerId;
    const isAdmin = authUser.role === "admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to update this booking" },
        { status: 403 }
      );
    }

    // Role-specific field & status constraints
    if (isCustomer && !isAdmin && !isProvider) {
      // Customer may only cancel eligible bookings or submit/update ratings and reviews
      if (status !== undefined && status !== "Cancelled" && status !== "ReviewSubmitted") {
        return NextResponse.json(
          { error: "Forbidden: Customers are only permitted to cancel their booking or submit reviews" },
          { status: 403 }
        );
      }
    }

    if (isProvider && !isAdmin && !isCustomer) {
      // Provider may update status to Accepted, OnTheWay, Started, Completed, Cancelled, Rejected
      const ALLOWED_PROVIDER_STATUSES = ["Accepted", "OnTheWay", "Started", "Completed", "Cancelled", "Rejected"];
      if (status !== undefined && !ALLOWED_PROVIDER_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Forbidden: Invalid status '${status}' for service provider` },
          { status: 403 }
        );
      }
    }

    // Strict booking status state machine transition validation
    if (status !== undefined && status !== previousStatus) {
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        Requested: ["Accepted", "Cancelled", "Rejected"],
        Accepted: ["OnTheWay", "Started", "Completed", "Cancelled", "Rejected"],
        OnTheWay: ["Started", "Completed", "Cancelled"],
        Started: ["Completed", "Cancelled"],
        Completed: ["ReviewSubmitted"],
        Cancelled: [],
        Rejected: [],
        ReviewSubmitted: ["ReviewSubmitted"]
      };

      const allowedNext = ALLOWED_TRANSITIONS[previousStatus] ?? [];
      if (!allowedNext.includes(status)) {
        return NextResponse.json(
          { error: `Invalid booking status transition: ${previousStatus} -> ${status}` },
          { status: 400 }
        );
      }
    }

    // Build update parameters dynamically
    let updateFields: string[] = [];
    let queryParams: any[] = [id];
    let paramIndex = 2;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      queryParams.push(status);
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

    // If status genuinely changed to 'Accepted', trigger in-app, push, and SMS notifications fire-and-forget
    if (status === "Accepted" && previousStatus !== "Accepted" && customerId) {
      (async () => {
        try {
          const serviceName = previousBooking.service_name || "Service";
          const dateVal = date || previousBooking.date || "scheduled date";
          const timeVal = time || previousBooking.time || "scheduled time";
          const providerName = previousBooking.provider_name || "Verified Expert";

          const notificationId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const notifTitle = "Booking Confirmed";
          const notifBody = `Your booking for ${serviceName} on ${dateVal} at ${timeVal} has been confirmed by ${providerName}.`;

          // a) Insert row into notifications table
          await query(
            `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
            [notificationId, customerId, 'booking_confirmed', notifTitle, notifBody, id]
          ).catch((e) => console.error("[Notifications] DB insert error:", e));

          // b) Send web push notification (graceful degradation if push fails)
          sendPushToUser(customerId, {
            title: notifTitle,
            body: notifBody,
            data: {
              type: "booking_confirmed",
              bookingId: id,
              url: `/account`
            }
          }).catch((e) => console.error("[Notifications] Push notification dispatch error:", e));

          // c) Send transactional SMS to customer's registered phone number (authoritative DB query, idempotent)
          sendBookingConfirmationSms(id, customerId, {
            bookingId: id,
            serviceName,
            date: dateVal,
            time: timeVal,
            providerName
          }).catch((e) => console.error("[Notifications] Transactional SMS dispatch error:", e));

        } catch (err) {
          console.error("[Notifications] Confirmation trigger exception:", err);
        }
      })();
    }

    const finalRes = await query(
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
        b.destination_latitude,
        b.destination_longitude,
        b.destination_address,
        b.destination_landmark,
        b.destination_instructions,
        b.provider_current_latitude,
        b.provider_current_longitude,
        b.provider_location_updated_at,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.avatar AS customer_photo,
        addr.text AS address
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, text 
        FROM addresses 
        ORDER BY user_id, created_at ASC
      ) addr ON b.customer_id = addr.user_id
      WHERE b.id = $1`,
      [id]
    );

    return NextResponse.json({ 
      success: true, 
      booking: mapRowToBooking(finalRes.rows[0]),
      notification: status === "Accepted" ? { sms: "QUEUED" } : undefined
    });
  } catch (error: any) {
    console.error(`Error updating booking ${id}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const checkRes = await query("SELECT customer_id, provider_id FROM bookings WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = checkRes.rows[0];
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;
    const isAdmin = authUser.role === "admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to delete this booking" },
        { status: 403 }
      );
    }

    const res = await query("DELETE FROM bookings WHERE id = $1 RETURNING id", [id]);
    return NextResponse.json({ success: true, message: "Booking deleted successfully", id });
  } catch (error: any) {
    console.error(`Error deleting booking ${id}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
