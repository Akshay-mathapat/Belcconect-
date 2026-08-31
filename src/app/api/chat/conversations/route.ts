import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser, verifyJwtToken } from "@/lib/jwt";

export async function GET(req: Request) {
  try {
    const authUser = getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    let userId = authUser?.userId;

    if (!userId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const decoded = verifyJwtToken(authHeader.replace("Bearer ", ""));
        if (decoded?.userId) userId = decoded.userId;
      }
    }

    if (!userId) {
      if (process.env.DEMO_MODE === "true") {
        userId = "customer-1";
      } else {
        return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
      }
    }

    if (requestedUserId && requestedUserId !== userId && process.env.DEMO_MODE !== "true") {
      return NextResponse.json({ error: "Forbidden: You can only fetch your own conversations" }, { status: 403 });
    }

    const conversationsResult = await query(
      `SELECT c.*, 
              cust.name as customer_name, cust.avatar as customer_avatar, cust.phone as customer_phone,
              prov.name as provider_name, prov.avatar as provider_avatar, prov.phone as provider_phone,
              b.service_name, b.status as booking_status
       FROM conversations c
       LEFT JOIN customers cust ON c.customer_id = cust.id
       LEFT JOIN service_providers prov ON c.provider_id = prov.id
       LEFT JOIN bookings b ON c.booking_id = b.id
       WHERE c.customer_id = $1 
          OR c.provider_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    const conversations = await Promise.all(
      conversationsResult.rows.map(async (conv) => {
        // Fetch last message
        const msgResult = await query(
          `SELECT * FROM messages 
           WHERE conversation_id = $1 AND (is_deleted_from_ui IS FALSE OR is_deleted_from_ui IS NULL)
           ORDER BY created_at DESC LIMIT 1`,
          [conv.id]
        );

        // Fetch unread count for this user
        const unreadResult = await query(
          `SELECT COUNT(*) FROM messages 
           WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL AND (is_deleted_from_ui IS FALSE OR is_deleted_from_ui IS NULL)`,
          [conv.id, userId]
        );

        const lastMsg = msgResult.rows[0] || null;
        const unreadCount = parseInt(unreadResult.rows[0]?.count || "0", 10);

        const isCustomer = conv.customer_id === userId;
        const peerName = isCustomer ? (conv.provider_name || "Service Provider") : (conv.customer_name || "Customer");
        const peerAvatar = isCustomer ? (conv.provider_avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80") : (conv.customer_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80");
        const peerId = isCustomer ? conv.provider_id : conv.customer_id;

        return {
          id: conv.id,
          customerId: conv.customer_id,
          providerId: conv.provider_id,
          bookingId: conv.booking_id,
          serviceName: conv.service_name || "Service Booking",
          bookingStatus: conv.booking_status || "Accepted",
          peerId,
          peerName,
          peerAvatar,
          lastMessage: lastMsg ? (lastMsg.body || (lastMsg.media_url ? "📷 Image Attachment" : "📍 Shared Location")) : "No messages yet",
          lastMessageTime: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          unreadCount,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        };
      })
    );

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("GET conversations error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = getAuthenticatedUser(req);
    if (!authUser && process.env.DEMO_MODE !== "true") {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    const body = await req.json();
    let { customerId, providerId, bookingId } = body;

    // Auto-resolve participant IDs from booking record if available
    if (bookingId) {
      const bRes = await query(`SELECT customer_id, provider_id FROM bookings WHERE id = $1`, [bookingId]);
      if (bRes.rows.length > 0) {
        const row = bRes.rows[0];
        if (!customerId || (process.env.DEMO_MODE !== "true" && customerId === "customer-1")) customerId = row.customer_id;
        if (!providerId || (process.env.DEMO_MODE !== "true" && providerId === "provider-1")) providerId = row.provider_id;
      }
    }

    if (!customerId || !providerId) {
      return NextResponse.json({ error: "customerId and providerId are required" }, { status: 400 });
    }

    if (authUser && authUser.userId !== customerId && authUser.userId !== providerId && process.env.DEMO_MODE !== "true") {
      return NextResponse.json({ error: "Forbidden: You must be a participant to start this conversation" }, { status: 403 });
    }

    // 1. When a specific bookingId is provided, strictly lookup or create conversation for THIS booking
    if (bookingId) {
      const existing = await query(
        `SELECT id FROM conversations WHERE booking_id = $1 LIMIT 1`,
        [bookingId]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json({ conversationId: existing.rows[0].id, isNew: false });
      }

      // Create a fresh clean conversation dedicated to this booking
      const newBookingConvId = `conv-${bookingId}`;
      await query(
        `INSERT INTO conversations (id, customer_id, provider_id, booking_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [newBookingConvId, customerId, providerId, bookingId]
      );

      return NextResponse.json({ conversationId: newBookingConvId, isNew: true }, { status: 201 });
    }

    // 2. Direct general conversation lookup (non-booking)
    const existing = await query(
      `SELECT id FROM conversations WHERE (customer_id = $1 AND provider_id = $2) OR (customer_id = $2 AND provider_id = $1) LIMIT 1`,
      [customerId, providerId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ conversationId: existing.rows[0].id, isNew: false });
    }

    // Create new general conversation
    const newId = `conv-${Date.now()}`;
    await query(
      `INSERT INTO conversations (id, customer_id, provider_id, booking_id)
       VALUES ($1, $2, $3, NULL)`,
      [newId, customerId, providerId]
    );

    return NextResponse.json({ conversationId: newId, isNew: true }, { status: 201 });
  } catch (error) {
    console.error("POST conversation error:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
