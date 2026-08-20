"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { CallRecord } from "@/lib/calls";
import IncomingCall from "./IncomingCall";
import OutgoingCall from "./OutgoingCall";
import ActiveCall from "./ActiveCall";

interface AgoraCredentials {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
}

interface CallContextType {
  activeCall: CallRecord | null;
  agoraCredentials: AgoraCredentials | null;
  callState: "IDLE" | "OUTGOING" | "INCOMING" | "ACTIVE";
  startCall: (bookingId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  isCalling: boolean;
}

const CallContext = createContext<CallContextType>({
  activeCall: null,
  agoraCredentials: null,
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
    if (isProviderPortal) {
      return (currentUser && (currentUser.role === "provider" || currentUser.role === "job_provider"))
        ? currentUser.id
        : "provider-1";
    }
    return (currentUser && currentUser.role === "user")
      ? currentUser.id
      : "customer-1";
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
  const [agoraCredentials, setAgoraCredentials] = useState<AgoraCredentials | null>(null);
  const [callState, setCallState] = useState<"IDLE" | "OUTGOING" | "INCOMING" | "ACTIVE">("IDLE");

  const callStateRef = useRef(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Fetch unique Agora token for current user
  const fetchMyAgoraToken = useCallback((callId: string) => {
    if (!currentUserId) return;
    fetch(`/api/calls/${callId}?userId=${encodeURIComponent(currentUserId)}`, { headers: getHeaders() })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.agora) {
          setAgoraCredentials((prev) => {
            if (
              prev &&
              prev.appId === resData.agora.appId &&
              prev.channelName === resData.agora.channelName &&
              prev.token === resData.agora.token &&
              prev.uid === resData.agora.uid
            ) {
              return prev;
            }
            return resData.agora;
          });
        }
      })
      .catch((err) => console.error("Failed to fetch user Agora credentials:", err));
  }, [currentUserId, getHeaders]);

