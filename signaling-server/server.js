const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const JWT_SECRET = process.env.JWT_SECRET;
const SIGNALING_SECRET = process.env.SIGNALING_INTERNAL_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const PORT = process.env.PORT || process.env.SIGNALING_PORT || 4001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate essential environment variables on startup
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}
if (!SIGNALING_SECRET) {
  throw new Error("FATAL: SIGNALING_INTERNAL_SECRET environment variable is missing.");
}
if (!DATABASE_URL) {
  throw new Error("FATAL: DATABASE_URL environment variable is missing.");
}

const getCorsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  
  const allowedOrigins = ALLOWED_ORIGIN.split(",").map((o) => o.trim());
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  if (origin.includes("devtunnels.ms") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return callback(null, true);
  }
  
  callback(new Error("Not allowed by CORS"));
};

const app = express();
app.use(cors({ origin: getCorsOrigin, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: getCorsOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["polling", "websocket"]
});

// Socket.IO Middleware for Authentication - Strict JWT Verification (NO FALLBACK)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    console.warn(`[Signaling Server] Connection rejected: Missing authentication token`);
    return next(new Error("Authentication failed: Missing authentication token"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.userId) {
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      return next();
    }
    return next(new Error("Authentication failed: Invalid token payload"));
  } catch (err) {
    console.warn(`[Signaling Server] Connection rejected: Token verification failed (${err.message})`);
    return next(new Error("Authentication failed: Invalid or expired token"));
  }
});

const { Pool } = require("pg");
const pool = new Pool({ connectionString: DATABASE_URL });

