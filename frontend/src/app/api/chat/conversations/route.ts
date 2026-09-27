import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(req: Request) {
  try {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    if (requestedUserId && requestedUserId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden: You can only fetch your own conversations" }, { status: 403 });
    }

    const userId = authUser.userId;

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
    if (!authUser || !authUser.userId) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let { customerId, providerId, bookingId } = body;

    const cleanBookingId = typeof bookingId === "string" ? bookingId.trim() : "";

    // 1. Authoritative resolution for booking-related conversations
    if (cleanBookingId) {
      const bRes = await query(
        `SELECT id, customer_id, provider_id FROM bookings WHERE id = $1 LIMIT 1`,
        [cleanBookingId]
      );

      if (bRes.rows.length === 0) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      const booking = bRes.rows[0];
      const authoritativeCustomerId = booking.customer_id;
      const authoritativeProviderId = booking.provider_id;

      // Authoritative participation check
      if (authUser.userId !== authoritativeCustomerId && authUser.userId !== authoritativeProviderId) {
        return NextResponse.json(
          { error: "Forbidden: You are not an authorized participant in this booking" },
          { status: 403 }
        );
      }

      customerId = authoritativeCustomerId;
      providerId = authoritativeProviderId;

      // Check if conversation already exists for this booking
      const existing = await query(
        `SELECT id, customer_id, provider_id FROM conversations WHERE booking_id = $1 LIMIT 1`,
        [cleanBookingId]
      );

      if (existing.rows.length > 0) {
        const conv = existing.rows[0];
        if (authUser.userId !== conv.customer_id && authUser.userId !== conv.provider_id) {
          return NextResponse.json(
            { error: "Forbidden: You are not an authorized participant in this conversation" },
            { status: 403 }
          );
        }
        return NextResponse.json({ conversationId: conv.id, isNew: false });
      }

      // Create a fresh clean conversation dedicated to this booking
      const newBookingConvId = `conv-${cleanBookingId}`;
      await query(
        `INSERT INTO conversations (id, customer_id, provider_id, booking_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [newBookingConvId, customerId, providerId, cleanBookingId]
      );

      return NextResponse.json({ conversationId: newBookingConvId, isNew: true }, { status: 201 });
    }

    // 2. Direct general conversation lookup / creation (non-booking)
    if (!customerId || !providerId) {
      return NextResponse.json({ error: "customerId and providerId are required" }, { status: 400 });
    }

    if (authUser.userId !== customerId && authUser.userId !== providerId) {
      return NextResponse.json(
        { error: "Forbidden: You must be a participant to start this conversation" },
        { status: 403 }
      );
    }

    const existing = await query(
      `SELECT id, customer_id, provider_id FROM conversations WHERE ((customer_id = $1 AND provider_id = $2) OR (customer_id = $2 AND provider_id = $1)) AND booking_id IS NULL LIMIT 1`,
      [customerId, providerId]
    );

    if (existing.rows.length > 0) {
      const conv = existing.rows[0];
      if (authUser.userId !== conv.customer_id && authUser.userId !== conv.provider_id) {
        return NextResponse.json(
          { error: "Forbidden: You are not an authorized participant in this conversation" },
          { status: 403 }
        );
      }
      return NextResponse.json({ conversationId: conv.id, isNew: false });
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
