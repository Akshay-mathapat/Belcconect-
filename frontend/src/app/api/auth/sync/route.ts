import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

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
    if (authUser.role === "user" || (authUser.role as any) === "customer") {
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

    // Parameterized update scoped strictly to the authenticated user's ID
    const updateRes = await query(
      `UPDATE ${targetTable}
       SET name = COALESCE($1, name), phone = COALESCE($2, phone), avatar = COALESCE($3, avatar)
       WHERE id = $4
       RETURNING id, email, name, phone, avatar`,
      [
        name !== undefined ? name : null,
        phone !== undefined ? phone : null,
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
    const userObj: any = { ...updatedUser, role: authUser.role };

    if (targetTable === "customers") {
      const addrRes = await query("SELECT id, type, text FROM addresses WHERE user_id = $1", [authUser.userId]);
      userObj.addresses = addrRes.rows || [];
    } else {
      userObj.addresses = [];
    }

    return NextResponse.json({ success: true, user: userObj });
  } catch (error: any) {
    console.error("Error syncing auth user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
