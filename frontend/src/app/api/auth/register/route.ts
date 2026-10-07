import { NextResponse } from "next/server";
import { query, hashPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, registerSchema } from "@/lib/validations";

export async function POST(request: Request) {
  // 1. Load-test authorization
  // Only bypass rate limiting when:
  // - LOAD_TEST_MODE=true
  // - LOAD_TEST_SECRET exists
  // - request header exactly matches LOAD_TEST_SECRET
  const loadTestHeader =
    request.headers.get("x-load-test-secret") || "";

  const loadTestEnvSecret =
    process.env.LOAD_TEST_SECRET || "";

  const isLoadTestRequest =
    process.env.LOAD_TEST_MODE === "true" &&
    Boolean(loadTestEnvSecret) &&
    loadTestHeader === loadTestEnvSecret;

  // Temporary debug logging
  // Does not print the actual secret
  console.log("[LOAD_TEST_DEBUG]", {
    mode: process.env.LOAD_TEST_MODE,
    envSecretSet: Boolean(loadTestEnvSecret),
    headerSecretSet: Boolean(loadTestHeader),
    envSecretLength: loadTestEnvSecret.length,
    headerSecretLength: loadTestHeader.length,
    secretMatches: loadTestHeader === loadTestEnvSecret,
    bypassActive: isLoadTestRequest,
  });

  // 2. Normal registration rate limiting
  if (!isLoadTestRequest) {
    const rateLimit = await checkRateLimit(
      request,
      5,
      5 * 60 * 1000
    );

    if (!rateLimit.isAllowed && rateLimit.response) {
      return rateLimit.response;
    }
  }

  try {
    // 3. Validate request body
    const validation = await parseAndValidate(
      request,
      registerSchema
    );

    if (validation.response) {
      return validation.response;
    }

    const {
      email,
      password,
      name,
      phone,
      role,
      avatar,
    } = validation.data;

    const cleanEmail = email.trim().toLowerCase();

    // 4. Check email across all account tables in ONE DB query
    const existingUser = await query(
      `
      SELECT 1
      FROM (
        SELECT email
        FROM customers
        WHERE email = $1

        UNION ALL

        SELECT email
        FROM service_providers
        WHERE email = $1

        UNION ALL

        SELECT email
        FROM job_providers
        WHERE email = $1
      ) AS existing_accounts
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            "An account with this email address already exists. Please login instead.",
        },
        { status: 409 }
      );
    }

    // 5. Generate role-prefixed unique user ID
    let prefix = "cust";

    if (role === "provider") {
      prefix = "prov";
    }

    if (role === "job_provider") {
      prefix = "emp";
    }

    const userId = `${prefix}-${crypto.randomUUID()}`;

    // 6. Hash password
    const hashedPassword = await hashPassword(password);

    // 7. Generate/default avatar
    const defaultAvatar =
      avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        name || cleanEmail
      )}`;

    // 8. Select destination table
    let targetTable = "customers";

    if (role === "provider") {
      targetTable = "service_providers";
    }

    if (role === "job_provider") {
      targetTable = "job_providers";
    }

    // 9. Insert account and immediately return created row
    const userRes = await query(
      `
      INSERT INTO ${targetTable}
        (id, email, name, phone, avatar, password_hash)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        email,
        name,
        phone,
        avatar
      `,
      [
        userId,
        cleanEmail,
        name || cleanEmail.split("@")[0],
        phone || "+91 98765 00000",
        defaultAvatar,
        hashedPassword,
      ]
    );

    const userObj = {
      ...userRes.rows[0],
      role,
      addresses: [],
      bookings: [],
    };

    // 10. Generate JWT
    const token = signJwtToken({
      userId: userObj.id,
      email: userObj.email,
      role: userObj.role,
      name: userObj.name,
    });

    // 11. Return response
    const response = NextResponse.json({
      success: true,
      user: userObj,
      token,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Error in register API:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}