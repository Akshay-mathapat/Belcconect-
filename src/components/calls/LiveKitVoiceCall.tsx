"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useAudioPlayback,
} from "@livekit/components-react";
import { ConnectionState, ConnectionQuality, AudioPresets } from "livekit-client";
import { motion } from "framer-motion";
import { ShieldCheck, Volume2, VolumeX, Mic, RefreshCw, AlertCircle, PhoneOff, Loader2 } from "lucide-react";
import { CallRecord } from "@/lib/calls";
import CallTimer from "./CallTimer";
import CallControls from "./CallControls";
import "@livekit/components-styles";

export interface LiveKitCredentials {
  serverUrl: string;
  participantToken: string;
  roomName: string;
}

interface LiveKitVoiceCallProps {
  call: CallRecord;
  livekit: LiveKitCredentials | null;
  currentUserId: string;
  onEndCall: () => void;
}

/**
 * Pure loading/connecting overlay rendered BEFORE LiveKit token arrives.
 * Does NOT call LiveKit React hooks so it can safely render outside LiveKitRoom context.
 */
function ConnectingCallOverlay({
  call,
  currentUserId,
  onEndCall,
}: {
  call: CallRecord;
  currentUserId: string;
  onEndCall: () => void;
}) {
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

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl bg-blue-500/15" />

        {/* Security & Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Initializing LiveKit...
        </div>

        {/* Peer Avatar */}
        <div className="relative mb-5">
          <img
            src={peerAvatar}
            alt={peerName}
            className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-2xl relative z-10"
          />
          <div className="absolute -bottom-1 -right-1 z-20 p-1.5 rounded-full ring-4 ring-slate-900 bg-slate-700 text-slate-300">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Peer Name & Service Title */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{peerName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "BelConnect Voice Call"}
        </p>

        {/* Network Quality Indicator */}
        <div className="mt-2">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border text-amber-400 border-amber-500/20 bg-amber-500/10">
            Connecting Network...
          </span>
        </div>

        {/* Status */}
        <div className="mt-4 mb-6 flex flex-col items-center gap-2">
          <span className="text-xs font-bold text-amber-400 tracking-wider uppercase animate-pulse flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Initializing LiveKit Session...
          </span>
        </div>

        {/* Controls */}
        <CallControls
          isMuted={false}
          onToggleMute={() => {}}
          onEndCall={onEndCall}
          callId={call.id}
        />
      </motion.div>
    </div>
  );
}

/**
 * Main active call content rendered INSIDE LiveKitRoom context.
 * Uses LiveKit React hooks safely.
 */
