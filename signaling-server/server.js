const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "cityconnect-secret-key-2026";
const SIGNALING_SECRET = process.env.SIGNALING_INTERNAL_SECRET || "cityconnect_signaling_secret_key_2026";
const PORT = process.env.SIGNALING_PORT || 4001;

// Socket.IO Middleware for Authentication
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  const fallbackUserId = socket.handshake.query?.userId || socket.handshake.auth?.userId;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.userId) {
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        return next();
      }
    } catch (err) {
      console.warn(`[Signaling Server] Token verification failed: ${err.message}`);
    }
  }

  // Allow explicit userId for authorized sessions if passed
  if (fallbackUserId) {
    socket.userId = fallbackUserId;
    return next();
  }

  return next(new Error("Authentication failed: Missing or invalid token"));
});

const { Pool } = require("pg");

const dbConnectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Akshay_a015@127.0.0.1:5432/cityconnect";

const pool = new Pool({ connectionString: dbConnectionString });

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

  // Client-to-client relay for call events
  socket.on("call:signal", (data) => {
    if (!data || !data.targetUserId) return;
    const targetRoom = `user:${data.targetUserId}`;
    io.to(targetRoom).emit("call:signal", {
      ...data,
      fromUserId: userId,
      timestamp: Date.now()
    });
  });

  // ═══════ Live Location Tracking Room Handlers ═══════
  socket.on("booking:subscribe", (data) => {
    if (data && data.bookingId) {
      const bookingRoom = `booking:${data.bookingId}`;
      socket.join(bookingRoom);
      console.log(`[Location Server] User ${userId} joined room ${bookingRoom}`);
    }
  });

  socket.on("booking:unsubscribe", (data) => {
    if (data && data.bookingId) {
      const bookingRoom = `booking:${data.bookingId}`;
      socket.leave(bookingRoom);
      console.log(`[Location Server] User ${userId} left room ${bookingRoom}`);
    }
  });

  socket.on("location:update", (data) => {
    if (!data || !data.bookingId) return;
    const bookingRoom = `booking:${data.bookingId}`;
    const payload = {
      bookingId: data.bookingId,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      heading: data.heading ? Number(data.heading) : null,
      speed: data.speed ? Number(data.speed) : null,
      timestamp: data.timestamp || Date.now()
    };

    // Broadcast location update to all subscribers in the booking room (e.g. customer tracking view)
    io.to(bookingRoom).emit("location:update", payload);
  });

  socket.on("booking:status_update", (data) => {
    if (!data || !data.bookingId || !data.status) return;
    const bookingRoom = `booking:${data.bookingId}`;
    console.log(`[Status Broadcast] Booking ${data.bookingId} status updated to: ${data.status}`);
    io.to(bookingRoom).emit("booking:status_updated", {
      bookingId: data.bookingId,
      status: data.status,
      timestamp: Date.now()
    });
  });

  // Real-Time Chat Handlers
  socket.on("chat:join_conversation", (data) => {
    if (data && data.conversationId) {
      const convRoom = `conversation:${data.conversationId}`;
      socket.join(convRoom);
      console.log(`[Chat Server] User ${userId} joined chat room ${convRoom}`);
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

      const convResult = await pool.query("SELECT customer_id, provider_id FROM conversations WHERE id = $1", [conversationId]);
      if (convResult.rows.length > 0) {
        const conv = convResult.rows[0];
        const peerId = (conv.customer_id === userId) ? conv.provider_id : conv.customer_id;
        if (peerId) {
          io.to(`user:${peerId}`).emit("chat:new_message_notification", { conversationId, message: savedMsg });
          io.to(`user:${peerId}`).emit("chat:receive_message", savedMsg);

          // Check if peer is connected in their user socket room
          const peerRoom = io.sockets.adapter.rooms.get(`user:${peerId}`);
          const isPeerConnected = peerRoom && peerRoom.size > 0;
          if (!isPeerConnected) {
            const internalSecret = process.env.INTERNAL_API_SECRET || "cityconnect_internal_secret_key_2026";
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
  res.json({ status: "ok", service: "CityConnect Signaling Server", timestamp: new Date().toISOString() });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`CityConnect Signaling Server running on port ${PORT} (0.0.0.0)`);
  console.log(`Socket.IO Endpoint: http://0.0.0.0:${PORT}`);
  console.log(`=======================================================`);
});
