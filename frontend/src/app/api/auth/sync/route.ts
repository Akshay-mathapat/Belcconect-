import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { normalizeIndianPhone } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    let targetTable: "customers" | "service_providers" | "job_providers" | null = null;
    if (authUser.role === "user" || (authUser.role as string) === "customer") {
      targetTable = "customers";
    } else if (authUser.role === "provider") {
      targetTable = "service_providers";
    } else if (authUser.role === "job_provider") {
      targetTable = "job_providers";
    }

    if (!targetTable) {
      return NextResponse.json(
        { error: "Forbidden: Unsupported role for profile synchronization" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const payload = body.user || body;
    const { name, phone, avatar } = payload;

    let targetPhone: string | null = null;
    if (phone !== undefined && phone !== null && phone !== "") {
      const normalized = normalizeIndianPhone(phone);
      if (!normalized) {
        return NextResponse.json(
          { error: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9." },
          { status: 400 }
        );
      }

      // Check if phone is already registered to another user across all tables
      const dupCheck = await query(
        `SELECT id FROM customers WHERE phone = $1 AND id != $2
         UNION ALL
         SELECT id FROM service_providers WHERE phone = $1 AND id != $2
         UNION ALL
         SELECT id FROM job_providers WHERE phone = $1 AND id != $2
         LIMIT 1`,
        [normalized, authUser.userId]
      );

      if (dupCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "This mobile number is already registered to another account." },
          { status: 409 }
        );
      }
      targetPhone = normalized;
    }

    // Parameterized update scoped strictly to the authenticated user's ID
    const updateRes = await query(
      `UPDATE ${targetTable}
       SET name = COALESCE($1, name), phone = COALESCE($2, phone), avatar = COALESCE($3, avatar)
       WHERE id = $4
       RETURNING id, email, name, phone, avatar`,
      [
        name !== undefined ? name : null,
        targetPhone !== null ? targetPhone : (phone !== undefined ? null : undefined),
        avatar !== undefined ? avatar : null,
        authUser.userId
      ]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json(
        { error: "User profile not found in target store" },
        { status: 404 }
      );
    }

    const updatedUser = updateRes.rows[0];
    const userObj: Record<string, unknown> = { ...updatedUser, role: authUser.role };

    if (targetTable === "customers") {
      const addrRes = await query("SELECT id, type, text FROM addresses WHERE user_id = $1", [authUser.userId]);
      userObj.addresses = addrRes.rows || [];
    } else {
      userObj.addresses = [];
    }

    return NextResponse.json({ success: true, user: userObj });
  } catch (error: unknown) {
    console.error("Error syncing auth user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
