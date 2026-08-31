"use client";

import { useState, useEffect, useRef } from "react";
import { X, Phone, User, CheckCircle2, MessageSquare, ShieldCheck, Loader2 } from "lucide-react";
import { useCallContext } from "@/components/calls/CallProvider";
import CallButton from "@/components/calls/CallButton";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { getChatSocket } from "@/lib/socketChat";
import { useTranslation } from "@/lib/i18n";

interface ChatWindowProps {
  conversationId: string;
  peerName: string;
  peerAvatar?: string;
  peerId: string;
  bookingId?: string;
  serviceName?: string;
  bookingStatus?: string;
  currentUserId: string;
  onClose?: () => void;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole?: string;
  body: string;
  mediaUrl?: string | null;
  locationUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  messageType?: string;
  readAt?: string | null;
  createdAt: string;
}

export default function ChatWindow({
  conversationId,
  peerName,
  peerAvatar,
  peerId,
  bookingId,
  serviceName,
  bookingStatus,
  currentUserId,
  onClose
}: ChatWindowProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch initial message history & set up 2-second live background sync
  useEffect(() => {
    let isMounted = true;

    const syncMessages = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (currentUserId) headers["x-user-id"] = currentUserId;

        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setMessages((prev) => {
              // Deduplicate fetched DB messages by ID as well as identical body+senderId within 3s
              const uniqueData: ChatMessage[] = [];
              for (const msg of data) {
                const isDuplicate = uniqueData.some(
                  (u) =>
                    u.id === msg.id ||
                    (u.senderId === msg.senderId &&
                      u.body === msg.body &&
                      Math.abs(new Date(u.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 3000)
                );
                if (!isDuplicate) {
                  uniqueData.push(msg);
                }
              }

              // Retain local temp messages if still in flight
              const tempMsgs = prev.filter((m) => m.id.startsWith("temp-") && !uniqueData.some((d) => d.body === m.body));
              const merged = [...uniqueData, ...tempMsgs];
              if (
                merged.length !== prev.length ||
                (merged.length > 0 && merged[merged.length - 1]?.id !== prev[prev.length - 1]?.id) ||
                JSON.stringify(merged) !== JSON.stringify(prev)
              ) {
                return merged;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    syncMessages();

    // 2-second live sync interval for bulletproof delivery across DevTunnels / firewalls / mobile networks
    const interval = setInterval(syncMessages, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isPeerTyping]);

  // Connect to Socket.IO for real-time messaging
  useEffect(() => {
    const socket = getChatSocket(currentUserId);

    const joinRoom = () => {
      socket.emit("chat:join_conversation", { conversationId });
      socket.emit("chat:mark_read", { conversationId });
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);

    const handleReceiveMessage = (msg: any) => {
      const convId = msg.conversationId || msg.conversation_id;
      if (convId === conversationId) {
        const formatted: ChatMessage = {
          id: msg.id,
          conversationId: convId,
          senderId: msg.senderId || msg.sender_id,
          senderRole: msg.senderRole || msg.sender_role,
          body: msg.body || "",
          mediaUrl: msg.mediaUrl || msg.media_url || null,
          locationUrl: msg.locationUrl || msg.location_url || null,
          latitude: msg.latitude ? Number(msg.latitude) : null,
          longitude: msg.longitude ? Number(msg.longitude) : null,
          messageType: msg.messageType || msg.message_type || "text",
          readAt: msg.readAt || msg.read_at || null,
          createdAt: msg.createdAt || msg.created_at || new Date().toISOString()
        };

        setMessages((prev) => {
          // If this exact message ID already exists, do not duplicate
          if (prev.some((m) => m.id === formatted.id)) return prev;

          // If a non-temp message from the same sender with identical body exists within 3 seconds, ignore duplicate
          const isDuplicateBody = prev.some(
            (m) =>
              !m.id.startsWith("temp-") &&
              m.senderId === formatted.senderId &&
              m.body === formatted.body &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(formatted.createdAt).getTime()) < 3000
          );
          if (isDuplicateBody) return prev;

          // Replace matching optimistic temp message
          const tempIndex = prev.findIndex(
            (m) => m.id.startsWith("temp-") && m.body === formatted.body && m.senderId === formatted.senderId
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = formatted;
            return updated;
          }
          return [...prev, formatted];
        });

        if (formatted.senderId !== currentUserId) {
          socket.emit("chat:mark_read", { conversationId });
        }
      }
    };

    const handleUserTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setIsPeerTyping(true);
      }
    };

    const handleUserStopTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setIsPeerTyping(false);
      }
    };

    const handleMessagesRead = (data: { conversationId: string; readBy: string }) => {
      if (data.conversationId === conversationId && data.readBy !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === currentUserId ? { ...m, readAt: new Date().toISOString() } : m))
        );
      }
    };

    const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    socket.on("chat:receive_message", handleReceiveMessage);
    socket.on("chat:user_typing", handleUserTyping);
    socket.on("chat:user_stop_typing", handleUserStopTyping);
    socket.on("chat:messages_read", handleMessagesRead);
    socket.on("chat:message_deleted", handleMessageDeleted);

    return () => {
      socket.off("connect", joinRoom);
      socket.emit("chat:leave_conversation", { conversationId });
      socket.off("chat:receive_message", handleReceiveMessage);
      socket.off("chat:user_typing", handleUserTyping);
      socket.off("chat:user_stop_typing", handleUserStopTyping);
      socket.off("chat:messages_read", handleMessagesRead);
      socket.off("chat:message_deleted", handleMessageDeleted);
    };
  }, [conversationId, currentUserId]);

  // Handle Send Message (Instant local render + Socket emit / REST fallback)
  const handleSendMessage = async (text: string, mediaUrl?: string, locationUrl?: string, latitude?: number, longitude?: number) => {
    const socket = getChatSocket(currentUserId);
    const tempId = `temp-${Date.now()}`;
    const messageType = locationUrl ? "location" : mediaUrl ? "image" : "text";

    const newMsg: ChatMessage = {
      id: tempId,
      conversationId,
      senderId: currentUserId,
      body: text,
      mediaUrl: mediaUrl || null,
      locationUrl: locationUrl || null,
      latitude: latitude || null,
      longitude: longitude || null,
      messageType,
      createdAt: new Date().toISOString()
    };

    // 1. Instant local UI update (0ms response)
    setMessages((prev) => [...prev, newMsg]);

    // 2. Send via Socket.IO if connected; ONLY fallback to REST API if disconnected
    if (socket.connected) {
      socket.emit("chat:send_message", {
        conversationId,
        body: text,
        mediaUrl,
        locationUrl,
        latitude,
        longitude,
        messageType
      });
    } else {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (currentUserId) headers["x-user-id"] = currentUserId;

        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            senderId: currentUserId,
            text,
            mediaUrl,
            locationUrl,
            latitude,
            longitude,
            messageType
          })
        });
        if (res.ok) {
          const savedMsg = await res.json();
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: savedMsg.id, createdAt: savedMsg.created_at || savedMsg.createdAt } : m))
          );
        }
      } catch (e) {
        console.error("REST send backup error:", e);
      }
    }
  };

  const handleTypingStart = () => {
    const socket = getChatSocket(currentUserId);
    socket.emit("chat:typing_start", { conversationId });
  };

  const handleTypingStop = () => {
    const socket = getChatSocket(currentUserId);
    socket.emit("chat:typing_stop", { conversationId });
  };

  const handleDeleteMessage = (messageId: string) => {
    const socket = getChatSocket(currentUserId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    socket.emit("chat:delete_message", { messageId, conversationId });
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-2xl overflow-hidden min-w-[320px] max-w-2xl w-full">
      {/* Chat Window Header */}
      <div className="p-4 bg-card border-b border-border flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center border border-border shadow-sm shrink-0">
              {peerName ? peerName.trim().charAt(0).toUpperCase() : "U"}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
          </div>

          <div className="overflow-hidden">
            <h3 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
              <span>{peerName}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {serviceName ? `${serviceName} • ${t(`account.statuses.${bookingStatus}`) || bookingStatus || "Accepted"}` : "BelConnect Direct Chat"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Integrated Call Button */}
          {bookingId && (
            <CallButton
              bookingId={bookingId}
              bookingStatus={bookingStatus || "Accepted"}
              title={t("account.callProvider")}
            />
          )}

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title={t("common.close") || "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-muted/10 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center p-6 bg-card border border-dashed border-border rounded-2xl">
            <MessageSquare className="w-8 h-8 text-blue-600/40" />
            <p className="text-xs font-bold text-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground">
              Send a message, 1-tap quick reply, or share your live GPS location!
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              id={m.id}
              body={m.body}
              createdAt={m.createdAt}
              isMe={m.senderId === currentUserId}
              mediaUrl={m.mediaUrl}
              locationUrl={m.locationUrl}
              readAt={m.readAt}
              onDeleteMessage={handleDeleteMessage}
            />
          ))
        )}

        {/* Peer Typing Indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 italic animate-pulse">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-150" />
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-300" />
            </div>
            <span>{peerName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />
    </div>
  );
}
