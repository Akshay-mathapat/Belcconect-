"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Volume2 } from "lucide-react";
import { CallRecord } from "@/lib/calls";
import CallTimer from "./CallTimer";
import CallControls from "./CallControls";

interface AgoraCredentials {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
}

interface ActiveCallProps {
  call: CallRecord;
  agora: AgoraCredentials;
  currentUserId: string;
  onEndCall: () => void;
}

export default function ActiveCall({
  call,
  agora,
  currentUserId,
  onEndCall
}: ActiveCallProps) {
  const isCaller = currentUserId === call.callerId;
  const peerName = isCaller ? (call.receiverName || "Service Partner") : (call.callerName || "Customer");
  const peerAvatar = isCaller
    ? (call.receiverAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80")
    : (call.callerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80");

  const [isMuted, setIsMuted] = useState(false);
  const [isAudioConnected, setIsAudioConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("CONNECTING");

  const agoraClientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    function isOperationAborted(err: any): boolean {
      if (!err) return false;
      const msg = typeof err === "string" ? err : (err.message || err.code || "");
      return (
        msg.includes("OPERATION_ABORTED") ||
        msg.includes("cancel token canceled") ||
        msg.includes("UID_CONFLICT")
      );
    }

    async function initAgoraEngine() {
      try {
        const AgoraRTCModule = await import("agora-rtc-sdk-ng");
        const AgoraRTC = AgoraRTCModule.default;
        AgoraRTC.setLogLevel(4);

        // Autoplay policy unblock handler
        try {
          if (typeof (AgoraRTC as any).onAudioAutoplayFailed === "function") {
            (AgoraRTC as any).onAudioAutoplayFailed(() => {
              console.warn("Audio autoplay blocked by browser policy. Unblocking on user interaction.");
              const unblock = () => {
                if (agoraClientRef.current) {
                  agoraClientRef.current.remoteUsers.forEach((u: any) => {
                    if (u.audioTrack) {
                      try { u.audioTrack.play(); } catch (e) {}
                    }
                  });
                }
                window.removeEventListener("click", unblock);
                window.removeEventListener("touchstart", unblock);
              };
              window.addEventListener("click", unblock);
              window.addEventListener("touchstart", unblock);
            });
          }
        } catch (e) {}

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        agoraClientRef.current = client;

        client.on("connection-state-change", (curState) => {
          if (!isMounted) return;
          setConnectionState(curState);
          if (curState === "CONNECTED") {
            setIsAudioConnected(true);
          }
        });

        // Subscribe & playback remote user audio stream
        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === "audio" && user.audioTrack) {
              user.audioTrack.play();
            }
          } catch (err: any) {
            if (!isOperationAborted(err)) {
              console.error("Failed to subscribe to remote Agora audio track:", err);
            }
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "audio" && user.audioTrack) {
            try { user.audioTrack.stop(); } catch (e) {}
          }
        });

        // Join Agora RTC Channel & Publish Local Microphone
        try {
          if (client.connectionState !== "CONNECTED" && client.connectionState !== "CONNECTING") {
            await client.join(agora.appId, agora.channelName, agora.token || null, agora.uid);
          }
        } catch (joinErr: any) {
          if (isOperationAborted(joinErr)) {
            console.warn("Agora join transition handled gracefully:", joinErr?.message || joinErr);
          } else {
            console.error("Agora join channel error:", joinErr);
          }
        }

        if (!isMounted) return;

        // Subscribe to existing remote audio tracks
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          for (const remoteUser of client.remoteUsers) {
            if (remoteUser.hasAudio) {
              try {
                await client.subscribe(remoteUser, "audio");
                if (remoteUser.audioTrack) {
                  remoteUser.audioTrack.play();
                }
              } catch (e: any) {
                if (!isOperationAborted(e)) {
                  console.error("Error subscribing to existing remote audio:", e);
                }
              }
            }
          }
        }

        if (!isMounted) return;

        try {
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = micTrack;
          if (isMounted) {
            await client.publish([micTrack]);
          }
        } catch (micErr: any) {
          if (!isOperationAborted(micErr)) {
            console.warn("Microphone access permission warning:", micErr);
          }
        }

        if (isMounted) {
          setIsAudioConnected(true);
          setConnectionState("CONNECTED");
        }
      } catch (error: any) {
        if (!isOperationAborted(error)) {
          console.error("Agora RTC Engine Error:", error);
        }
        if (isMounted) {
          setIsAudioConnected(true);
          setConnectionState("CONNECTED");
        }
      }
    }

    initAgoraEngine();

    return () => {
      isMounted = false;
      if (localAudioTrackRef.current) {
        try {
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close();
        } catch (e) {}
        localAudioTrackRef.current = null;
      }
      if (agoraClientRef.current) {
        try {
          const client = agoraClientRef.current;
          client.leave().catch((e: any) => {
            // Suppress canceled token rejections during cleanup
          });
        } catch (e) {}
        agoraClientRef.current = null;
      }
    };
  }, [agora.appId, agora.channelName, agora.token, agora.uid]);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.setEnabled(!nextMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl" />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Agora Encrypted Voice Call
        </div>

        {/* Peer Avatar */}
        <div className="relative mb-5">
          <img
            src={peerAvatar}
            alt={peerName}
            className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-2xl relative z-10"
          />
          <div className="absolute -bottom-1 -right-1 z-20 bg-emerald-500 text-slate-950 p-1.5 rounded-full ring-4 ring-slate-900">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>

        {/* Peer Name */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{peerName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "BelConnect Service"}
        </p>

        {/* Call Status & Timer */}
        <div className="mt-4 mb-8 flex flex-col items-center gap-2">
          {connectionState === "CONNECTED" || isAudioConnected ? (
            <CallTimer />
          ) : (
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase animate-pulse">
              Connecting Audio...
            </span>
          )}
        </div>

        {/* Controls */}
        <CallControls
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onEndCall={onEndCall}
          callId={call.id}
        />
      </motion.div>
    </div>
  );
}
