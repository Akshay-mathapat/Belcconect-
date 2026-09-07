import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // SSE deprecated in favor of Socket.IO real-time signaling layer to eliminate duplicate signaling events.
  return new Response("SSE Endpoint Deprecated: Real-time calling signaling migrated to Socket.IO service.", {
    status: 410,
    headers: { "Content-Type": "text/plain" }
  });
}
