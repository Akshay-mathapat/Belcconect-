import { NextResponse } from "next/server";

// Always run on each request (never serve a cached response)
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "cityconnect-api",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}