import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    const authUser = getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    // Verify booking and participant ownership
    const bookingRes = await query(
      `SELECT id, customer_id, provider_id, status
       FROM bookings
       WHERE (
         id = $1
         OR LOWER(id) = LOWER($1)
         OR id = $2
         OR LOWER(id) = LOWER($2)
       )
       LIMIT 1`,
      [cleanId, rawId]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const booking = bookingRes.rows[0];

    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You are not authorized to view reviews for this booking",
        },
        { status: 403 }
      );
    }

    const reviewsRes = await query(
      `SELECT
         id,
         booking_id,
         reviewer_id,
         reviewer_role,
         reviewee_id,
         reviewee_role,
         rating,
         comment,
         created_at
       FROM booking_reviews
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [booking.id]
    );

    const formattedReviews = reviewsRes.rows.map((r: any) => ({
      id: r.id,
      bookingId: r.booking_id,
      reviewerId: r.reviewer_id,
      reviewerRole: r.reviewer_role,
      revieweeId: r.reviewee_id,
      revieweeRole: r.reviewee_role,
      rating: Number(r.rating),
      comment: r.comment || "",
      createdAt: r.created_at
        ? new Date(r.created_at).toISOString()
        : new Date().toISOString(),
    }));

    // Determine the authenticated participant's own directional review.
    // Both authenticated user ID and expected role must match.
    const userRole = isCustomer ? "customer" : "provider";

    const myReview =
      formattedReviews.find(
        (r: any) =>
          r.reviewerId === authUser.userId &&
          r.reviewerRole === userRole
      ) || null;

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      userReview: myReview,
      hasReviewed: Boolean(myReview),
    });
  } catch (error: any) {
    console.error(
      `Error fetching reviews for booking ${cleanId}:`,
      error
    );

    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    // 1. Authenticate requester
    const authUser = getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    // 2. Fetch booking record
    const bookingRes = await query(
      `SELECT id, customer_id, provider_id, status
       FROM bookings
       WHERE (
         id = $1
         OR LOWER(id) = LOWER($1)
         OR id = $2
         OR LOWER(id) = LOWER($2)
       )
       LIMIT 1`,
      [cleanId, rawId]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const booking = bookingRes.rows[0];
    const canonicalBookingId = booking.id;

    // 3. Participation check:
    // requester must be the customer or provider of this booking.
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        {
          error: "Forbidden: You are not a participant of this booking",
        },
        { status: 403 }
      );
    }

    // 4. Lifecycle check:
    // reviews are allowed only after completion.
    // ReviewSubmitted is retained only for historical compatibility.
    const allowedStatuses = ["Completed", "ReviewSubmitted"];

    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          error:
            `Reviews can only be submitted after the service is Completed ` +
            `(current status: ${booking.status})`,
        },
        { status: 400 }
      );
    }

    // 5. Input validation
    const body = await request.json();
    const { rating, comment } = body;

    const parsedRating = Number(rating);

    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    const cleanComment =
      typeof comment === "string"
        ? comment.trim().slice(0, 1000)
        : "";

    // 6. Derive review identities entirely from authenticated user
    // and the server-side booking record.
    //
    // Never trust reviewer/reviewee IDs or roles from the client.
    const reviewerId = authUser.userId;
    const reviewerRole = isCustomer ? "customer" : "provider";

    const revieweeId = isCustomer
      ? booking.provider_id
      : booking.customer_id;

    const revieweeRole = isCustomer
      ? "provider"
      : "customer";

    if (!revieweeId) {
      return NextResponse.json(
        {
          error:
            "Incomplete booking record: missing reviewee identity",
        },
        { status: 400 }
      );
    }

    // 7. Preliminary duplicate prevention.
    // The database UNIQUE constraint remains the final
    // race-condition protection.
    const duplicateCheck = await query(
      `SELECT id
       FROM booking_reviews
       WHERE booking_id = $1
         AND reviewer_id = $2
         AND reviewee_id = $3
       LIMIT 1`,
      [canonicalBookingId, reviewerId, revieweeId]
    );

    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            "You have already submitted a review for this booking",
        },
        { status: 409 }
      );
    }

    // 8. Insert two-sided review
    const reviewId =
      `rev-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    await query(
      `INSERT INTO booking_reviews (
         id,
         booking_id,
         reviewer_id,
         reviewer_role,
         reviewee_id,
         reviewee_role,
         rating,
         comment
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reviewId,
        canonicalBookingId,
        reviewerId,
        reviewerRole,
        revieweeId,
        revieweeRole,
        parsedRating,
        cleanComment || null,
      ]
    );

    // 9. Backwards compatibility:
    // only customer -> provider reviews update legacy booking rating.
    //
    // Provider -> customer reviews must NOT modify these fields.
    // Booking status remains Completed.
    if (isCustomer) {
      await query(
        `UPDATE bookings
         SET rating = $1,
             review_comment = $2
         WHERE id = $3`,
        [
          parsedRating,
          cleanComment || null,
          canonicalBookingId,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: reviewId,
        bookingId: canonicalBookingId,
        reviewerId,
        reviewerRole,
        revieweeId,
        revieweeRole,
        rating: parsedRating,
        comment: cleanComment,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    // Database UNIQUE constraint race-condition protection
    if (error?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "You have already submitted a review for this booking",
        },
        { status: 409 }
      );
    }

    console.error(
      `Error creating review for booking ${cleanId}:`,
      error
    );

    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}