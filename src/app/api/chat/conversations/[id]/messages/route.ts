import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendPushToUser } from "@/lib/pushNotifications";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const messagesResult = await query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 AND (is_deleted_from_ui IS FALSE OR is_deleted_from_ui IS NULL)
       ORDER BY created_at ASC`,
      [conversationId]
    );

    // Filter active messages within 24 hours for disappearing message behavior
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeMessages = messagesResult.rows.filter((msg) => {
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime >= twentyFourHoursAgo;
    }).map((msg) => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      senderRole: msg.sender_role,
      body: msg.body || "",
      mediaUrl: msg.media_url || null,
      locationUrl: msg.location_url || null,
      latitude: msg.latitude ? Number(msg.latitude) : null,
      longitude: msg.longitude ? Number(msg.longitude) : null,
      messageType: msg.message_type || "text",
      readAt: msg.read_at,
      createdAt: msg.created_at
    }));

    return NextResponse.json(activeMessages);
  } catch (error) {
    console.error("GET messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: conversationId } = await params;
    const body = await req.json();
    const { senderId, senderRole, text, mediaUrl, locationUrl, latitude, longitude, messageType } = body;

    if (!conversationId || !senderId) {
      return NextResponse.json({ error: "conversationId and senderId are required" }, { status: 400 });
    }

    // Deduplication check: if socket emit inserted this message in the last 5 seconds, return existing
    const existingMsg = await query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 AND sender_id = $2 AND body = $3 
         AND created_at > NOW() - INTERVAL '5 seconds'
       LIMIT 1`,
      [conversationId, senderId, text || ""]
    );

    if (existingMsg.rows.length > 0) {
      return NextResponse.json(existingMsg.rows[0], { status: 200 });
    }

    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;
    const role = senderRole || (String(senderId).startsWith("provider") ? "provider" : "customer");

    const result = await query(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_role, body, media_url, location_url, latitude, longitude, message_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [messageId, conversationId, senderId, role, text || "", mediaUrl || null, locationUrl || null, latitude || null, longitude || null, messageType || "text"]
    );

    await query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);

    const savedMsg = result.rows[0];

    // Trigger background socket broadcast to signaling server
    try {
      const signalingPort = process.env.SIGNALING_PORT || 4001;
      // DO NOT FALL BACK TO ANY DEFAULT VALUE, EMPTY STRING INCLUDED, FOR A SECRET USED IN AN AUTHORIZATION OR SIGNATURE CHECK — FAIL STARTUP INSTEAD.
      const internalSecret = process.env.SIGNALING_INTERNAL_SECRET;
      if (!internalSecret && typeof window === "undefined") {
        throw new Error("FATAL: SIGNALING_INTERNAL_SECRET environment variable is missing.");
      }
      fetch(`http://127.0.0.1:${signalingPort}/api/chat/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: internalSecret,
          conversationId,
          event: "chat:receive_message",
          payload: savedMsg
        })
      }).catch(() => {});
    } catch (e) {}

    // Trigger background Web Push notification to recipient
    try {
      const convRes = await query("SELECT customer_id, provider_id FROM conversations WHERE id = $1 LIMIT 1", [conversationId]);
      if (convRes.rows.length > 0) {
        const conv = convRes.rows[0];
        const peerId = (conv.customer_id === senderId) ? conv.provider_id : conv.customer_id;
        if (peerId) {
          sendPushToUser(peerId, {
            title: "New Message 💬",
            body: text || (messageType === "location" ? "📍 Shared Location" : "📷 Photo Attachment"),
            data: {
              type: "chat:message",
              conversationId,
              url: `/?conversationId=${conversationId}`
            }
          }).catch(() => {});
        }
      }
    } catch (e) {}

    return NextResponse.json(savedMsg, { status: 201 });
  } catch (error) {
    console.error("POST message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
