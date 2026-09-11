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
import { callAudioManager } from "@/lib/callAudioManager";
import { registerAndSubscribeUser } from "@/lib/registerSW";
import { App } from "@capacitor/app";
import { nativeCallBridge } from "@/lib/nativeCallBridge";

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
  useEffect(() => { 
    callStateRef.current = callState; 
    callAudioManager.setCallState(callState);
  }, [callState]);

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

  const matchesMe = useCallback((id: string) => {
    const uid = currentUserIdRef.current;
    if (!id || !uid) return false;
    if (id === uid) return true;
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      if ((uid.includes("prov") || uid === "provider-1") && (id.includes("prov") || id === "provider-1")) return true;
      if ((uid.includes("cust") || uid === "customer-1") && (id.includes("cust") || id === "customer-1")) return true;
    }
    return false;
  }, []);

  const nativeAcceptRetryCountRef = useRef<{ [callId: string]: number }>({});
  const handleNativeCallActionRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const handleAcceptTransientFailure = useCallback(async (callId: string, errorMsg: string) => {
    const currentRetries = (nativeAcceptRetryCountRef.current[callId] || 0) + 1;
    nativeAcceptRetryCountRef.current[callId] = currentRetries;
    const MAX_RETRIES = 3;

    if (currentRetries <= MAX_RETRIES) {
      console.warn(`[CALL] Accept failed (${errorMsg}). Transient failure, retrying attempt ${currentRetries}/${MAX_RETRIES} in 1500ms...`);
      setTimeout(() => {
        handleNativeCallActionRef.current();
      }, 1500);
    } else {
      console.error(`[CALL] Accept failed after ${MAX_RETRIES} attempts (${errorMsg}). Conclusive timeout. Clearing pending action.`);
      delete nativeAcceptRetryCountRef.current[callId];
      await nativeCallBridge.clearPendingCallAction();
      await nativeCallBridge.dismissNativeCall(callId);
      callAudioManager.stopAll();
      setCallState("IDLE");
      setActiveCall(null);
      setLivekitCredentials(null);
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
        if (isReceiver) {
          // Connected Call Protection: Never interrupt active or accepting call
          if (callStateRef.current === "ACTIVE" || callStateRef.current === "ACCEPTING") {
            return;
          }

          // If the app is in the background or hidden, trigger native heads-up call banner with CallStyle
          const isHidden = typeof document !== "undefined" && document.hidden;
          if (isHidden) {
            nativeCallBridge.showIncomingCallNotification({
              callId: call.id,
              callerName: call.callerName || "BelConnect User",
              serviceName: call.serviceName || "Voice Call",
              bookingId: call.bookingId
            });
          } else {
            // Dismiss native notification only if user has app actively open in foreground
            if (call?.id) nativeCallBridge.dismissNativeCall(call.id);
          }

          // Duplicate-event protection: If this call ID is already ringing, do not restart ringtone
          if (callStateRef.current === "INCOMING" && activeCallRef.current?.id === call.id) {
            return;
          }
          if (callStateRef.current === "IDLE") {
            setActiveCall(call);
            setCallState("INCOMING");
            callAudioManager.playIncoming();
            callAudioManager.playIncoming(call.id);
          }
        }
      } else if (type === "call:accept") {
        if (call?.id) nativeCallBridge.dismissNativeCall(call.id);
        clearOutgoingTimeout();
        callAudioManager.stopAll();

        // Idempotency check: if already active for same call, don't restart media session
        if (activeCallRef.current && activeCallRef.current.id === call.id && callStateRef.current === "ACTIVE" && livekitCredentialsRef.current) {
          return;
        }
        const isParticipant = matchesMe(call.callerId) || matchesMe(call.receiverId);
        if (isParticipant || callStateRef.current === "OUTGOING" || callStateRef.current === "INCOMING" || callStateRef.current === "ACCEPTING") {
          setActiveCall(call);
          setCallState("ACTIVE");

          if (livekit && livekit.participantToken && livekit.roomName) {
            if (!livekitCredentialsRef.current || livekitCredentialsRef.current.roomName !== livekit.roomName) {
              setLivekitCredentials(livekit);
            }
          } else if (!livekitCredentialsRef.current && call.bookingId) {
            fetchMyLiveKitToken(call.bookingId);
          }
        }
      } else if (type === "call:reject" || type === "call:end" || type === "call:cancel" || type === "call:missed" || type === "call:busy") {
        if (call?.id) nativeCallBridge.dismissNativeCall(call.id);
        if (activeCallRef.current && activeCallRef.current.id !== call.id) return;

        clearOutgoingTimeout();
        callAudioManager.stopAll();
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
      callAudioManager.stopAll();
    });

    // Real-time signal listener dispatcher
    const events = [
      "call:ring",
      "call:initiate",
      "call:accept",
      "call:reject",
      "call:end",
      "call:cancel",
      "call:missed",
      "call:busy"
    ];
    events.forEach(evt => {
      socket.on(evt, (data: any) => {
        console.log(`[SIGNALING_EVENT] ${evt}:`, data);
        handleSignalPayloadRef.current({ type: evt, ...data });
      });
    });

    socket.on("call:signal", (data: any) => {
      console.log("[SIGNALING_EVENT] call:signal:", data);
      handleSignalPayloadRef.current(data);
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
  // ─── Native Android background call wake-up & accept action recovery ─────
  // ─── Native Android background call wake-up & web push accept action recovery ─────
  const handleNativeCallAction = useCallback(async () => {
    handleNativeCallActionRef.current = handleNativeCallAction;

    // 1. Check Web URL search params (e.g. from Web Push notification click in Chrome)
    if (typeof window !== "undefined" && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const webCallId = urlParams.get("callId");
        const autoAccept = urlParams.get("autoAccept") === "true";
        const hasActiveCallParam = urlParams.get("activeCall") === "true";

        if (webCallId && (hasActiveCallParam || autoAccept)) {
          // Remove query params from address bar without page reload
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          if (autoAccept) {
            console.log(`[CALL] Handling Web Push Auto-Accept for call: ${webCallId}`);
            clearOutgoingTimeout();
            callAudioManager.stopAll();
            setCallState("ACCEPTING");
            acceptInProgressRef.current = true;
            ensureSocketConnected().catch(() => {});

            const res = await fetch(`/api/calls/${webCallId}/accept`, {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify({})
            });
            const data = await res.json();
            if (res.ok && data.success) {
              setActiveCall(data.call);
              setCallState("ACTIVE");
              if (data.livekit) {
                setLivekitCredentials(data.livekit);
              } else if (data.call.bookingId) {
                fetchMyLiveKitToken(data.call.bookingId);
              }
            } else {
              console.warn("[CALL] Failed to auto-accept call from Web Push:", data.error);
              callAudioManager.stopAll();
              setCallState("IDLE");
              setActiveCall(null);
              setLivekitCredentials(null);
            }
            return;
          } else {
            console.log(`[CALL] Handling Web Push notification click for call: ${webCallId}`);
            const res = await fetch(`/api/calls/${webCallId}`, { headers: getHeaders() });
            const data = await res.json();
            if (res.ok && data.call && (data.call.status === "INITIATED" || data.call.status === "RINGING")) {
              setActiveCall(data.call);
              setCallState("INCOMING");
              callAudioManager.playIncoming(data.call.id);
            }
            return;
          }
        }
      } catch (e) {
        console.warn("[CALL] Error parsing URL search params for call:", e);
      }
    }

    // 2. Check Native Android pending actions (e.g. from NotificationCompat.CallStyle action buttons)
    if (!nativeCallBridge.isNative()) return;
    try {
      const pending = await nativeCallBridge.getPendingCallAction();
      if (!pending || !pending.callId || !pending.action) return;

      const token =
        userTokenRef.current ||
        (typeof window !== "undefined"
          ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
          : null);

      // Guard: On cold start, if auth token is still loading from storage, preserve pendingAction
      // so it can be consumed as soon as auth resolves, rather than dropping it on unauthenticated 401.
      if (!token && !currentUserIdRef.current) {
        console.log("[CALL] Native pending action detected but auth is not yet resolved. Preserving pendingAction...");
        return;
      }

      const { action, callId } = pending;

      if (action === "accept") {
        console.log(`[CALL] Handling native notification Accept action for call: ${callId}`);
        clearOutgoingTimeout();
        callAudioManager.stopAll();
        setCallState("ACCEPTING");
        acceptInProgressRef.current = true;
        ensureSocketConnected().catch(() => {});

        // Step 3: GET /api/calls/{callId} to verify status is INITIATED or RINGING (or already ACCEPTED/CONNECTED by same user)
        let callCheckRes: Response;
        try {
          callCheckRes = await fetch(`/api/calls/${callId}`, { headers: getHeaders() });
        } catch (fetchErr: any) {
          handleAcceptTransientFailure(callId, fetchErr?.message || "Network error checking call status");
          return;
        }

        const callCheckData = await callCheckRes.json().catch(() => ({}));
        const existingCall = callCheckData?.call;

        // Step 7: If call is conclusively CANCELLED / REJECTED / EXPIRED / ENDED / BUSY / MISSED, clear pending action immediately
        if (existingCall) {
          const terminalStatuses = ["CANCELLED", "REJECTED", "EXPIRED", "ENDED", "BUSY", "MISSED"];
          if (terminalStatuses.includes(existingCall.status)) {
            console.log(`[CALL] Call ${callId} is conclusively '${existingCall.status}'. Clearing pending action immediately.`);
            await nativeCallBridge.clearPendingCallAction();
            await nativeCallBridge.dismissNativeCall(callId);
            delete nativeAcceptRetryCountRef.current[callId];
            callAudioManager.stopAll();
            setCallState("IDLE");
            setActiveCall(null);
            setLivekitCredentials(null);
            return;
          }

          // Step 3 (cont): If already ACCEPTED or CONNECTED by this same user -> treat as idempotent success
          if (existingCall.status === "ACCEPTED" || existingCall.status === "CONNECTED") {
            const isMe = matchesMe(existingCall.receiverId) || matchesMe(existingCall.callerId);
            if (isMe) {
              console.log(`[CALL] Call ${callId} is already in status '${existingCall.status}'. Idempotent recovery.`);
              setActiveCall(existingCall);
              setCallState("ACTIVE");
              if (existingCall.bookingId) {
                await fetchMyLiveKitToken(existingCall.bookingId);
              }
              // Step 6: Clear pending action and dismiss native notification
              await nativeCallBridge.clearPendingCallAction();
              await nativeCallBridge.dismissNativeCall(callId);
              delete nativeAcceptRetryCountRef.current[callId];
              return;
            }
          }
        }

        // Step 4: POST /api/calls/{callId}/accept
        let res: Response;
        try {
          res = await fetch(`/api/calls/${callId}/accept`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({})
          });
        } catch (fetchErr: any) {
          handleAcceptTransientFailure(callId, fetchErr?.message || "Network error during accept request");
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          // Step 5: Obtain/confirm LiveKit credentials and begin room connection
          setActiveCall(data.call);
          setCallState("ACTIVE");
          if (data.livekit) {
            setLivekitCredentials(data.livekit);
          } else if (data.call?.bookingId) {
            fetchMyLiveKitToken(data.call.bookingId);
          }

          // Step 6: ONLY THEN clear the pending action and dismiss the native notification
          await nativeCallBridge.clearPendingCallAction();
          await nativeCallBridge.dismissNativeCall(callId);
          delete nativeAcceptRetryCountRef.current[callId];
          console.log(`[CALL] Successfully accepted call ${callId} and cleared pending action.`);
        } else {
          const errMsg = data?.error || `HTTP ${res.status}`;
          // Conclusive non-recoverable error (e.g. 400 Bad Request, 403 Forbidden, 404 Not Found)
          if (res.status === 400 || res.status === 403 || res.status === 404) {
            console.warn(`[CALL] Conclusive failure accepting call ${callId} (${errMsg}). Clearing pending action.`);
            await nativeCallBridge.clearPendingCallAction();
            await nativeCallBridge.dismissNativeCall(callId);
            delete nativeAcceptRetryCountRef.current[callId];
            callAudioManager.stopAll();
            setCallState("IDLE");
            setActiveCall(null);
            setLivekitCredentials(null);
          } else {
            // Step 8: Transient failure -> retry within bounded window
            handleAcceptTransientFailure(callId, errMsg);
          }
        }
      } else if (action === "incoming") {
        console.log(`[CALL] Handling native notification Incoming click for call: ${callId}`);
        const res = await fetch(`/api/calls/${callId}`, { headers: getHeaders() });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.call && (data.call.status === "INITIATED" || data.call.status === "RINGING")) {
          setActiveCall(data.call);
          setCallState("INCOMING");
          callAudioManager.playIncoming(data.call.id);
        } else {
          console.log(`[CALL] Stale incoming notification (status: ${data?.call?.status || "unknown"}). Dismissing.`);
          callAudioManager.stopAll();
          setCallState("IDLE");
          setActiveCall(null);
        }
        await nativeCallBridge.clearPendingCallAction();
        await nativeCallBridge.dismissNativeCall(callId);
      }
    } catch (err) {
      console.warn("[CALL] Error checking native call action:", err);
    } finally {
      acceptInProgressRef.current = false;
    }
  }, [clearOutgoingTimeout, ensureSocketConnected, getHeaders, fetchMyLiveKitToken, handleAcceptTransientFailure, matchesMe]);

  // Proactively check native call action on mount & app resume/foreground transition
  useEffect(() => {
    handleNativeCallAction();

    let resumeListener: any = null;
    let appStateListener: any = null;

    if (typeof window !== "undefined" && nativeCallBridge.isNative()) {
      App.addListener("resume", () => {
        console.log("[CALL] App resumed from background. Reconnecting socket & checking call actions...");
        ensureSocketConnected().catch(() => {});
        handleNativeCallAction();
      }).then((l) => { resumeListener = l; }).catch(() => {});

      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          console.log("[CALL] App active state changed to foreground.");
          ensureSocketConnected().catch(() => {});
          handleNativeCallAction();
        }
      }).then((l) => { appStateListener = l; }).catch(() => {});
    }

    return () => {
      if (resumeListener) resumeListener.remove();
      if (appStateListener) appStateListener.remove();
    };
  }, [handleNativeCallAction, ensureSocketConnected]);

  // Proactively warm up socket connection on auth load & sync native push token
  useEffect(() => {
    if (currentUserId) {
      ensureSocketConnected().catch(() => {});
      registerAndSubscribeUser(currentUserId).catch(() => {});
      nativeCallBridge.syncNativeDeviceToken(currentUserId).catch(() => {});
      handleNativeCallAction();

      const token =
        userTokenRef.current ||
        (typeof window !== "undefined"
          ? localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token")
          : null);
      if (token) {
        nativeCallBridge.setAuthCredentials(token, typeof window !== "undefined" ? window.location.origin : undefined).catch(() => {});
      }
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

  // Cleanup all audio if CallProvider unmounts
  // ─── Native Android Active-Call Foreground Service Lifecycle ─────────────
  useEffect(() => {
    if (callState === "ACTIVE" && activeCall && activeCall.id && !activeCall.id.startsWith("temp-")) {
      const isCaller = currentUserId === activeCall.callerId;
      const peerName = isCaller ? (activeCall.receiverName || "Service Partner") : (activeCall.callerName || "Customer");
      nativeCallBridge.startActiveCallService({
        callId: activeCall.id,
        peerName,
        serviceName: activeCall.serviceName || "BelConnect Voice Call"
      }).catch(() => {});
    } else if (callState === "IDLE" || callState === "OUTGOING" || callState === "INCOMING") {
      nativeCallBridge.stopActiveCallService().catch(() => {});
    }
  }, [callState, activeCall, currentUserId]);

  // Cleanup all audio and foreground services if CallProvider unmounts
  useEffect(() => {
    return () => {
      callAudioManager.stopAll();
      nativeCallBridge.stopActiveCallService().catch(() => {});
    };
  }, []);

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
              setActiveCall(call); setCallState("INCOMING"); callAudioManager.playIncoming();
              setActiveCall(call);
              setCallState("INCOMING");
              callAudioManager.playIncoming(call.id);
              if (typeof document !== "undefined" && document.hidden) {
                nativeCallBridge.showIncomingCallNotification({
                  callId: call.id,
                  callerName: call.callerName || "Customer",
                  serviceName: call.serviceName || "Voice Call",
                  bookingId: call.bookingId
                });
              }
            } else if (isCaller && callStateRef.current === "IDLE") {
              setActiveCall(call); setCallState("OUTGOING"); callAudioManager.playOutgoing();
            }
          } else if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
            clearOutgoingTimeout();
            callAudioManager.stopAll();
            if ((isCaller || isReceiver) && callStateRef.current !== "ACTIVE") {
              setActiveCall(call); setCallState("ACTIVE");
              
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
              callAudioManager.stopAll();
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
            callAudioManager.stopAll();
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
    callAudioManager.playOutgoing();

    // Outgoing ring timeout (30 seconds)
    clearOutgoingTimeout();
    outgoingTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === "OUTGOING") {
        console.log("[CALL] Outgoing ring timed out after 30s");
        callAudioManager.stopAll();
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
        callAudioManager.setCallId(data.call.id);
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
        callAudioManager.stopAll();
        setCallState("IDLE"); setActiveCall(null);
        callStartInProgressRef.current = false;
      }
    } catch (err: any) {
      console.error("[CALL_ERROR] Error initiating call:", err);
      clearOutgoingTimeout();
      callAudioManager.stopAll();
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
    callAudioManager.stopAll();
    setCallState("ACCEPTING");

    const callId = activeCallRef.current.id;
    if (callId) nativeCallBridge.dismissNativeCall(callId).catch(() => {});

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
        callAudioManager.stopAll();
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
      callAudioManager.stopAll();
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
    callAudioManager.stopAll();
    nativeCallBridge.dismissNativeCall(callId).catch(() => {});
    nativeCallBridge.stopActiveCallService().catch(() => {});
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
    callAudioManager.stopAll();
    const callToClose = activeCallRef.current;
    if (callToClose?.id) nativeCallBridge.dismissNativeCall(callToClose.id).catch(() => {});
    nativeCallBridge.stopActiveCallService().catch(() => {});

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
