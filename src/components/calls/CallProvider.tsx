"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/useAuthStore";
import { CallRecord } from "@/lib/calls";
import IncomingCall from "./IncomingCall";
import OutgoingCall from "./OutgoingCall";
import ActiveCall from "./ActiveCall";
import { LiveKitCredentials } from "./LiveKitVoiceCall";
import { ringtonePlayer } from "@/lib/ringtone";
import { registerAndSubscribeUser } from "@/lib/registerSW";

interface CallContextType {
  activeCall: CallRecord | null;
  livekitCredentials: LiveKitCredentials | null;
  callState: "IDLE" | "CREATING" | "OUTGOING" | "INCOMING" | "ACCEPTING" | "ACTIVE";
  startCall: (bookingId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  isCalling: boolean;
  socket: Socket | null;
}

const CallContext = createContext<CallContextType>({
  activeCall: null,
  livekitCredentials: null,
  callState: "IDLE",
  startCall: async () => {},
  acceptCall: async () => {},
  rejectCall: async () => {},
  endCall: async () => {},
  isCalling: false,
  socket: null
});

export const useCallContext = () => useContext(CallContext);

// ─── Authoritative signaling URL resolution ─────────────────────────────────
function resolveSignalingUrl(): string | null {
  const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL?.trim();

  if (typeof window !== "undefined") {
    const browserHost = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocalBrowser = browserHost === "localhost" || browserHost === "127.0.0.1";

    if (browserHost.includes("devtunnels.ms")) {
      if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        const derivedSignalingHost = browserHost.replace(/-3000(?=\.|\b)/, "-4001");
        return `${protocol}//${derivedSignalingHost}`;
      }
    }

    if (!isLocalBrowser) {
      if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        return `${protocol}//${browserHost}:4001`;
      }
    }

