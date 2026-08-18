import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Query real service provider from PostgreSQL
    const providerRes = await query(
      "SELECT id, name, email, phone, avatar FROM service_providers WHERE id = $1",
      [id]
    );

    if (providerRes.rows.length === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const provider = providerRes.rows[0];

    // Query real registered services for this provider from PostgreSQL
    const servicesRes = await query(
      "SELECT id, name, category, description, is_available FROM services WHERE provider_id = $1",
      [id]
    );

    // Query real completed booking ratings & reviews for this provider from PostgreSQL
    const reviewsRes = await query(
      `SELECT 
        b.rating, 
        b.review_comment AS comment, 
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

    // Compute average rating from real database reviews
    const reviews = reviewsRes.rows;
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : "0.0";

    return NextResponse.json({
      provider: {
        id: provider.id,
        name: provider.name,
        phone: provider.phone || "+91 98765 00000",
        email: provider.email,
        avatar: provider.avatar || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=200&q=80",
        experience: 4,
        bio: "Certified service professional registered in Belagavi.",
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
