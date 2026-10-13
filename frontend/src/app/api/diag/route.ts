import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envKeys = Object.keys(process.env).map((k) => {
    // Only return variable names, never values
    return k;
  });

  const dbKeysFound = envKeys.filter((k) =>
    k.toUpperCase().includes("DATABASE") ||
    k.toUpperCase().includes("POSTGRES") ||
    k.toUpperCase().includes("PG")
  );

  const jwtKeysFound = envKeys.filter((k) =>
    k.toUpperCase().includes("JWT") ||
    k.toUpperCase().includes("SECRET") ||
    k.toUpperCase().includes("AUTH")
  );

  return NextResponse.json({
    status: "ok",
    hasDatabaseUrl: Boolean(
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URI ||
      process.env.POSTGRESQL_URL
    ),
    hasJwtSecret: Boolean(
      process.env.JWT_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTH_SECRET
    ),
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    nodeEnv: process.env.NODE_ENV || "unknown",
    dbKeysFound,
    jwtKeysFound,
  });
}
