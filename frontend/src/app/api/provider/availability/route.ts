import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

/**
 * GET /api/provider/availability
 * Fetch current authenticated provider's availability and verification status.
 */
export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required" }, { status: 403 });
    }

    const providerId = authUser.userId;
    const res = await query(
      "SELECT id, is_available, is_verified, verification_status FROM service_providers WHERE id = $1",
      [providerId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Provider not found in database" }, { status: 404 });
    }

    const row = res.rows[0];
    const verificationStatus = row.verification_status || "unverified";
    const isVerified = verificationStatus === "verified";
    return NextResponse.json({
      success: true,
      providerId: row.id,
      isAvailable: Boolean(row.is_available),
      isVerified,
      verificationStatus
    });
  } catch (error: any) {
    console.error("Error fetching provider availability from PostgreSQL:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/provider/availability
 * Update authenticated provider's availability (is_available: true/false).
 * Only the authenticated provider can modify their own status.
 */
export async function PATCH(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { isAvailable } = body;

    if (typeof isAvailable !== "boolean") {
      return NextResponse.json(
        { error: "Invalid payload: 'isAvailable' boolean field is required." },
        { status: 400 }
      );
    }

    // Provider ID is derived strictly from authenticated JWT token — never trusted from client body or params
    const providerId = authUser.userId;

    const updateRes = await query(
      `UPDATE service_providers
       SET is_available = $1
       WHERE id = $2
       RETURNING id, is_available, is_verified, verification_status`,
      [isAvailable, providerId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: "Provider account not found" }, { status: 404 });
    }

    const row = updateRes.rows[0];
    const verificationStatus = row.verification_status || "unverified";
    const isVerified = verificationStatus === "verified";
    return NextResponse.json({
      success: true,
      providerId: row.id,
      isAvailable: Boolean(row.is_available),
      isVerified,
      verificationStatus
    });
  } catch (error: any) {
    console.error("Error updating provider availability in PostgreSQL:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