function LiveKitVoiceContent({
  call,
  currentUserId,
  onEndCall,
}: {
  call: CallRecord;
  currentUserId: string;
  onEndCall: () => void;
}) {
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { canPlayAudio, startAudio } = useAudioPlayback();

  const [micPermissionError, setMicPermissionError] = useState(false);

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

  const peer = remoteParticipants[0];
  const isPeerSpeaking = peer ? peer.isSpeaking : false;
  const isUserSpeaking = localParticipant ? localParticipant.isSpeaking : false;

  // Auto-start audio playback & ensure microphone is active when connected
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && localParticipant) {
      localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.warn("[LiveKit] Mic auto-enable error:", err);
        setMicPermissionError(true);
      });

      startAudio().catch((err) => {
        console.warn("[LiveKit] Audio playback start error:", err);
      });

      // Resume any suspended browser AudioContext
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume();
          }
        }
      } catch (e) {}
    }
  }, [connectionState, localParticipant, startAudio]);

  const handleRetryMic = useCallback(async () => {
    setMicPermissionError(false);
    try {
      await localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.error("[LiveKit] Microphone retry error:", err);
      setMicPermissionError(true);
    }
  }, [localParticipant]);

  const handleToggleMute = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.warn("[LiveKit] Toggle mute error:", err);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  // Determine connection status text and color badge
  let statusBadgeText = "Connecting Voice Room...";
  let statusBadgeColor = "bg-amber-400 animate-ping";

  if (connectionState === ConnectionState.Connected) {
    statusBadgeText = "🟢 LiveKit Connected";
    statusBadgeColor = "bg-emerald-400 animate-pulse";
  } else if (connectionState === ConnectionState.Reconnecting) {
    statusBadgeText = "🟡 Reconnecting...";
    statusBadgeColor = "bg-amber-400 animate-pulse";
  } else if (connectionState === ConnectionState.Disconnected) {
    statusBadgeText = "🔴 Connection Failed";
    statusBadgeColor = "bg-rose-500";
  }

  // Connection Quality Rating mapping
  const quality = peer ? peer.connectionQuality : localParticipant?.connectionQuality;
  let qualityText = "Connecting Network...";
  let qualityColor = "text-amber-400 border-amber-500/20 bg-amber-500/10";

  if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good) {
    qualityText = "🟢 Excellent Connection";
    qualityColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  } else if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
    qualityText = "🔴 Poor Connection";
    qualityColor = "text-rose-400 border-rose-500/20 bg-rose-500/10";
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Background ambient glow */}
        <div
          className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl transition-all ${
            isPeerSpeaking ? "bg-emerald-500/30 scale-125" : "bg-blue-500/15"
          }`}
        />

        {/* Security & Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <span className={`w-2 h-2 rounded-full ${statusBadgeColor}`} />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          {statusBadgeText}
        </div>

        {/* Peer Avatar */}
        <div className="relative mb-5">
          <img
            src={peerAvatar}
            alt={peerName}
            className={`w-24 h-24 rounded-full object-cover border-4 transition-all ${
              isPeerSpeaking
                ? "border-emerald-500 scale-105 shadow-emerald-500/20"
                : "border-slate-800"
            } shadow-2xl relative z-10`}
          />
          <div
            className={`absolute -bottom-1 -right-1 z-20 p-1.5 rounded-full ring-4 ring-slate-900 transition-all ${
              isPeerSpeaking
                ? "bg-emerald-400 text-slate-950 scale-110"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPeerSpeaking ? "animate-bounce" : ""}`} />
          </div>
        </div>

        {/* Peer Name & Service Title */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{peerName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "BelConnect Voice Call"}
        </p>

        {/* Network Quality Indicator */}
        <div className="mt-2">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${qualityColor}`}>
            {qualityText}
          </span>
        </div>

        {/* Speaking & Timer Status */}
        <div className="mt-4 mb-6 flex flex-col items-center gap-2">
          {connectionState === ConnectionState.Connected ? (
            <>
              <CallTimer />
              {isPeerSpeaking && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                  Speaking...
                </span>
              )}
              {isUserSpeaking && !isPeerSpeaking && (
                <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  <Mic className="w-3 h-3 inline mr-1" /> Microphone Active
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase animate-pulse flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {connectionState === ConnectionState.Reconnecting ? "Network Loss: Reconnecting..." : "Connecting Voice Room..."}
            </span>
          )}
        </div>

        {/* Browser Autoplay Sound Unlock Banner */}
        {!canPlayAudio && connectionState === ConnectionState.Connected && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium text-center space-y-2">
            <p>Browser muted audio output. Click below to hear incoming voice.</p>
            <button
              onClick={() => startAudio()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow"
            >
              <Volume2 className="w-3.5 h-3.5" /> Unmute & Enable Speaker 🔊
            </button>
          </div>
        )}

        {/* Microphone Permission Warning */}
        {micPermissionError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center space-y-2">
            <p>Microphone permission is required to make a call. Please allow microphone access in your browser settings.</p>
            <button
              onClick={handleRetryMic}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow"
            >
              <RefreshCw className="w-3 h-3" /> Retry Microphone Access
            </button>
          </div>
        )}

        {/* Controls */}
        <CallControls
          isMuted={!isMicrophoneEnabled}
          onToggleMute={handleToggleMute}
          onEndCall={onEndCall}
          callId={call.id}
        />
      </motion.div>
    </div>
  );
}

export default function LiveKitVoiceCall({
  call,
  livekit,
  currentUserId,
  onEndCall
}: LiveKitVoiceCallProps) {
  const [connectError, setConnectError] = useState<string | null>(null);

  // If LiveKit credentials are still loading, render ConnectingCallOverlay (NO LiveKit React hooks called)
  if (!livekit || !livekit.serverUrl || !livekit.participantToken) {
    return (
      <ConnectingCallOverlay
        call={call}
        currentUserId={currentUserId}
        onEndCall={onEndCall}
      />
    );
  }

  if (connectError) {
    const isInvalidToken = connectError.toLowerCase().includes("invalid token");
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white text-center shadow-xl max-w-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">LiveKit Connection Error</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isInvalidToken
              ? "LiveKit Cloud rejected the token because LIVEKIT_API_SECRET in your .env file contains placeholder bullet characters."
              : connectError}
          </p>
          {isInvalidToken && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-amber-300 text-left font-mono break-all">
              LIVEKIT_API_SECRET="your_actual_livekit_cloud_secret"
            </div>
          )}
          <button
            onClick={onEndCall}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" /> Close Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={livekit.serverUrl}
      token={livekit.participantToken}
      audio={true}
      video={false}
      connect={true}
      options={{
        dynacast: true,
        adaptiveStream: true,
        publishDefaults: {
          audioPreset: AudioPresets.speech,
          dtx: false,
          red: true,
        },
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
        }
      }}
      onDisconnected={onEndCall}
      onError={(err) => {
        console.error("[LiveKit Room Error]", err);
        if (err.message) {
          setConnectError(err.message);
        }
      }}
    >
      <RoomAudioRenderer volume={1.0} />
      <LiveKitVoiceContent
        call={call}
        currentUserId={currentUserId}
        onEndCall={onEndCall}
      />
    </LiveKitRoom>
  );
}
