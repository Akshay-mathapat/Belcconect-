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

  const detectedDbKey = Object.entries(process.env).find(
    ([_, v]) => typeof v === "string" && (v.startsWith("postgresql://") || v.startsWith("postgres://"))
  )?.[0] || null;

  const customEnvKeys = envKeys
    .filter(
      (k) =>
        !k.startsWith("npm_") &&
        !k.startsWith("__") &&
        !k.startsWith("VERCEL_") &&
        !k.startsWith("NODE_") &&
        !k.startsWith("AWS_") &&
        !k.startsWith("PATH") &&
        !k.startsWith("SHELL") &&
        !k.startsWith("HOME")
    )
    .sort();

  return NextResponse.json({
    status: "ok",
    hasDatabaseUrl: Boolean(
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URI ||
      process.env.POSTGRESQL_URL ||
      detectedDbKey
    ),
    detectedDbKey,
    hasJwtSecret: Boolean(
      process.env.JWT_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTH_SECRET
    ),
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    nodeEnv: process.env.NODE_ENV || "unknown",
    dbKeysFound,
    jwtKeysFound,
    customEnvKeys,
  });
}

