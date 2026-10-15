import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Query real service provider from PostgreSQL with availability and verification
    const providerRes = await query(
      "SELECT id, name, email, phone, avatar, is_available, is_verified, verification_status FROM service_providers WHERE id = $1",
      [id]
    );

    if (providerRes.rows.length === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const provider = providerRes.rows[0];

    // Authenticate requester: only the provider themselves or admins may see phone and email
    const authUser = getAuthenticatedUser(request);
    const isOwner = Boolean(authUser && authUser.userId === id);
    const isAdmin = Boolean(authUser && authUser.role === "admin");
    const isOwnerOrAdmin = isOwner || isAdmin;

    // Enforce that unverified providers are not publicly accessible
    if (provider.verification_status !== "verified") {
      if (!isOwnerOrAdmin) {
        return NextResponse.json(
          { error: "This service provider profile is pending verification and not yet publicly listed." },
          { status: 403 }
        );
      }
    }

    // Query real registered services for this provider from PostgreSQL
    const servicesRes = await query(
      "SELECT id, name, category, description, is_available FROM services WHERE provider_id = $1",
      [id]
    );

    // Query real completed customer -> provider reviews from booking_reviews with legacy fallback
    let reviews: any[] = [];
    const reviewedBookingIds = new Set<string>();

    try {
      const dbReviewsRes = await query(
        `SELECT
          r.booking_id,
          r.rating,
          r.comment,
          r.created_at,
          b.service_name,
          b.date,
          c.name AS customer_name,
          c.avatar AS customer_photo
        FROM booking_reviews r
        JOIN bookings b ON r.booking_id = b.id
        LEFT JOIN customers c ON r.reviewer_id = c.id
        WHERE r.reviewee_id = $1 AND r.reviewee_role = 'provider'
        ORDER BY r.created_at DESC`,
        [id]
      );
      if (dbReviewsRes.rows.length > 0) {
        reviews = dbReviewsRes.rows;
        for (const rev of dbReviewsRes.rows) {
          if (rev.booking_id) {
            reviewedBookingIds.add(String(rev.booking_id));
          }
        }
      }
    } catch (e) {
      // Table may not exist yet in environments prior to migration 016
    }

    // Include historical legacy bookings with ratings that do NOT already have a booking_reviews row
    try {
      const legacyRes = await query(
        `SELECT
          b.id AS booking_id,
          b.rating,
          b.review_comment AS comment,
          b.created_at,
          b.date,
          b.service_name,
          c.name AS customer_name,
          c.avatar AS customer_photo
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.provider_id = $1 AND b.rating IS NOT NULL AND b.rating > 0
        ORDER BY b.id DESC`,
        [id]
      );
      for (const legacyRow of legacyRes.rows) {
        const bId = String(legacyRow.booking_id);
        if (!reviewedBookingIds.has(bId)) {
          reviews.push(legacyRow);
          reviewedBookingIds.add(bId);
        }
      }
    } catch (e) {
      // Graceful fallback
    }

    // Compute average rating from real database reviews
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
      : "0.0";

    const isVerified = provider.verification_status === "verified";

    // Privacy rule: Only the provider themselves or admins may see email and phone.
    // Public callers and general customers receive null so contact stays inside the app (chat / in-app call).
    const sanitizedPhone = isOwnerOrAdmin ? (provider.phone || null) : null;
    const sanitizedEmail = isOwnerOrAdmin ? (provider.email || null) : null;

    return NextResponse.json({
      provider: {
        id: provider.id,
        name: provider.name,
        phone: sanitizedPhone,
        email: sanitizedEmail,
        avatar: provider.avatar || null,
        experience: null,
        bio: null,
        isAvailable: Boolean(provider.is_available),
        isVerified,
        verificationStatus: provider.verification_status || "unverified",
        rating: Number(avgRating),
        reviewCount: reviews.length
      },
      services: servicesRes.rows,
      reviews: reviews
    });
  } catch (error: any) {
    console.error("Error retrieving provider profile details from PostgreSQL:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
