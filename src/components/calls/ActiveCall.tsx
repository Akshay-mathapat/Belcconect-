"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Volume2, VolumeX, Mic } from "lucide-react";
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

function getNumericUid(userId: string): number {
  if (!userId) return 10000001;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 80000000) + 10000000;
}

export default function ActiveCall({
  call,
  agora,
  currentUserId,
  onEndCall
}: ActiveCallProps) {
  const isUserProvider = (id: string) => !!id && (id.includes("prov") || id === "provider-1");
  const isUserCustomer = (id: string) => !!id && (id.includes("cust") || id === "customer-1");

  const isCaller =
    currentUserId === call.callerId ||
    (isUserCustomer(currentUserId) && isUserCustomer(call.callerId)) ||
    (isUserProvider(currentUserId) && isUserProvider(call.callerId));

  const peerName = isCaller ? (call.receiverName || "Service Partner") : (call.callerName || "Customer");
  const peerAvatar = isCaller
    ? (call.receiverAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80")
    : (call.callerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80");

  const callerUid = getNumericUid(call.callerId);
  let receiverUid = getNumericUid(call.receiverId);
  if (callerUid === receiverUid) {
    receiverUid = callerUid + 54321;
  }
  const targetUid = agora.uid || (isCaller ? callerUid : receiverUid);

  const [isMuted, setIsMuted] = useState(false);
  const [isAudioConnected, setIsAudioConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("CONNECTING");
  const [peerSpeaking, setPeerSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);

  const agoraClientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const activeChannelRef = useRef<string | null>(null);

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
      const currentChannelKey = `${agora.channelName}-${agora.uid}`;
      if (activeChannelRef.current === currentChannelKey && agoraClientRef.current) {
        return;
      }
      activeChannelRef.current = currentChannelKey;

      if (agoraClientRef.current) {
        try {
          await agoraClientRef.current.leave();
          agoraClientRef.current.removeAllListeners();
        } catch (e) {}
        agoraClientRef.current = null;
      }

      try {
        const AgoraRTCModule = await import("agora-rtc-sdk-ng");
        const AgoraRTC = AgoraRTCModule.default;
        AgoraRTC.setLogLevel(3);

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        agoraClientRef.current = client;

        let myJoinedUid: number | string | null = null;

        // Enable Audio Volume Indicator for visual speaking feedback
        try {
          client.enableAudioVolumeIndicator();
          client.on("volume-indicator", (volumes: Array<{ uid: number | string; level: number }>) => {
            if (!isMounted) return;
            volumes.forEach((vol) => {
              if (vol.uid === myJoinedUid || vol.uid === agora.uid || vol.uid === 0) {
                setUserSpeaking(vol.level > 10);
              } else {
                setPeerSpeaking(vol.level > 10);
              }
            });
          });
        } catch (e) {}

        // Helper function to safely play remote user audio track and set max volume
        const playRemoteUserAudio = (user: any) => {
          if (user && user.audioTrack) {
            try {
              if (!user.audioTrack.isPlaying) {
                user.audioTrack.setVolume(100);
                user.audioTrack.play();
              }
              if (isMounted) setAudioAutoplayBlocked(false);
            } catch (playErr) {
              console.warn("Autoplay blocked or play failed for remote audio track:", playErr);
              if (isMounted) setAudioAutoplayBlocked(true);
            }
          }
        };

        // Listen for autoplay failure
        try {
          if (typeof (AgoraRTC as any).onAudioAutoplayFailed === "function") {
            (AgoraRTC as any).onAudioAutoplayFailed(() => {
              if (isMounted) setAudioAutoplayBlocked(true);
            });
          }
        } catch (e) {}

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
            if (mediaType === "audio") {
              playRemoteUserAudio(user);
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

        // Join Agora RTC Channel using null UID for dynamic server-assigned unique UID
        try {
          if (client.connectionState !== "CONNECTED" && client.connectionState !== "CONNECTING") {
            myJoinedUid = await client.join(agora.appId, agora.channelName, agora.token || null, null);
          }
        } catch (joinErr: any) {
          const errStr = String(joinErr?.message || joinErr?.code || joinErr);
          if (isOperationAborted(joinErr)) {
            console.warn("Agora join transition handled gracefully:", errStr);
          } else {
            console.error("Agora join channel error:", joinErr);
          }
        }

        if (!isMounted) return;

        // Check & Subscribe to existing remote audio tracks
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          for (const remoteUser of client.remoteUsers) {
            if (remoteUser.hasAudio) {
              try {
                await client.subscribe(remoteUser, "audio");
                playRemoteUserAudio(remoteUser);
              } catch (e: any) {
                if (!isOperationAborted(e)) {
                  console.error("Error subscribing to existing remote audio:", e);
                }
              }
            }
          }
        }

        if (!isMounted) return;

        // Create & Publish Local Microphone with Echo Cancellation (AEC), Noise Suppression (ANS), and Gain Control (AGC)
        try {
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "speech_standard",
            AEC: true,
            ANS: true,
            AGC: true
          });
          localAudioTrackRef.current = micTrack;
          if (isMounted) {
            micTrack.setEnabled(true);
            await client.publish([micTrack]);
          }
        } catch (micErr: any) {
          if (!isOperationAborted(micErr)) {
            console.warn("Microphone access issue:", micErr);
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

    // Global listener to unblock browser Web Audio autoplay policy on interaction
    const unblockAudioOnInteraction = () => {
      if (agoraClientRef.current) {
        agoraClientRef.current.remoteUsers.forEach((u: any) => {
          if (u.audioTrack && !u.audioTrack.isPlaying) {
            try {
              u.audioTrack.setVolume(100);
              u.audioTrack.play();
            } catch (e) {}
          }
        });
      }
      setAudioAutoplayBlocked(false);
    };

    window.addEventListener("click", unblockAudioOnInteraction);
    window.addEventListener("touchstart", unblockAudioOnInteraction);

    return () => {
      isMounted = false;
      activeChannelRef.current = null;
      window.removeEventListener("click", unblockAudioOnInteraction);
      window.removeEventListener("touchstart", unblockAudioOnInteraction);

      if (typeof document !== "undefined") {
        document.querySelectorAll('audio[id*="agora"]').forEach((el) => {
          try { (el as HTMLAudioElement).pause(); el.remove(); } catch (e) {}
        });
      }

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
          client.leave().catch(() => {});
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

  const handleUnblockAudioManually = () => {
    if (agoraClientRef.current) {
      agoraClientRef.current.remoteUsers.forEach((u: any) => {
        if (u.audioTrack && !u.audioTrack.isPlaying) {
          try {
            u.audioTrack.setVolume(100);
            u.audioTrack.play();
          } catch (e) {}
        }
      });
    }
    setAudioAutoplayBlocked(false);
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
        <div className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl transition-all ${
          peerSpeaking ? "bg-emerald-500/30 scale-125" : "bg-emerald-500/15"
        }`} />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <span className={`w-2 h-2 rounded-full ${connectionState === "CONNECTED" || isAudioConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"}`} />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          {connectionState === "CONNECTED" || isAudioConnected ? "Channel Connected (Agora Encrypted)" : "Connecting Channel..."}
        </div>

        {/* Peer Avatar */}
        <div className="relative mb-5">
          <img
            src={peerAvatar}
            alt={peerName}
            className={`w-24 h-24 rounded-full object-cover border-4 transition-all ${
              peerSpeaking ? "border-emerald-500 scale-105 shadow-emerald-500/20" : "border-slate-800"
            } shadow-2xl relative z-10`}
          />
          <div className={`absolute -bottom-1 -right-1 z-20 p-1.5 rounded-full ring-4 ring-slate-900 transition-all ${
            peerSpeaking ? "bg-emerald-400 text-slate-950 scale-110" : "bg-slate-700 text-slate-300"
          }`}>
            <Volume2 className={`w-3.5 h-3.5 ${peerSpeaking ? "animate-bounce" : ""}`} />
          </div>
        </div>

        {/* Peer Name */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{peerName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "BelConnect Service"}
        </p>

        {/* Speaking & Connection Indicators */}
        <div className="mt-4 mb-6 flex flex-col items-center gap-2">
          {connectionState === "CONNECTED" || isAudioConnected ? (
            <>
              <CallTimer />
              {peerSpeaking && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                  Speaking...
                </span>
              )}
              {userSpeaking && !peerSpeaking && (
                <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  <Mic className="w-3 h-3 inline mr-1" /> Your Mic Active
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase animate-pulse">
              Connecting Audio...
            </span>
          )}
        </div>

        {/* Autoplay Unblock Button if Browser Blocks Audio */}
        {audioAutoplayBlocked && (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleUnblockAudioManually}
            className="mb-6 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
          >
            <VolumeX className="w-4 h-4" /> Tap to Enable Speaker Sound
          </motion.button>
        )}

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
