"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, Smartphone, Lock } from "lucide-react";

interface ProviderForegroundNoticeModalProps {
  isOpen: boolean;
  onGotIt: () => void;
}

export default function ProviderForegroundNoticeModal({
  isOpen,
  onGotIt
}: ProviderForegroundNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-extrabold text-foreground leading-tight">
              Keep BelConnect open while travelling
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Live Location Guidance
            </p>
          </div>
        </div>

        {/* Primary Guidance Notice */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-foreground space-y-2 leading-relaxed">
          <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Important for Provider Navigation:</span>
          </p>
          <p className="text-muted-foreground">
            To share your live location with the customer, keep this screen open and keep Location/GPS enabled. Locking your phone or closing the browser may pause live tracking.
          </p>
        </div>

        {/* Mobile Technical Help Info Box */}
        <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/70 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Background Location Note</span>
          </div>
          <p className="text-[11px] leading-snug">
            For continuous tracking while your phone is locked, a native mobile app with background location permission is required. The current web version requires BelConnect to remain open.
          </p>
        </div>

        {/* "Got it" Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onGotIt}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Got it</span>
          </button>
        </div>

      </div>
    </div>
  );
}
