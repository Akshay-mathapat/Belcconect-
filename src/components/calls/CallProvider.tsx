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
  callState: "IDLE" | "OUTGOING" | "INCOMING" | "ACTIVE";
  startCall: (bookingId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  isCalling: boolean;
}

const CallContext = createContext<CallContextType>({
  activeCall: null,
  livekitCredentials: null,
  callState: "IDLE",
  startCall: async () => {},
  acceptCall: async () => {},
  rejectCall: async () => {},
  endCall: async () => {},
  isCalling: false
});

export const useCallContext = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useAuthStore();

  const currentUserId = useMemo(() => {
    const isProviderPortal = pathname?.startsWith("/provider") || pathname?.startsWith("/jobprovider");
    if (currentUser?.id) {
      return currentUser.id;
    }
    return isProviderPortal ? "provider-1" : "customer-1";
  }, [pathname, currentUser]);

  const userToken = currentUser?.token;

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userToken) {
      headers["Authorization"] = `Bearer ${userToken}`;
    }
    if (currentUserId) {
      headers["x-user-id"] = currentUserId;
    }
    return headers;
  }, [userToken, currentUserId]);

  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [livekitCredentials, setLivekitCredentials] = useState<LiveKitCredentials | null>(null);
  const [callState, setCallState] = useState<"IDLE" | "OUTGOING" | "INCOMING" | "ACTIVE">("IDLE");

  const callStateRef = useRef(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const livekitCredentialsRef = useRef(livekitCredentials);
  useEffect(() => {
    livekitCredentialsRef.current = livekitCredentials;
  }, [livekitCredentials]);

  const activeCallRef = useRef(activeCall);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Fetch unique LiveKit token for current user session
  const fetchMyLiveKitToken = useCallback((bookingId: string) => {
    if (!currentUserId || !bookingId) return;
    fetch(`/api/livekit/token`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ bookingId })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.participantToken && resData.serverUrl) {
          setLivekitCredentials({
            serverUrl: resData.serverUrl,
            participantToken: resData.participantToken,
            roomName: resData.roomName
          });
        }
      })
      .catch((err) => console.error("Failed to fetch user LiveKit credentials:", err));
  }, [currentUserId, getHeaders]);

  // Real-time Socket.IO Signaling Connection & Event Handling
  useEffect(() => {
    ringtonePlayer.preload();
    if (!currentUserId) return;

    // Register Service Worker & Subscribe to Web Push Notifications
    registerAndSubscribeUser(currentUserId).catch(() => {});

    const getSignalingUrl = () => {
      if (typeof window !== "undefined") {
        if (process.env.NEXT_PUBLIC_SIGNALING_URL && !process.env.NEXT_PUBLIC_SIGNALING_URL.includes("localhost")) {
          return process.env.NEXT_PUBLIC_SIGNALING_URL;
        }
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const hostname = window.location.hostname || "localhost";
        return `${protocol}//${hostname}:4001`;
      }
      return process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4001";
    };

    const signalingUrl = getSignalingUrl();
    let socket: Socket | null = null;

    try {
      socket = io(signalingUrl, {
        auth: { token: userToken, userId: currentUserId },
        query: { token: userToken, userId: currentUserId },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000
      });

      socket.on("connect", () => {
        console.log(`[CallProvider] Socket.IO Connected (${socket?.id}) to ${signalingUrl} for user: ${currentUserId}`);
      });

      const handleSignalPayload = (data: any) => {
        if (!data || !data.call) return;
        const { type, call, livekit } = data;

        const isUserProvider = (id: string) => !!id && (id.includes("prov") || id === "provider-1");
        const isUserCustomer = (id: string) => !!id && (id.includes("cust") || id === "customer-1");

        const matchesMe = (id: string) =>
          id === currentUserId ||
          (isUserProvider(currentUserId) && isUserProvider(id)) ||
          (isUserCustomer(currentUserId) && isUserCustomer(id));

        if (type === "call:ring" || type === "call:initiate") {
          const isReceiver = matchesMe(call.receiverId);
          if (isReceiver && callStateRef.current === "IDLE") {
            setActiveCall(call);
            setCallState("INCOMING");
            ringtonePlayer.startRingtone("incoming");
          }
        } else if (type === "call:accept") {
          const isParticipant = matchesMe(call.callerId) || matchesMe(call.receiverId);
          if (isParticipant || callStateRef.current === "OUTGOING" || callStateRef.current === "INCOMING") {
            setActiveCall(call);
            setCallState("ACTIVE");
            ringtonePlayer.stopRingtone();
            if (livekit) {
              setLivekitCredentials(livekit);
            } else if (call.bookingId) {
              fetchMyLiveKitToken(call.bookingId);
            }
          }
        } else if (type === "call:reject") {
          if (callStateRef.current === "OUTGOING") {
            alert("Call was declined by recipient.");
          }
          setCallState("IDLE");
          setActiveCall(null);
          setLivekitCredentials(null);
          ringtonePlayer.stopRingtone();
        } else if (type === "call:busy") {
          if (callStateRef.current === "OUTGOING") {
            alert("User is currently on another call.");
          }
          setCallState("IDLE");
          setActiveCall(null);
          setLivekitCredentials(null);
          ringtonePlayer.stopRingtone();
        } else if (["call:end", "call:cancel", "call:missed"].includes(type)) {
          setCallState("IDLE");
          setActiveCall(null);
          setLivekitCredentials(null);
          ringtonePlayer.stopRingtone();
        }
      };

      socket.on("call:signal", (data) => {
        handleSignalPayload(data);
      });

      // Same-browser tab synchronization
      let crossTabChannel: BroadcastChannel | null = null;
      try {
        crossTabChannel = new BroadcastChannel("cityconnect-calls-global-sync");
        crossTabChannel.onmessage = (event) => {
          if (event.data) {
            handleSignalPayload(event.data);
          }
        };
      } catch (e) {}

      return () => {
        if (socket) {
          socket.disconnect();
        }
        if (crossTabChannel) {
          try { crossTabChannel.close(); } catch (e) {}
        }
      };
    } catch (err) {
      console.error("[CallProvider] Failed to connect Socket.IO:", err);
    }
  }, [currentUserId, userToken, fetchMyLiveKitToken]);

  // Real-time active call synchronization interval (2s fallback for cross-device network resilience)
  useEffect(() => {
    if (!currentUserId) return;

    const syncCallStatus = async () => {
      try {
        const res = await fetch("/api/calls/active", { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.call) {
            const call = data.call;
            const matchesMe = (id: string) => id === currentUserId || (currentUserId.includes("prov") && id.includes("prov")) || (currentUserId.includes("cust") && id.includes("cust"));
            const isCaller = matchesMe(call.callerId);
            const isReceiver = matchesMe(call.receiverId);

            if (call.status === "INITIATED" || call.status === "RINGING") {
              if (isReceiver && callStateRef.current === "IDLE") {
                setActiveCall(call);
                setCallState("INCOMING");
                ringtonePlayer.startRingtone("incoming");
              } else if (isCaller && callStateRef.current === "IDLE") {
                setActiveCall(call);
                setCallState("OUTGOING");
              }
            } else if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
              if (isCaller || isReceiver) {
                if (callStateRef.current !== "ACTIVE") {
                  setActiveCall(call);
                  setCallState("ACTIVE");
                  ringtonePlayer.stopRingtone();
                }
                if (data.livekit && (!livekitCredentialsRef.current || livekitCredentialsRef.current.participantToken !== data.livekit.participantToken)) {
                  setLivekitCredentials(data.livekit);
                } else if (!livekitCredentialsRef.current && call.bookingId) {
                  fetchMyLiveKitToken(call.bookingId);
                }
              }
            } else if (["REJECTED", "ENDED", "CANCELLED", "COMPLETED", "BUSY", "MISSED"].includes(call.status)) {
              if (callStateRef.current !== "IDLE") {
                setCallState("IDLE");
                setActiveCall(null);
                setLivekitCredentials(null);
                ringtonePlayer.stopRingtone();
              }
            }
          } else {
            if (callStateRef.current !== "IDLE") {
              setCallState("IDLE");
              setActiveCall(null);
              setLivekitCredentials(null);
              ringtonePlayer.stopRingtone();
            }
          }
        }
      } catch (e) {}
    };

    syncCallStatus();
    const interval = setInterval(syncCallStatus, 2000);
    return () => clearInterval(interval);
  }, [currentUserId, getHeaders, fetchMyLiveKitToken]);

  // Start Call (Caller side) - Optimistic UI update
  const startCall = useCallback(async (bookingId: string) => {
    const isProviderPortal = pathname?.startsWith("/provider") || pathname?.startsWith("/jobprovider");
    const isUserProvider = currentUserId ? (currentUserId.includes("prov") || currentUserId === "provider-1") : isProviderPortal;
    const tempReceiverId = isUserProvider ? "customer-1" : "provider-1";

    const tempCall: CallRecord = {
      id: `temp-${Date.now()}`,
      callerId: currentUserId,
      receiverId: tempReceiverId,
      bookingId,
      status: "RINGING",
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
      serviceName: "Service Booking Call"
    };

    // Immediate optimistic UI transition (<10ms)
    setActiveCall(tempCall);
    setCallState("OUTGOING");
    ringtonePlayer.startRingtone("outgoing");

    // Parallel background pre-fetch of LiveKit token for zero-wait transition
    fetchMyLiveKitToken(bookingId);

    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ bookingId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback optimistic state on failure
        setCallState("IDLE");
        setActiveCall(null);
        ringtonePlayer.stopRingtone();
        alert(data.error || "Failed to start call");
        return;
      }

      // Reconcile optimistic call object with server response
      setActiveCall(data.call);

      try {
        const bc = new BroadcastChannel("cityconnect-calls-global-sync");
        bc.postMessage({ type: "call:ring", call: data.call });
        bc.close();
      } catch (e) {}
    } catch (err: any) {
      setCallState("IDLE");
      setActiveCall(null);
      ringtonePlayer.stopRingtone();
      alert(err.message || "Could not connect call.");
    }
  }, [currentUserId, getHeaders, pathname]);

  // Accept Call (Receiver side) - Optimistic UI update
  const acceptCall = useCallback(async () => {
    const callToAccept = activeCallRef.current || activeCall;
    if (!callToAccept) return;

    const previousCall = callToAccept;
    const previousState = callStateRef.current;

    // Immediate optimistic UI transition (<10ms)
    ringtonePlayer.stopRingtone();
    const optimisticAcceptedCall: CallRecord = {
      ...callToAccept,
      status: "ACCEPTED",
      answeredAt: new Date().toISOString()
    };

    setActiveCall(optimisticAcceptedCall);
    setCallState("ACTIVE");

    try {
      const res = await fetch(`/api/calls/${callToAccept.id}/accept`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Reconcile with actual server response
        setActiveCall(data.call);
        setCallState("ACTIVE");
        if (data.livekit) {
          setLivekitCredentials(data.livekit);
        } else if (data.call.bookingId) {
          fetchMyLiveKitToken(data.call.bookingId);
        }

        try {
          const bc = new BroadcastChannel("cityconnect-calls-global-sync");
          bc.postMessage({ type: "call:accept", call: data.call });
          bc.close();
        } catch (e) {}
      } else {
        // Cleanly dismiss call UI if call is already ended/cancelled/expired
        ringtonePlayer.stopRingtone();
        setCallState("IDLE");
        setActiveCall(null);
        setLivekitCredentials(null);
        if (data.error && !data.error.includes("ENDED") && !data.error.includes("CANCELLED") && !data.error.includes("MISSED")) {
          alert(data.error || "Failed to accept call");
        }
      }
    } catch (err: any) {
      console.error("Error accepting call:", err);
      ringtonePlayer.stopRingtone();
      setCallState("IDLE");
      setActiveCall(null);
      setLivekitCredentials(null);
    }
  }, [activeCall, getHeaders, fetchMyLiveKitToken]);

  // Reject Call
  const rejectCall = useCallback(async () => {
    if (!activeCall) return;
    try {
      ringtonePlayer.stopRingtone();
      await fetch(`/api/calls/${activeCall.id}/reject`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      try {
        const bc = new BroadcastChannel("cityconnect-calls-global-sync");
        bc.postMessage({ type: "call:reject", call: activeCall });
        bc.close();
      } catch (e) {}
    } catch (err) {
      console.error("Error rejecting call:", err);
    } finally {
      setCallState("IDLE");
      setActiveCall(null);
      setLivekitCredentials(null);
    }
  }, [activeCall, getHeaders]);

  // End Call
  const endCall = useCallback(async () => {
    if (!activeCall) return;
    try {
      ringtonePlayer.stopRingtone();
      await fetch(`/api/calls/${activeCall.id}/end`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      try {
        const bc = new BroadcastChannel("cityconnect-calls-global-sync");
        bc.postMessage({ type: "call:end", call: activeCall });
        bc.close();
      } catch (e) {}
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setCallState("IDLE");
      setActiveCall(null);
      setLivekitCredentials(null);
    }
  }, [activeCall, getHeaders]);

  const contextValue = useMemo(() => ({
    activeCall,
    livekitCredentials,
    callState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    isCalling: callState !== "IDLE"
  }), [activeCall, livekitCredentials, callState, startCall, acceptCall, rejectCall, endCall]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}

      {/* Overlays */}
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

      {callState === "ACTIVE" && activeCall && (
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
