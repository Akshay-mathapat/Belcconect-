"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PhoneOff, ShieldCheck } from "lucide-react";
import { CallRecord } from "@/lib/calls";
import { ringtonePlayer } from "@/lib/ringtone";

interface OutgoingCallProps {
  call: CallRecord;
  onCancel: () => void;
}

export default function OutgoingCall({ call, onCancel }: OutgoingCallProps) {
  const receiverName = call.receiverName || "Service Contact";
  const receiverAvatar = call.receiverAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";

  // Play 80s outgoing ringback tone
  useEffect(() => {
    ringtonePlayer.startRingtone("outgoing");
    return () => {
      ringtonePlayer.stopRingtone();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 touch-none select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-bold text-slate-300 mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          Encrypted In-App Call
        </div>

        {/* Receiver Avatar with Ringing Animation */}
        <div className="relative mb-6">
          <span className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping opacity-75" />
          <img
            src={receiverAvatar}
            alt={receiverName}
            className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-2xl relative z-10"
          />
        </div>

        {/* Receiver Meta */}
        <h3 className="text-xl font-extrabold text-white tracking-tight">{receiverName}</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          {call.serviceName || "Service Booking"}
        </p>

        <p className="text-xs font-bold text-blue-400 mt-4 tracking-widest uppercase animate-pulse">
          Calling / Ringing...
        </p>

        {/* Cancel Action */}
        <div className="flex flex-col items-center gap-2 mt-8">
          <button
            type="button"
            onClick={onCancel}
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl ring-4 ring-rose-600/30 scale-105 active:scale-95"
            title="Cancel Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <span className="text-[11px] font-bold text-slate-400">Cancel Call</span>
        </div>
      </motion.div>
    </div>
  );
}