io.on("connection", (socket) => {
  const userId = socket.userId;
  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  console.log(`[Signaling Server] User connected: ${userId} (Socket ID: ${socket.id}, Room: ${userRoom})`);

  // Allow client to join a specific call session room
  socket.on("call:join_session", (data) => {
    if (data && data.callId) {
      const callRoom = `call:${data.callId}`;
      socket.join(callRoom);
      console.log(`[Signaling Server] User ${userId} joined room ${callRoom}`);
    }
  });

  // ═══════ Live Location Tracking Room Handlers (Authorized by Booking Ownership) ═══════
  socket.on("booking:subscribe", async (data) => {
    if (!data || !data.bookingId) return;
    const bookingId = data.bookingId;

    try {
      const bookingRes = await pool.query(
        "SELECT id, customer_id, provider_id FROM bookings WHERE id = $1 LIMIT 1",
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        socket.emit("error", { message: "Booking not found" });
        return;
      }

      const booking = bookingRes.rows[0];
      const isOwner =
        booking.customer_id === userId ||
        booking.provider_id === userId;

      if (!isOwner) {
        console.warn(`[Location Auth] User ${userId} unauthorized to subscribe to booking ${bookingId}`);
        socket.emit("error", { message: "Unauthorized: You do not have access to this booking" });
        return;
      }

      const bookingRoom = `booking:${bookingId}`;
      socket.join(bookingRoom);
      console.log(`[Location Server] User ${userId} joined room ${bookingRoom}`);
    } catch (err) {
      console.error("[Location Auth] Error verifying booking subscription ownership:", err);
      socket.emit("error", { message: "Internal server error authorizing booking access" });
    }
  });

  socket.on("booking:unsubscribe", (data) => {
    if (data && data.bookingId) {
      const bookingRoom = `booking:${data.bookingId}`;
      socket.leave(bookingRoom);
      console.log(`[Location Server] User ${userId} left room ${bookingRoom}`);
    }
  });

  // Coordinate validation helper: -90 <= lat <= 90 and -180 <= lng <= 180
  function isValidCoordinate(lat, lng) {
    const numLat = Number(lat);
    const numLng = Number(lng);
    return (
      Number.isFinite(numLat) &&
      Number.isFinite(numLng) &&
      numLat >= -90 &&
      numLat <= 90 &&
      numLng >= -180 &&
      numLng <= 180
    );
  }

  // Provider Live GPS Location Handler
  socket.on("provider:location:update", async (data) => {
    if (!data || !data.bookingId) return;
    const bookingId = data.bookingId;

    if (!isValidCoordinate(data.latitude, data.longitude)) {
      console.warn(`[Location Auth] Invalid coordinates rejected for booking ${bookingId}: lat=${data.latitude}, lng=${data.longitude}`);
      socket.emit("error", { message: "Invalid latitude or longitude coordinates" });
      return;
    }

    try {
      const bookingRes = await pool.query(
        "SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1 LIMIT 1",
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        socket.emit("error", { message: "Booking not found" });
        return;
      }

      const booking = bookingRes.rows[0];
      const isAuthorizedProvider = booking.provider_id === userId;

      if (!isAuthorizedProvider) {
        console.warn(`[Location Auth] User ${userId} unauthorized to broadcast provider location for booking ${bookingId}`);
        socket.emit("error", { message: "Unauthorized: Only the assigned provider can broadcast provider location updates" });
        return;
      }

      // Server-side enforcement of active tracking lifecycle statuses
      const ACTIVE_TRACKING_STATUSES = ["OnTheWay", "Started"];
      if (!ACTIVE_TRACKING_STATUSES.includes(booking.status)) {
        console.warn(`[Location Auth] Rejected location broadcast: booking ${bookingId} status is '${booking.status}'`);
        socket.emit("error", { message: `Location update rejected: booking status '${booking.status}' is not in active tracking window` });
        return;
      }

      // Authoritative server timestamp calculation
      const serverTimestamp = Date.now();
      const clientTs = Number(data.timestamp);
      const safeClientTs = Number.isFinite(clientTs) && clientTs > 0 ? clientTs : null;

      const bookingRoom = `booking:${bookingId}`;
      const payload = {
        bookingId: data.bookingId,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: typeof data.accuracy === "number" && Number.isFinite(data.accuracy) ? Number(data.accuracy) : null,
        heading: typeof data.heading === "number" && Number.isFinite(data.heading) ? Number(data.heading) : null,
        speed: typeof data.speed === "number" && Number.isFinite(data.speed) ? Number(data.speed) : null,
        timestamp: serverTimestamp,
        clientTimestamp: safeClientTs
      };

      // Broadcast provider location update (single authoritative event to room)
      io.to(bookingRoom).emit("provider:location:update", payload);
    } catch (err) {
      console.error("[Location Auth] Error verifying provider location update ownership:", err);
      socket.emit("error", { message: "Internal server error authorizing location update" });
    }
  });

  // Customer Live GPS Location Handler
  socket.on("customer:location:update", async (data) => {
    if (!data || !data.bookingId) return;
    const bookingId = data.bookingId;

    if (!isValidCoordinate(data.latitude, data.longitude)) {
      console.warn(`[Location Auth] Invalid customer coordinates rejected for booking ${bookingId}: lat=${data.latitude}, lng=${data.longitude}`);
      socket.emit("error", { message: "Invalid latitude or longitude coordinates" });
      return;
    }

    try {
      const bookingRes = await pool.query(
        "SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1 LIMIT 1",
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        socket.emit("error", { message: "Booking not found" });
        return;
      }

      const booking = bookingRes.rows[0];
      const isAuthorizedCustomer = booking.customer_id === userId;

      if (!isAuthorizedCustomer) {
        console.warn(`[Location Auth] User ${userId} unauthorized to broadcast customer location for booking ${bookingId}`);
        socket.emit("error", { message: "Unauthorized: Only the assigned customer can broadcast live customer location updates" });
        return;
      }

      // Server-side enforcement of active tracking lifecycle statuses
      const ACTIVE_TRACKING_STATUSES = ["OnTheWay", "Started"];
      if (!ACTIVE_TRACKING_STATUSES.includes(booking.status)) {
        console.warn(`[Location Auth] Rejected customer location broadcast: booking ${bookingId} status is '${booking.status}'`);
        socket.emit("error", { message: `Location update rejected: booking status '${booking.status}' is not in active tracking window` });
        return;
      }

      // Authoritative server timestamp calculation
      const serverTimestamp = Date.now();
      const clientTs = Number(data.timestamp);
      const safeClientTs = Number.isFinite(clientTs) && clientTs > 0 ? clientTs : null;

      const bookingRoom = `booking:${bookingId}`;
      const payload = {
        bookingId: data.bookingId,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: typeof data.accuracy === "number" && Number.isFinite(data.accuracy) ? Number(data.accuracy) : null,
        heading: typeof data.heading === "number" && Number.isFinite(data.heading) ? Number(data.heading) : null,
        speed: typeof data.speed === "number" && Number.isFinite(data.speed) ? Number(data.speed) : null,
        timestamp: serverTimestamp,
        clientTimestamp: safeClientTs
      };

      // Broadcast customer location update to authorized room subscribers (provider)
      io.to(bookingRoom).emit("customer:location:update", payload);
    } catch (err) {
      console.error("[Location Auth] Error verifying customer location update ownership:", err);
      socket.emit("error", { message: "Internal server error authorizing customer location update" });
    }
  });

  socket.on("booking:status_update", async (data) => {
    if (!data || !data.bookingId || !data.status) return;
    const bookingId = data.bookingId;
    const requestedStatus = data.status;

    try {
      const bookingRes = await pool.query(
        "SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1 LIMIT 1",
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        socket.emit("error", { message: "Booking not found" });
        return;
      }

      const booking = bookingRes.rows[0];
      const isMember = booking.customer_id === userId || booking.provider_id === userId;

      if (!isMember) {
        console.warn(`[Status Auth] User ${userId} unauthorized to broadcast status for booking ${bookingId}`);
        socket.emit("error", { message: "Unauthorized status broadcast" });
        return;
      }

      // Verify that DB status matches requested status (ensuring REST API PATCH succeeded first)
      if (booking.status !== requestedStatus) {
        console.warn(`[Status Auth] Status mismatch for booking ${bookingId}: DB is '${booking.status}', claimed is '${requestedStatus}'`);
        // Broadcast the actual DB status so clients sync with source of truth
        const bookingRoom = `booking:${bookingId}`;
        io.to(bookingRoom).emit("booking:status_updated", {
          bookingId,
          status: booking.status,
          timestamp: Date.now()
        });
        return;
      }

      const bookingRoom = `booking:${bookingId}`;
      console.log(`[Status Broadcast] Verified DB status for booking ${bookingId}: ${booking.status}`);
      io.to(bookingRoom).emit("booking:status_updated", {
        bookingId,
        status: booking.status,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("[Status Auth] Error verifying booking status update:", err);
    }
  });

  // Real-Time Chat Handlers
  socket.on("chat:join_conversation", async (data) => {
    if (!data || !data.conversationId) return;
    const conversationId = data.conversationId;
    try {
      const convRes = await pool.query(
        "SELECT id, customer_id, provider_id FROM conversations WHERE id = $1 LIMIT 1",
        [conversationId]
      );
      if (convRes.rows.length === 0) {
        socket.emit("chat:error", { error: "Conversation not found" });
        return;
      }
      const conv = convRes.rows[0];
      const isParticipant = conv.customer_id === userId || conv.provider_id === userId;
      if (!isParticipant) {
        console.warn(`[Chat Auth] User ${userId} unauthorized to join conversation ${conversationId}`);
        socket.emit("chat:error", { error: "Unauthorized: You are not a participant in this conversation" });
        return;
      }
      const convRoom = `conversation:${conversationId}`;
      socket.join(convRoom);
      console.log(`[Chat Server] User ${userId} joined chat room ${convRoom}`);
    } catch (err) {
      console.error("[Chat Auth] Error verifying conversation ownership:", err);
      socket.emit("chat:error", { error: "Internal server error authorizing conversation access" });
    }
  });

  socket.on("chat:leave_conversation", (data) => {
    if (data && data.conversationId) {
      const convRoom = `conversation:${data.conversationId}`;
      socket.leave(convRoom);
      console.log(`[Chat Server] User ${userId} left chat room ${convRoom}`);
    }
  });

function formatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body || "",
    mediaUrl: row.media_url || null,
    locationUrl: row.location_url || null,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    messageType: row.message_type || "text",
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

  socket.on("chat:send_message", async (data) => {
    if (!data || !data.conversationId) return;
    try {
      const { conversationId, body, mediaUrl, locationUrl, latitude, longitude, messageType } = data;

      const convResult = await pool.query("SELECT customer_id, provider_id FROM conversations WHERE id = $1", [conversationId]);
      if (convResult.rows.length === 0) {
        socket.emit("chat:error", { error: "Conversation not found" });
        return;
      }
      const conv = convResult.rows[0];
      if (conv.customer_id !== userId && conv.provider_id !== userId) {
        console.warn(`[Chat Auth] User ${userId} unauthorized to send message in conversation ${conversationId}`);
        socket.emit("chat:error", { error: "Unauthorized: You are not a participant in this conversation" });
        return;
      }
      const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;
      const senderRole = socket.userRole || (String(userId).startsWith("provider") ? "provider" : "customer");

      const insertQuery = `
        INSERT INTO messages (id, conversation_id, sender_id, sender_role, body, media_url, location_url, latitude, longitude, message_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const values = [messageId, conversationId, userId, senderRole, body || "", mediaUrl || null, locationUrl || null, latitude || null, longitude || null, messageType || "text"];
      const result = await pool.query(insertQuery, values);
      const savedMsg = formatMessage(result.rows[0]);

      await pool.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);

      const convRoom = `conversation:${conversationId}`;
      io.to(convRoom).emit("chat:receive_message", savedMsg);

      const peerId = (conv.customer_id === userId) ? conv.provider_id : conv.customer_id;
      if (peerId) {
        io.to(`user:${peerId}`).emit("chat:new_message_notification", { conversationId, message: savedMsg });
        io.to(`user:${peerId}`).emit("chat:receive_message", savedMsg);

        // Check if peer is connected in their user socket room
        const peerRoom = io.sockets.adapter.rooms.get(`user:${peerId}`);
        const isPeerConnected = peerRoom && peerRoom.size > 0;
        if (!isPeerConnected) {
          const internalSecret = process.env.INTERNAL_API_SECRET || SIGNALING_SECRET;
          const appUrl = process.env.APP_URL || "http://127.0.0.1:3000";
          fetch(`${appUrl}/api/push/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: internalSecret,
              userId: peerId,
              title: "New Message 💬",
              body: savedMsg.body || (savedMsg.messageType === "location" ? "📍 Shared Location" : "📷 Photo Attachment"),
              data: {
                type: "chat:message",
                conversationId,
                url: `/?conversationId=${conversationId}`
              }
            })
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[Chat Server] Error sending message:", err);
      socket.emit("chat:error", { error: "Failed to process message" });
    }
  });

  socket.on("chat:typing_start", (data) => {
    if (data && data.conversationId) {
      socket.to(`conversation:${data.conversationId}`).emit("chat:user_typing", { conversationId: data.conversationId, userId });
    }
  });

  socket.on("chat:typing_stop", (data) => {
    if (data && data.conversationId) {
      socket.to(`conversation:${data.conversationId}`).emit("chat:user_stop_typing", { conversationId: data.conversationId, userId });
    }
  });

  socket.on("chat:mark_read", async (data) => {
    if (!data || !data.conversationId) return;
    try {
      await pool.query("UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL", [data.conversationId, userId]);
      io.to(`conversation:${data.conversationId}`).emit("chat:messages_read", { conversationId: data.conversationId, readBy: userId });
    } catch (err) {
      console.error("[Chat Server] Error marking read:", err);
    }
  });

  socket.on("chat:delete_message", async (data) => {
    if (!data || !data.messageId || !data.conversationId) return;
    try {
      await pool.query("UPDATE messages SET is_deleted_from_ui = TRUE WHERE id = $1 AND sender_id = $2", [data.messageId, userId]);
      io.to(`conversation:${data.conversationId}`).emit("chat:message_deleted", { messageId: data.messageId, conversationId: data.conversationId });
    } catch (err) {
      console.error("[Chat Server] Error deleting message:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Signaling Server] User disconnected: ${userId} (Reason: ${reason})`);
  });
});

app.post("/api/chat/broadcast", (req, res) => {
  const { secret, conversationId, event, payload } = req.body;
  if (secret !== SIGNALING_SECRET) {
    return res.status(403).json({ error: "Forbidden: Invalid internal secret" });
  }
  if (conversationId && event && payload) {
    const formattedPayload = (payload && payload.conversation_id) ? formatMessage(payload) : payload;
    io.to(`conversation:${conversationId}`).emit(event, formattedPayload);
  }
  return res.json({ success: true });
});

app.post("/api/location/broadcast", (req, res) => {
  const { secret, bookingId, event, payload } = req.body;
  if (secret !== SIGNALING_SECRET) {
    return res.status(403).json({ error: "Forbidden: Invalid internal secret" });
  }
  if (bookingId && event && payload) {
    io.to(`booking:${bookingId}`).emit(event, payload);
  }
  return res.json({ success: true });
});

// REST API for Next.js backend to push call signaling events
app.post("/api/signal", (req, res) => {
  const { secret, type, targetUserId, targetUserIds, call, livekit, timestamp } = req.body;

  if (secret !== SIGNALING_SECRET) {
    return res.status(403).json({ error: "Forbidden: Invalid internal secret" });
  }

  if (!type || !call) {
    return res.status(400).json({ error: "Bad Request: Missing type or call payload" });
  }

  const payload = {
    type,
    call,
    livekit,
    timestamp: timestamp || Date.now()
  };

  if (targetUserIds && Array.isArray(targetUserIds)) {
    targetUserIds.forEach((uid) => {
      if (uid) io.to(`user:${uid}`).emit("call:signal", payload);
    });
  } else if (targetUserId) {
    io.to(`user:${targetUserId}`).emit("call:signal", payload);
  } else {
    // Fallback: emit to both caller and receiver
    if (call.callerId) io.to(`user:${call.callerId}`).emit("call:signal", payload);
    if (call.receiverId) io.to(`user:${call.receiverId}`).emit("call:signal", payload);
  }

  return res.json({ success: true, delivered: true });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "CityConnect Signaling Server", 
    signaling: true,
    timestamp: new Date().toISOString() 
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`CityConnect Signaling Server running on port ${PORT} (0.0.0.0)`);
  console.log(`Local health check: http://localhost:${PORT}/health`);
  console.log(`For physical-phone testing, expose this port via Dev Tunnel`);
  console.log(`Then set: NEXT_PUBLIC_SIGNALING_URL=https://<tunnel-id>-${PORT}.inc1.devtunnels.ms`);
  console.log(`=======================================================`);
});

server.on("error", (err) => {
  console.error("[Signaling Server] Server error:", err);
});
