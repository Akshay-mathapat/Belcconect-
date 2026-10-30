import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { SERVICE_CATEGORIES } from "@/constants/site";

export const dynamic = "force-dynamic";

/**
 * GET /api/platform/metrics
 * Returns truthful, real-time database counts for platform transparency.
 * No hardcoded or fabricated statistics.
 */
export async function GET() {
  try {
    let reviewsRes: any = { rows: [{ avg_rating: null, review_count: "0" }] };
    const [bookingsRes, providersRes] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM public.bookings WHERE status = 'Completed'"),
      query("SELECT COUNT(*) AS count FROM public.service_providers WHERE verification_status = 'verified' AND is_available = true"),
    ]);

    try {
      reviewsRes = await query("SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) as review_count FROM public.booking_reviews");
    } catch {
      try {
        reviewsRes = await query("SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) as review_count FROM public.reviews");
      } catch {
        // Table not migrated yet; graceful 0 count
      }
    }

    const completedBookings = parseInt(bookingsRes.rows[0]?.count || "0", 10);
    const verifiedProviders = parseInt(providersRes.rows[0]?.count || "0", 10);
    const reviewCount = parseInt(String(reviewsRes.rows[0]?.review_count || "0"), 10);
    const avgRating = reviewCount > 0 && reviewsRes.rows[0]?.avg_rating ? parseFloat(reviewsRes.rows[0].avg_rating) : null;
    const categoryCount = SERVICE_CATEGORIES.length;

    return NextResponse.json({
      completedBookings,
      verifiedProviders,
      avgRating,
      reviewCount,
      categoryCount
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Platform metrics retrieval error:", msg);
    return NextResponse.json({
      completedBookings: 0,
      verifiedProviders: 0,
      avgRating: null,
      reviewCount: 0,
      categoryCount: SERVICE_CATEGORIES.length
    });
  }
}
