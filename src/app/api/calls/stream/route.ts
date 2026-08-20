import { NextRequest } from "next/server";
import { callSignaling, SignalingEvent } from "@/lib/callSignaling";
import { autoExpireStaleCalls } from "@/lib/calls";
import { getAuthenticatedUser, verifyJwtToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  let authenticatedUser = getAuthenticatedUser(request);
  if (!authenticatedUser && token) {
    authenticatedUser = verifyJwtToken(token);
  }

  const userId = authenticatedUser?.userId || searchParams.get("userId") || request.headers.get("x-user-id");

  if (!userId) {
    return new Response("Unauthorized: Valid session or userId parameter is required", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: SignalingEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Controller might be closed
        }
      };

      // Subscribe user to signaling events
      const unsubscribe = callSignaling.subscribeUser(userId, (event) => {
        sendEvent(event);
      });

      // Send initial connection heartbeat
      controller.enqueue(encoder.encode(`: ping\n\n`));

      // Periodic check for 60s ring timeout & keep-alive ping
      const intervalId = setInterval(async () => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));

          const expiredCalls = await autoExpireStaleCalls(60);
          expiredCalls.forEach((call) => {
            callSignaling.emitCallEvent({
              type: "call:missed",
              call,
              timestamp: Date.now()
            });
          });
        } catch (err) {
          // Ignore
        }
      }, 5000);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        unsubscribe();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    }
  });
}
