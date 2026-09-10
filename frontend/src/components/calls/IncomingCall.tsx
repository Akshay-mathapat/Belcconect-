"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, ShieldCheck } from "lucide-react";
import { CallRecord } from "@/lib/calls";

import { callAudioManager } from "@/lib/callAudioManager";

interface IncomingCallProps {
  call: CallRecord;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({ call, onAccept, onReject }: IncomingCallProps) {
  const callerName = call.callerName || "BelConnect User";
  const callerAvatar = call.callerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";
  const isAcceptedRef = useRef(false);

  // Play phone-ringing.mp3 & trigger mobile vibration on incoming call
  useEffect(() => {
    callAudioManager.playIncoming();
    callAudioManager.playIncoming(call.id);

    let interval: any = null;
    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      try {
        navigator.vibrate([400, 300, 400, 300, 600]);
        interval = setInterval(() => {
          if (navigator.vibrate) {
            navigator.vibrate([400, 300, 400, 300, 600]);
          }
        }, 2000);
      } catch (e) {}
    }

    return () => {
      if (interval) clearInterval(interval);
      callAudioManager.stopIncoming();
    };
  }, [call.id]);

  const handleAccept = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isAcceptedRef.current) return;
    isAcceptedRef.current = true;

    // Immediately stop ringing
    callAudioManager.stopAll();

    // Explicitly unlock Web Audio Context on user gesture thread
    if (typeof window !== "undefined") {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume();
          }
        }
      } catch (err) {}
    }

    onAccept();
  };

  const handleReject = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    callAudioManager.stopAll();
    onReject();
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 touch-none select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden my-auto"
      >
        {/* Pulsing Backlight Effect */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-emerald-500/25 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-blue-500/25 rounded-full blur-3xl animate-pulse" />

        {/* Security Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Encrypted In-App Voice Call
        </div>

        {/* Caller Avatar with Ringing Waves */}
        <div className="relative mb-6">
          <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping opacity-75" />
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold text-4xl sm:text-5xl flex items-center justify-center border-4 border-slate-800 shadow-2xl relative z-10 shrink-0">
            {callerName ? callerName.trim().charAt(0).toUpperCase() : "U"}
          </div>
        </div>

        {/* Caller Meta */}
        <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{callerName}</h3>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
          {call.serviceName || "Service Booking Call"}
        </p>

        <p className="text-xs font-bold text-emerald-400 mt-4 tracking-widest uppercase animate-pulse flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Incoming Call...
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-evenly w-full mt-8 pt-2 gap-4">
          {/* Reject Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              onTouchEnd={handleReject}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600 active:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xl ring-4 ring-rose-600/30 scale-100 hover:scale-105 active:scale-95 touch-manipulation"
              title="Decline Call"
            >
              <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
            <span className="text-xs font-bold text-slate-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              onTouchEnd={handleAccept}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 active:bg-emerald-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xl ring-4 ring-emerald-500/40 scale-105 hover:scale-110 active:scale-95 animate-bounce touch-manipulation"
              title="Accept Call"
            >
              <Phone className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
            <span className="text-xs font-bold text-emerald-400">Accept</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
