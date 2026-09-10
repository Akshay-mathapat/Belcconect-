"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useAudioPlayback,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, ConnectionQuality, RoomEvent, RemoteTrack, RemoteTrackPublication, Track } from "livekit-client";
import { motion } from "framer-motion";
import { ShieldCheck, Volume2, Mic, RefreshCw, AlertCircle, PhoneOff, Loader2 } from "lucide-react";
import { CallRecord } from "@/lib/calls";
import CallTimer from "./CallTimer";
import CallControls from "./CallControls";
import { callAudioManager } from "@/lib/callAudioManager";
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
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const isCaller = currentUserId === call.callerId || (isDemo && currentUserId.includes("cust"));

  const peerName = isCaller ? (call.receiverName || "Service Partner") : (call.callerName || "Customer");
  const peerInitial = peerName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl bg-blue-500/15" />

        {/* Security & Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Encrypted Voice Line
        </div>

        {/* Peer Avatar Initial */}
        <div className="relative mb-5">
          <div className="w-24 h-24 rounded-full border-4 border-slate-800 shadow-2xl relative z-10 flex items-center justify-center bg-slate-800 text-slate-200 text-4xl font-extrabold uppercase">
            {peerInitial}
          </div>
          <div className="absolute -bottom-1 -right-1 z-20 p-1.5 rounded-full ring-4 ring-slate-900 bg-slate-700 text-slate-300">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Peer Name & Service Title */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{peerName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "BelConnect Voice Call"}
        </p>

        {/* Status */}
        <div className="mt-4 mb-6 flex flex-col items-center gap-2">
          <span className="text-xs font-bold text-amber-400 tracking-wider uppercase animate-pulse flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Connecting audio...
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
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { canPlayAudio, startAudio } = useAudioPlayback();

  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [remoteAudioSubscribed, setRemoteAudioSubscribed] = useState(false);
  const [waitingTimeout, setWaitingTimeout] = useState(false);
  const connectTimestampRef = useRef<number>(Date.now());

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const isCaller = currentUserId === call.callerId || (isDemo && currentUserId.includes("cust"));

  const peerName = isCaller ? (call.receiverName || "Service Partner") : (call.callerName || "Customer");
  const peerInitial = peerName.charAt(0).toUpperCase();

  const peer = remoteParticipants[0];
  const isPeerSpeaking = peer ? peer.isSpeaking : false;
  const isUserSpeaking = localParticipant ? localParticipant.isSpeaking : false;

  // Real local mic publication check
  const micPublication = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const localMicPublished = Boolean(
    micPublication &&
    micPublication.track &&
    !micPublication.isMuted
  );

  // Strict Audio Ready Condition:
  // roomConnected && localMicPublished && remoteParticipantPresent && remoteAudioSubscribed && canPlayAudio === true
  const roomConnected = connectionState === ConnectionState.Connected;
  const remoteParticipantPresent = remoteParticipants.length > 0;
  const isAudioReady = roomConnected && localMicPublished && remoteParticipantPresent && remoteAudioSubscribed && canPlayAudio === true;

  // Dev Logging for LiveKit session details and state transitions
  useEffect(() => {
    if (room) {
      console.log("[LIVEKIT_SESSION]", {
        callId: call.id,
        bookingId: call.bookingId,
        roomName: room.name,
        currentUserId,
        tokenPresent: true
      });
      console.log(`[CALL_TRACE] callId=${call.id} bookingId=${call.bookingId}`);
      console.log(`[LIVEKIT_SESSION] roomName=${room.name}`);
    }
  }, [room, call.id, call.bookingId, currentUserId]);

  useEffect(() => {
    if (connectionState === ConnectionState.Connecting) {
      console.log("[LIVEKIT_STATE] connecting");
    } else if (connectionState === ConnectionState.Connected) {
      console.log("[LIVEKIT_STATE] connected");
    } else if (connectionState === ConnectionState.Reconnecting) {
      console.log("[LIVEKIT_STATE] reconnecting");
    } else if (connectionState === ConnectionState.Disconnected) {
      console.log("[LIVEKIT_STATE] disconnected");
    }
  }, [connectionState]);

  // Track room events for remote audio subscription & diagnostics
  useEffect(() => {
    if (!room) return;

    // Initial check: mark remote audio as subscribed if any remote participant already has a subscribed audio track
    let initialSubscribed = false;
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications?.forEach((pub) => {
        if (pub.isSubscribed || pub.track) {
          initialSubscribed = true;
        }
      });
    });
    setRemoteAudioSubscribed(initialSubscribed);

    const handleTrackSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication
    ) => {
      if (track.kind === "audio") {
        console.log(`[LIVEKIT] remote-audio-subscribed trackSid=${track.sid}`);
        setRemoteAudioSubscribed(true);
        console.log(`[CALL_PERF] accept_to_remote_audio_ms=${Date.now() - connectTimestampRef.current}`);
      }
    };

    const handleTrackUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === "audio") {
        console.log(`[LIVEKIT] remote-audio-unsubscribed trackSid=${track.sid}`);
        setRemoteAudioSubscribed(false);
      }
    };

    const handleTrackUnpublished = (publication: RemoteTrackPublication) => {
      if (publication.kind === "audio") {
        console.log("[LIVEKIT] remote-audio-unpublished");
        setRemoteAudioSubscribed(false);
      }
    };

    const handleParticipantDisconnected = (participant: any) => {
      console.log(`[LIVEKIT] participant-disconnected identity=${participant.identity}`);
      setRemoteAudioSubscribed(false);
    };

    const handleParticipantConnected = (participant: any) => {
      console.log(`[LIVEKIT] participant-connected identity=${participant.identity}`);
      console.log(`[LIVEKIT] remote-participant-count=${room.remoteParticipants.size}`);
      participant.audioTrackPublications?.forEach((pub: any) => {
        if (pub.isSubscribed || pub.track) {
          setRemoteAudioSubscribed(true);
        }
      });
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room]);

  // Log remote participant count and mic publication state
  useEffect(() => {
    if (roomConnected) {
      console.log(`[LIVEKIT] remote-participant-count=${remoteParticipants.length}`);
      console.log(`[LIVEKIT] local-mic-published=${localMicPublished}`);
      console.log(`[LIVEKIT] remote-audio-subscribed=${remoteAudioSubscribed}`);
      console.log(`[LIVEKIT] canPlayAudio=${canPlayAudio}`);
    }
  }, [roomConnected, remoteParticipants.length, localMicPublished, remoteAudioSubscribed, canPlayAudio]);

  // "Waiting for other person" timeout after 8 seconds
  useEffect(() => {
    if (roomConnected && !remoteParticipantPresent) {
      const timer = setTimeout(() => {
        setWaitingTimeout(true);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setWaitingTimeout(false);
    }
  }, [roomConnected, remoteParticipantPresent]);

  // Ensure microphone is enabled and published automatically upon room connection
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && localParticipant) {
      let isMounted = true;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let retryCount = 0;

      const publishMicWithRetry = async () => {
        if (!isMounted) return;
        try {
          if (!localParticipant.isMicrophoneEnabled) {
            await localParticipant.setMicrophoneEnabled(true);
          }
          if (isMounted) {
            setMicPermissionError(null);
            console.log(`[LIVEKIT] local-mic-published=true participant=${localParticipant.identity}`);
          }
        } catch (err: any) {
          const errMsg = err?.message || "";
          console.warn(`[LIVEKIT_WARN] Mic publish attempt ${retryCount + 1} notice:`, errMsg);

          if (
            errMsg.includes("engine not connected") ||
            errMsg.includes("timeout") ||
            err?.name === "PublishTrackError"
          ) {
            if (retryCount < 8 && isMounted) {
              retryCount += 1;
              retryTimer = setTimeout(publishMicWithRetry, 800);
              return;
            }
          }

          if (isMounted) {
            if (err?.name === "NotAllowedError" || errMsg.includes("Permission")) {
              setMicPermissionError("Microphone permission denied. Please allow microphone access.");
            } else if (err?.name === "NotFoundError") {
              setMicPermissionError("No microphone hardware found on this device.");
            } else if (err?.name === "NotReadableError") {
              setMicPermissionError("Microphone is currently in use by another application.");
            } else {
              setMicPermissionError("Microphone connecting... Tap retry if audio does not start.");
            }
          }
        }
      };

      publishMicWithRetry();

      startAudio()
        .then(() => {
          console.log(`[CALL_PERF] accept_to_audio_playable_ms=${Date.now() - connectTimestampRef.current}`);
        })
        .catch((err) => {
          console.warn("[LIVEKIT] Audio playback unlock warning:", err);
        });

      return () => {
        isMounted = false;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }
  }, [connectionState, localParticipant, startAudio]);

  const handleRetryMic = useCallback(async () => {
    if (!localParticipant) return;
    setMicPermissionError(null);
    try {
      await localParticipant.setMicrophoneEnabled(true);
      console.log(`[LIVEKIT] local-mic-published=true participant=${localParticipant.identity}`);
    } catch (err: any) {
      console.error("[LIVEKIT_ERROR] Microphone retry error:", err);
      setMicPermissionError(err?.message || "Microphone permission error.");
    }
  }, [localParticipant]);

  const handleToggleMute = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.warn("[LIVEKIT] Toggle mute error:", err);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  // Determine connection status text and color badge using product wording
  let statusBadgeText = "Connecting audio...";
  let statusBadgeColor = "bg-amber-400 animate-ping";

  if (roomConnected) {
    if (!remoteParticipantPresent) {
      statusBadgeText = waitingTimeout ? "Other participant hasn't joined yet." : "Waiting for other person...";
      statusBadgeColor = "bg-amber-400 animate-pulse";
    } else if (canPlayAudio === false) {
      statusBadgeText = "Tap to enable call audio 🔊";
      statusBadgeColor = "bg-amber-500 animate-pulse";
    } else {
      statusBadgeText = "Connected";
      statusBadgeColor = "bg-emerald-400 animate-pulse";
    }
  } else if (connectionState === ConnectionState.Reconnecting) {
    statusBadgeText = "Reconnecting...";
    statusBadgeColor = "bg-amber-400 animate-pulse";
  } else {
    statusBadgeText = "Connecting audio...";
    statusBadgeColor = "bg-amber-400 animate-ping";
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
        exit={{ opacity: 0, scale: 0.9, y: 0 }}
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

        {/* Peer Avatar Initial */}
        <div className="relative mb-5">
          <div
            className={`w-24 h-24 rounded-full border-4 transition-all flex items-center justify-center text-4xl font-extrabold uppercase relative z-10 ${
              isPeerSpeaking
                ? "border-emerald-500 scale-105 shadow-emerald-500/20 bg-emerald-900/50 text-emerald-100"
                : "border-slate-800 bg-slate-800 text-slate-200"
            } shadow-2xl`}
          >
            {peerInitial}
          </div>
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
          {isAudioReady ? (
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
              {connectionState === ConnectionState.Reconnecting
                ? "Reconnecting..."
                : !remoteParticipantPresent
                ? (waitingTimeout ? "Other participant hasn't joined yet." : "Waiting for other person...")
                : "Connecting audio..."}
            </span>
          )}
        </div>

        {/* Browser Autoplay Sound Unlock Banner */}
        {!canPlayAudio && roomConnected && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium text-center space-y-2">
            <p>Audio playback requires user permission.</p>
            <button
              onClick={() => startAudio()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow"
            >
              <Volume2 className="w-3.5 h-3.5" /> Tap to enable call audio 🔊
            </button>
          </div>
        )}

        {/* Microphone Permission Warning */}
        {micPermissionError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center space-y-2">
            <p>{micPermissionError}</p>
            <button
              onClick={handleRetryMic}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Microphone Access
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
  const [mediaRetryGeneration, setMediaRetryGeneration] = useState<number>(0);
  const intentionalDisconnectRef = useRef<boolean>(false);

  // Connected call protection: guarantee ringtone and ringback are stopped instantly
  useEffect(() => {
    callAudioManager.stopAll();
  }, []);

  const handleRoomDisconnected = useCallback(() => {
    console.log("[LIVEKIT_STATE] disconnected. Intentional?", intentionalDisconnectRef.current);
    if (intentionalDisconnectRef.current) {
      onEndCall();
    } else {
      console.warn("[LIVEKIT] Transient disconnect detected. Preserving call state for reconnection.");
    }
  }, [onEndCall]);

  const handleUserHangup = useCallback(() => {
    intentionalDisconnectRef.current = true;
    onEndCall();
  }, [onEndCall]);

  const handleRetryAudio = useCallback(() => {
    setConnectError(null);
    setMediaRetryGeneration((prev) => prev + 1);
  }, []);

  // STRICT ROOM NAME REQUIREMENT — No fallback room name
  if (!livekit || !livekit.roomName) {
    return (
      <ConnectingCallOverlay
        call={call}
        currentUserId={currentUserId}
        onEndCall={onEndCall}
      />
    );
  }

  const roomName = livekit.roomName;
  const mediaSessionKey = `${call.id}:${roomName}:${currentUserId}:${mediaRetryGeneration}`;

  if (!livekit.serverUrl || !livekit.participantToken) {
    return (
      <ConnectingCallOverlay
        call={call}
        currentUserId={currentUserId}
        onEndCall={handleUserHangup}
      />
    );
  }

  if (connectError) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white text-center shadow-xl max-w-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Connection Error</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {connectError}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleRetryAudio}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Audio
            </button>
            <button
              onClick={handleUserHangup}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" /> Close Call
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      key={mediaSessionKey}
      serverUrl={livekit.serverUrl}
      token={livekit.participantToken}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={handleRoomDisconnected}
      onError={(err) => {
        const serverHost = (() => { try { return new URL(livekit.serverUrl).hostname; } catch { return "unknown"; } })();
        console.error("[LIVEKIT_ERROR]", {
          name: err?.name,
          message: err?.message,
          serverHost,
          roomName: livekit.roomName,
          callId: call.id
        });
        const msg = err?.message || "";
        if (!msg.includes("Client initiated disconnect")) {
          setConnectError(msg || "LiveKit connection error");
        }
      }}
    >
      <RoomAudioRenderer volume={1.0} />
      <LiveKitVoiceContent
        call={call}
        currentUserId={currentUserId}
        onEndCall={handleUserHangup}
      />
    </LiveKitRoom>
  );
}