    if (isLocalBrowser) {
      if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        return `http://${browserHost}:4001`;
      }
    }
  }

  if (envUrl && envUrl.length > 0) return envUrl;
  return null;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useAuthStore();

  const currentUserId = useMemo(() => {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const isProviderPortal = pathname?.startsWith("/provider") || pathname?.startsWith("/jobprovider");
    if (currentUser?.id) return currentUser.id;
    return isDemo ? (isProviderPortal ? "provider-1" : "customer-1") : "";
  }, [pathname, currentUser]);

  const userTokenRef = useRef<string | undefined>(currentUser?.token);
  useEffect(() => {
    userTokenRef.current = currentUser?.token;
  }, [currentUser?.token]);

  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token =
      userTokenRef.current ||
      (typeof window !== "undefined"
        ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
        : null);
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const uid = currentUserIdRef.current;
    if (uid) headers["x-user-id"] = uid;
    return headers;
  }, []);

  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [livekitCredentials, setLivekitCredentials] = useState<LiveKitCredentials | null>(null);
  const [callState, setCallState] = useState<"IDLE" | "CREATING" | "OUTGOING" | "INCOMING" | "ACCEPTING" | "ACTIVE">("IDLE");

  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const socketRef = useRef<Socket | null>(null);
  const socketConnectedRef = useRef(false);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const connectResolversRef = useRef<
    Array<{ resolve: () => void; reject: (e?: any) => void; timer: ReturnType<typeof setTimeout> }>
  >([]);

  const livekitCredentialsRef = useRef(livekitCredentials);
  useEffect(() => { livekitCredentialsRef.current = livekitCredentials; }, [livekitCredentials]);

  const activeCallRef = useRef(activeCall);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  const callStartInProgressRef = useRef(false);
  const acceptInProgressRef = useRef(false);
  const endInProgressRef = useRef(false);
  const fetchingTokenForRef = useRef<string | null>(null);
  const activeCallMissingCountRef = useRef(0);
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOutgoingTimeout = useCallback(() => {
    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }
  }, []);

  // ─── LiveKit token fetch (fallback only) ──────────────────────────────────
  // ─── LiveKit token fetch (Recovery & manual retry) ──────────────────────────
  const fetchMyLiveKitToken = useCallback((bookingId: string) => {
    if (!currentUserIdRef.current || !bookingId) return;
    const currentCreds = livekitCredentialsRef.current;
    if (currentCreds && currentCreds.roomName && fetchingTokenForRef.current === bookingId) return;
    fetchingTokenForRef.current = bookingId;

    fetch("/api/livekit/token", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ bookingId })
    })
      .then(r => r.json())
      .then(d => {
        if (d.participantToken && d.serverUrl && d.roomName) {
          // Latch credentials: only set if credentials not present or roomName changed
          if (!livekitCredentialsRef.current || livekitCredentialsRef.current.roomName !== d.roomName) {
            setLivekitCredentials({ serverUrl: d.serverUrl, participantToken: d.participantToken, roomName: d.roomName });
          }
        } else {
          fetchingTokenForRef.current = null;
        }
      })
      .catch(err => {
        console.error("[LIVEKIT_ERROR] Failed to fetch token:", err);
        fetchingTokenForRef.current = null;
      });
  }, [getHeaders]);

  // ─── Signal payload handler ───────────────────────────────────────────────
  const handleSignalPayloadRef = useRef<(data: any) => void>(() => {});

  useEffect(() => {
    handleSignalPayloadRef.current = (data: any) => {
      if (!data || !data.call) return;
      const { type, call, livekit } = data;
      const uid = currentUserIdRef.current;

      const matchesMe = (id: string) => {
        if (!id || !uid) return false;
        if (id === uid) return true;
        if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
          if ((uid.includes("prov") || uid === "provider-1") && (id.includes("prov") || id === "provider-1")) return true;
          if ((uid.includes("cust") || uid === "customer-1") && (id.includes("cust") || id === "customer-1")) return true;
        }
        return false;
      };

      if (type === "call:ring" || type === "call:initiate") {
        const isReceiver = matchesMe(call.receiverId);
        if (isReceiver && callStateRef.current === "IDLE") {
          setActiveCall(call);
          setCallState("INCOMING");
          ringtonePlayer.startRingtone("incoming");
        }
      } else if (type === "call:accept") {
        // Idempotency check: if already active for same call, don't restart media session
        if (activeCallRef.current && activeCallRef.current.id === call.id && callStateRef.current === "ACTIVE" && livekitCredentialsRef.current) {
          return;
        }
        clearOutgoingTimeout();
        const isParticipant = matchesMe(call.callerId) || matchesMe(call.receiverId);
        if (isParticipant || callStateRef.current === "OUTGOING" || callStateRef.current === "INCOMING" || callStateRef.current === "ACCEPTING") {
          setActiveCall(call);
          setCallState("ACTIVE");
          ringtonePlayer.stopRingtone();

          if (livekit && livekit.participantToken && livekit.roomName) {
            if (!livekitCredentialsRef.current || livekitCredentialsRef.current.roomName !== livekit.roomName) {
              setLivekitCredentials(livekit);
            }
          } else if (!livekitCredentialsRef.current && call.bookingId) {
            fetchMyLiveKitToken(call.bookingId);
          }
        }
      } else if (type === "call:reject" || type === "call:end" || type === "call:cancel") {
        if (activeCallRef.current && activeCallRef.current.id !== call.id) return;

        clearOutgoingTimeout();
        ringtonePlayer.stopRingtone();
        setCallState("IDLE");
        setActiveCall(null);
        setLivekitCredentials(null);
        callStartInProgressRef.current = false;
        acceptInProgressRef.current = false;
        endInProgressRef.current = false;
        fetchingTokenForRef.current = null;
      }
    };
  }, [clearOutgoingTimeout, fetchMyLiveKitToken]);

  // ─── Socket.IO Initialization ──────────────────────────────────────────────
  const initializeSocket = useCallback((): Promise<void> => {
    const uid = currentUserIdRef.current;
    if (!uid) {
      console.warn("[SIGNALING] initializeSocket called with no currentUserId");
      return Promise.reject(new Error("No user ID available for signaling"));
    }

    if (socketConnectedRef.current && socketRef.current) {
      return Promise.resolve();
    }

    const signalingUrl = resolveSignalingUrl();
    if (!signalingUrl) {
      const err = new Error(
        `[SIGNALING_CONFIG_ERROR] No valid signaling server URL configured.`
      );
      console.error(err.message);
      return Promise.reject(err);
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      socketConnectedRef.current = false;
    }

    const token =
      userTokenRef.current ||
      (typeof window !== "undefined"
        ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
        : null);

    const isDevTunnel = signalingUrl.includes("devtunnels.ms");
    const isHttps = signalingUrl.startsWith("https");
    const transports = isDevTunnel
      ? ["polling", "websocket"]
      : isHttps
      ? ["websocket", "polling"]
      : ["websocket", "polling"];

    console.log(`[SIGNALING] Connecting Socket.IO to ${signalingUrl} as userId=${uid}...`);

    const socket = io(signalingUrl, {
      auth: { token, userId: uid },
      transports,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      path: "/socket.io/",
      secure: isHttps || isDevTunnel,
      rejectUnauthorized: false
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[SIGNALING] Socket.IO connected! socketId=${socket.id}`);
      socketConnectedRef.current = true;
      socket.emit("register", uid);

      const resolvers = connectResolversRef.current.splice(0);
      resolvers.forEach(({ resolve, timer }) => {
        clearTimeout(timer);
        resolve();
      });
    });

    socket.on("connect_error", (err: Error) => {
      const host = (() => { try { return new URL(signalingUrl || "").host; } catch { return signalingUrl; } })();
      console.warn(`[SIGNALING] Connection notice host=${host}:`, err.message);
    });

    socket.on("disconnect", (reason: string) => {
      console.warn("[SIGNALING] Socket.IO disconnected reason=", reason);
      socketConnectedRef.current = false;
      connectPromiseRef.current = null;
    });

    // Real-time signal listener dispatcher
    const events = ["call:ring", "call:initiate", "call:accept", "call:reject", "call:end", "call:cancel"];
    events.forEach(evt => {
      socket.on(evt, (data: any) => {
        console.log(`[SIGNALING_EVENT] ${evt}:`, data);
        handleSignalPayloadRef.current({ type: evt, ...data });
      });
    });

    return Promise.resolve();
  }, []);

  const ensureSocketConnected = useCallback(async (): Promise<void> => {
    if (socketConnectedRef.current && socketRef.current) {
      return;
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        connectResolversRef.current = connectResolversRef.current.filter(r => r.timer !== timer);
        connectPromiseRef.current = null;
        resolve(); // Soft fallback: do not throw hard error if signaling socket lags
      }, 5000);

      connectResolversRef.current.push({ resolve, reject, timer });

      initializeSocket().catch(() => resolve());
    });

    connectPromiseRef.current = promise;
    return promise;
  }, [initializeSocket]);

  // Proactively warm up socket connection on auth load
  useEffect(() => {
    if (currentUserId) {
      ensureSocketConnected().catch(() => {});
      registerAndSubscribeUser(currentUserId).catch(() => {});
    }

    let crossTabChannel: BroadcastChannel | null = null;
    try {
      crossTabChannel = new BroadcastChannel("cityconnect-calls-global-sync");
      crossTabChannel.onmessage = (event) => {
        if (event.data) {
          handleSignalPayloadRef.current(event.data);
        }
      };
    } catch {}

    return () => {
      if (crossTabChannel) {
        try { crossTabChannel.close(); } catch {}
      }
    };
  }, [currentUserId, ensureSocketConnected]);

  // Logout cleanup
  const prevUserIdRef = useRef(currentUserId);
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    if (prevId && prevId !== currentUserId && socketRef.current) {
      console.log(`[CALL] User changed (${prevId} → ${currentUserId}). Destroying old socket.`);
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      socketConnectedRef.current = false;
      connectPromiseRef.current = null;
      connectResolversRef.current = [];
    }
  }, [currentUserId]);

  // ─── Real-time active call sync (2s polling recovery fallback) ────────────
  useEffect(() => {
    if (!currentUserId) return;

    const syncCallStatus = async () => {
      try {
        const res = await fetch("/api/calls/active", { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();

        if (data.call) {
          activeCallMissingCountRef.current = 0;
          const call = data.call;
          const uid = currentUserIdRef.current;
          const matchesMe = (id: string) => {
            if (!id || !uid) return false;
            if (id === uid) return true;
            if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
              if ((uid.includes("prov") || uid === "provider-1") && (id.includes("prov") || id === "provider-1")) return true;
              if ((uid.includes("cust") || uid === "customer-1") && (id.includes("cust") || id === "customer-1")) return true;
            }
            return false;
          };
          const isCaller = matchesMe(call.callerId);
          const isReceiver = matchesMe(call.receiverId);

          if (call.status === "INITIATED" || call.status === "RINGING") {
            if (isReceiver && callStateRef.current === "IDLE") {
              setActiveCall(call); setCallState("INCOMING"); ringtonePlayer.startRingtone("incoming");
            } else if (isCaller && callStateRef.current === "IDLE") {
              setActiveCall(call); setCallState("OUTGOING");
            }
          } else if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
            clearOutgoingTimeout();
            if ((isCaller || isReceiver) && callStateRef.current !== "ACTIVE") {
              setActiveCall(call); setCallState("ACTIVE"); ringtonePlayer.stopRingtone();
              
              // CRITICAL BUG FIX 23: Ignore token replacement if room is already active
              if (data.livekit) {
                if (!livekitCredentialsRef.current || livekitCredentialsRef.current.roomName !== data.livekit.roomName) {
                  setLivekitCredentials(data.livekit);
                }
              } else if (!livekitCredentialsRef.current && call.bookingId) {
                fetchMyLiveKitToken(call.bookingId);
              }
            }
          } else if (["REJECTED","ENDED","CANCELLED","COMPLETED","BUSY","MISSED"].includes(call.status)) {
            // CRITICAL BUG FIX 22: Validate call.id before tearing down
            if (activeCallRef.current && activeCallRef.current.id === call.id) {
              console.log(`[CALL] Server reported call status '${call.status}'. Clearing call.`);
              clearOutgoingTimeout();
              setCallState("IDLE"); setActiveCall(null); setLivekitCredentials(null);
              ringtonePlayer.stopRingtone();
              callStartInProgressRef.current = false;
              acceptInProgressRef.current = false;
              endInProgressRef.current = false;
              fetchingTokenForRef.current = null;
            }
          }
        } else {
          // CRITICAL BUG FIX 2: Active call missing counter / grace period before cleanup
          activeCallMissingCountRef.current += 1;
          const currentState = callStateRef.current;
          const isTransientState = currentState === "CREATING" || currentState === "OUTGOING" || currentState === "INCOMING" || currentState === "ACCEPTING";
          const isTempCall = activeCallRef.current?.id?.startsWith("temp-");
          
          if (!isTransientState && !isTempCall && currentState === "ACTIVE" && activeCallMissingCountRef.current >= 5) {
            console.log("[CALL] 5 consecutive null responses during ACTIVE state. Clearing call.");
            clearOutgoingTimeout();
            setCallState("IDLE"); setActiveCall(null); setLivekitCredentials(null);
            ringtonePlayer.stopRingtone();
            callStartInProgressRef.current = false;
            acceptInProgressRef.current = false;
            endInProgressRef.current = false;
            fetchingTokenForRef.current = null;
          }
        }
      } catch {}
    };

    syncCallStatus();
    const interval = setInterval(syncCallStatus, 2000);
    return () => clearInterval(interval);
  }, [currentUserId, getHeaders, fetchMyLiveKitToken, clearOutgoingTimeout]);

  // ─── startCall ────────────────────────────────────────────────────────────
  const startCall = useCallback(async (bookingId: string) => {
    if (callStartInProgressRef.current || callStateRef.current !== "IDLE" || activeCallRef.current) return;
    if (!currentUserIdRef.current) {
      console.error("[CALL_ERROR] Please log in to initiate a voice call.");
      return;
    }

    const clickTime = Date.now();
    callStartInProgressRef.current = true;

    ensureSocketConnected().catch(() => {});

    const tempId = `temp-${Date.now()}`;
    const tempCall: CallRecord = {
      id: tempId,
      bookingId,
      callerId: currentUserIdRef.current,
      receiverId: "pending",
      callerName: currentUser?.name || "Customer",
      receiverName: "Service Partner",
      status: "INITIATED",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      durationSeconds: 0
    };

    setActiveCall(tempCall);
    setCallState("OUTGOING");
    ringtonePlayer.startRingtone("outgoing");

    // Outgoing ring timeout (30 seconds)
    clearOutgoingTimeout();
    outgoingTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === "OUTGOING") {
        console.log("[CALL] Outgoing ring timed out after 30s");
        ringtonePlayer.stopRingtone();
        setCallState("IDLE"); setActiveCall(null);
        callStartInProgressRef.current = false;
      }
    }, 30000);

    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ bookingId })
      });
      const data = await res.json();
      console.log(`[CALL_PERF] start_call_api_ms=${Date.now() - clickTime}`);

      if (res.ok && data.success && data.call) {
        setActiveCall(data.call);
        if (data.livekit) {
          setLivekitCredentials(data.livekit);
        }
        if (socketRef.current && socketConnectedRef.current) {
          socketRef.current.emit("call:initiate", { call: data.call });
        }
        try {
          const bc = new BroadcastChannel("cityconnect-calls-global-sync");
          bc.postMessage({ type: "call:initiate", call: data.call });
          bc.close();
        } catch {}
      } else {
        clearOutgoingTimeout();
        ringtonePlayer.stopRingtone();
        setCallState("IDLE"); setActiveCall(null);
        callStartInProgressRef.current = false;
      }
    } catch (err: any) {
      console.error("[CALL_ERROR] Error initiating call:", err);
      clearOutgoingTimeout();
      ringtonePlayer.stopRingtone();
      setCallState("IDLE"); setActiveCall(null);
      callStartInProgressRef.current = false;
    }
  }, [getHeaders, ensureSocketConnected, currentUser?.name, clearOutgoingTimeout]);

  // ─── acceptCall ───────────────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (acceptInProgressRef.current || !activeCallRef.current) return;

    const acceptStartTime = Date.now();
    acceptInProgressRef.current = true;
    clearOutgoingTimeout();
    ringtonePlayer.stopRingtone();
    setCallState("ACCEPTING");

    const callId = activeCallRef.current.id;

    ensureSocketConnected().catch(() => {});

    try {
      const res = await fetch(`/api/calls/${callId}/accept`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json();
      console.log(`[CALL_PERF] accept_api_ms=${Date.now() - acceptStartTime}`);

      if (res.ok && data.success) {
        setActiveCall(data.call);
        setCallState("ACTIVE");
        if (data.livekit) {
          if (!livekitCredentialsRef.current || livekitCredentialsRef.current.roomName !== data.livekit.roomName) {
            setLivekitCredentials(data.livekit);
          }
        } else if (data.call.bookingId && !livekitCredentialsRef.current) {
          fetchMyLiveKitToken(data.call.bookingId);
        }
        try {
          const bc = new BroadcastChannel("cityconnect-calls-global-sync");
          bc.postMessage({ type: "call:accept", call: data.call, livekit: data.livekit });
          bc.close();
        } catch {}
      } else {
        ringtonePlayer.stopRingtone();
        setCallState("IDLE"); setActiveCall(null); setLivekitCredentials(null);
        acceptInProgressRef.current = false;
        callStartInProgressRef.current = false;
        const errMsg = data.error || "Failed to accept call";
        const isExpectedEndedState =
          errMsg.includes("ENDED") ||
          errMsg.includes("CANCELLED") ||
          errMsg.includes("MISSED") ||
          errMsg.includes("EXPIRED") ||
          errMsg.includes("REJECTED");
        if (isExpectedEndedState) {
          console.info("[CALL] Call is no longer active:", errMsg);
        } else {
          console.error("[CALL_ERROR]", errMsg);
        }
      }
    } catch (err: any) {
      console.error("[CALL_SESSION_FAILED] Error accepting call:", err);
      ringtonePlayer.stopRingtone();
      setCallState("IDLE"); setActiveCall(null); setLivekitCredentials(null);
      acceptInProgressRef.current = false;
      callStartInProgressRef.current = false;
    }
  }, [getHeaders, ensureSocketConnected, fetchMyLiveKitToken, clearOutgoingTimeout]);

  // ─── rejectCall ───────────────────────────────────────────────────────────
  const rejectCall = useCallback(async () => {
    if (!activeCallRef.current) return;
    const callId = activeCallRef.current.id;

    clearOutgoingTimeout();
    ringtonePlayer.stopRingtone();
    setCallState("IDLE"); setActiveCall(null); setLivekitCredentials(null);

    if (socketRef.current && socketConnectedRef.current) {
      socketRef.current.emit("call:reject", { call: { id: callId } });
    }

    try {
      await fetch(`/api/calls/${callId}/reject`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });
    } catch (err) {
      console.warn("[CALL] Reject call API notice:", err);
    }
  }, [getHeaders, clearOutgoingTimeout]);

  // ─── endCall ──────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    if (endInProgressRef.current) return;
    endInProgressRef.current = true;

    clearOutgoingTimeout();
    ringtonePlayer.stopRingtone();

    const callToClose = activeCallRef.current;
    setCallState("IDLE");
    setActiveCall(null);
    setLivekitCredentials(null);

    if (callToClose && callToClose.id && !callToClose.id.startsWith("temp-")) {
      if (socketRef.current && socketConnectedRef.current) {
        socketRef.current.emit("call:end", { call: callToClose });
      }
      try {
        const bc = new BroadcastChannel("cityconnect-calls-global-sync");
        bc.postMessage({ type: "call:end", call: callToClose });
        bc.close();
      } catch {}

      try {
        await fetch(`/api/calls/${callToClose.id}/end`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({})
        });
      } catch (err) {
        console.warn("[CALL] End call API notice:", err);
      }
    }

    callStartInProgressRef.current = false;
    acceptInProgressRef.current = false;
    endInProgressRef.current = false;
    fetchingTokenForRef.current = null;
  }, [getHeaders, clearOutgoingTimeout]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        livekitCredentials,
        callState,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        isCalling: callState !== "IDLE",
        socket: socketRef.current
      }}
    >
      {children}

      {/* Render modals based on callState */}
      {callState === "INCOMING" && activeCall && (
        <IncomingCall
          call={activeCall}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {callState === "OUTGOING" && activeCall && (
        <OutgoingCall
          call={activeCall}
          onCancel={endCall}
        />
      )}

      {(callState === "ACTIVE" || callState === "ACCEPTING") && activeCall && (
        <ActiveCall
          call={activeCall}
          livekit={livekitCredentials}
          currentUserId={currentUserId}
          onEndCall={endCall}
        />
      )}
    </CallContext.Provider>
  );
}