  // Stable SSE Stream listener & BroadcastChannel for live signaling across tabs & backend
  useEffect(() => {
    if (!currentUserId) return;

    const handleSignalPayload = (data: any) => {
      const { type, call, agora } = data;
      if (!call) return;

      const isUserProvider = (id: string) => !!id && (id.includes("prov") || id === "provider-1");
      const isUserCustomer = (id: string) => !!id && (id.includes("cust") || id === "customer-1");

      if (type === "call:ring" || type === "call:initiate") {
        const isTargetReceiver =
          call.receiverId === currentUserId ||
          (isUserProvider(currentUserId) && isUserProvider(call.receiverId)) ||
          (isUserCustomer(currentUserId) && isUserCustomer(call.receiverId));

        if (isTargetReceiver && callStateRef.current === "IDLE") {
          setActiveCall(call);
          setCallState("INCOMING");
        }
      } else if (type === "call:accept") {
        const isParticipant =
          call.callerId === currentUserId ||
          call.receiverId === currentUserId ||
          (isUserCustomer(currentUserId) && (isUserCustomer(call.callerId) || isUserCustomer(call.receiverId))) ||
          (isUserProvider(currentUserId) && (isUserProvider(call.callerId) || isUserProvider(call.receiverId)));

        if (isParticipant || callStateRef.current === "OUTGOING" || callStateRef.current === "INCOMING") {
          setActiveCall(call);
          setCallState("ACTIVE");
          fetchMyAgoraToken(call.id);
        }
      } else if (["call:reject", "call:end", "call:missed", "call:cancel"].includes(type)) {
        setCallState("IDLE");
        setActiveCall(null);
        setAgoraCredentials(null);
      }
    };

    const sseUrl = userToken
      ? `/api/calls/stream?token=${encodeURIComponent(userToken)}`
      : `/api/calls/stream?userId=${encodeURIComponent(currentUserId)}`;

    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handleSignalPayload(data);
      } catch (err) {
        console.error("Error processing call signal:", err);
      }
    };

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
      eventSource.close();
      if (crossTabChannel) {
        try { crossTabChannel.close(); } catch (e) {}
      }
    };
  }, [currentUserId, userToken, getHeaders, fetchMyAgoraToken]);

  // Continuous Active Call Sync Effect (Handles cross-device/tab synchronization even if SSE is blocked or across separate devices)
  useEffect(() => {
    if (!currentUserId) return;

    const checkActiveCall = async () => {
      try {
        const res = await fetch(`/api/calls/active?userId=${encodeURIComponent(currentUserId)}`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.call) {
            const call = data.call;
            const isUserProvider = (id: string) => !!id && (id.includes("prov") || id === "provider-1");
            const isUserCustomer = (id: string) => !!id && (id.includes("cust") || id === "customer-1");

            const isCaller = call.callerId === currentUserId || (isUserProvider(currentUserId) && isUserProvider(call.callerId)) || (isUserCustomer(currentUserId) && isUserCustomer(call.callerId));
            const isReceiver = call.receiverId === currentUserId || (isUserProvider(currentUserId) && isUserProvider(call.receiverId)) || (isUserCustomer(currentUserId) && isUserCustomer(call.receiverId));

            if (call.status === "INITIATED" || call.status === "RINGING") {
              if (isReceiver && callStateRef.current === "IDLE") {
                setActiveCall(call);
                setCallState("INCOMING");
              } else if (isCaller && callStateRef.current === "IDLE") {
                setActiveCall(call);
                setCallState("OUTGOING");
              }
            } else if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
              if ((isCaller || isReceiver) && callStateRef.current !== "ACTIVE") {
                setActiveCall(call);
                setCallState("ACTIVE");
                fetchMyAgoraToken(call.id);
              }
            }
          } else {
            if (callStateRef.current !== "IDLE") {
              setCallState("IDLE");
              setActiveCall(null);
              setAgoraCredentials(null);
            }
          }
        }
      } catch (e) {}
    };

    checkActiveCall();
    const interval = setInterval(checkActiveCall, 1500);
    return () => clearInterval(interval);
  }, [currentUserId, getHeaders, fetchMyAgoraToken]);

  // Start Call (Caller side)
  const startCall = useCallback(async (bookingId: string) => {
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ bookingId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to start call");
        return;
      }

      setActiveCall(data.call);
      setCallState("OUTGOING");

      try {
        const bc = new BroadcastChannel("cityconnect-calls-global-sync");
        bc.postMessage({ type: "call:ring", call: data.call });
        bc.close();
      } catch (e) {}
    } catch (err: any) {
      alert(err.message || "Could not connect call.");
    }
  }, [getHeaders]);

  // Accept Call (Receiver side)
  const acceptCall = useCallback(async () => {
    if (!activeCall) return;
    try {
      const res = await fetch(`/api/calls/${activeCall.id}/accept`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveCall(data.call);
        setCallState("ACTIVE");
        fetchMyAgoraToken(data.call.id);

        try {
          const bc = new BroadcastChannel("cityconnect-calls-global-sync");
          bc.postMessage({ type: "call:accept", call: data.call });
          bc.close();
        } catch (e) {}
      }
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  }, [activeCall, getHeaders, fetchMyAgoraToken]);

  // Reject Call
  const rejectCall = useCallback(async () => {
    if (!activeCall) return;
    try {
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
      setAgoraCredentials(null);
    }
  }, [activeCall, getHeaders]);

  // End Call
  const endCall = useCallback(async () => {
    if (!activeCall) return;
    try {
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
      setAgoraCredentials(null);
    }
  }, [activeCall, getHeaders]);

  const contextValue = useMemo(() => ({
    activeCall,
    agoraCredentials,
    callState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    isCalling: callState !== "IDLE"
  }), [activeCall, agoraCredentials, callState, startCall, acceptCall, rejectCall, endCall]);

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

      {callState === "ACTIVE" && activeCall && agoraCredentials && (
        <ActiveCall
          call={activeCall}
          agora={agoraCredentials}
          currentUserId={currentUserId}
          onEndCall={endCall}
        />
      )}
    </CallContext.Provider>
  );
}
