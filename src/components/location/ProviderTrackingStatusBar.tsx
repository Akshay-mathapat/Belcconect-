"use client";

import React from "react";
import { Radio, AlertTriangle, WifiOff, Sun, Info, Smartphone } from "lucide-react";

interface ProviderTrackingStatusBarProps {
  isTracking: boolean;
  isBackground: boolean;
  isOffline: boolean;
  accuracy?: number | null;
  lastTxTimestamp?: number | null;
  wakeLockSupported?: boolean;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
  onShowNoticeModal?: () => void;
}

export default function ProviderTrackingStatusBar({
  isTracking,
  isBackground,
  isOffline,
  accuracy,
  lastTxTimestamp,
  wakeLockSupported,
  wakeLockActive,
  onToggleWakeLock,
  onShowNoticeModal
}: ProviderTrackingStatusBarProps) {
  if (!isTracking) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-md space-y-3 transition-all">
      {/* Top Main Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Indicator & Labels */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md ${
            isOffline
              ? "bg-red-500/10 text-red-500 border-red-500/20"
              : isBackground
              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          }`}>
            {isOffline ? (
              <WifiOff className="h-5 w-5 animate-pulse text-red-500" />
            ) : isBackground ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Radio className="h-5 w-5 animate-pulse text-emerald-500" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isOffline
                  ? "bg-red-500"
                  : isBackground
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500 animate-ping"
              }`} />
              <h4 className="font-heading text-sm font-extrabold text-foreground">
                {isOffline
                  ? "Internet connection lost. Waiting to reconnect."
                  : isBackground
                  ? "BelConnect is in the background. Live location may pause."
                  : "Live location sharing active"}
              </h4>
            </div>
            
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {isOffline
                ? "Automatic reconnect will attempt when online"
                : isBackground
                ? "Re-open browser screen to resume real-time transmission"
                : "Keep BelConnect open"}
              {accuracy ? ` • GPS Accuracy ~${Math.round(accuracy)}m` : ""}
            </p>
          </div>
        </div>

        {/* Right Actions: Wake Lock & Help Info */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {wakeLockSupported && onToggleWakeLock && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                wakeLockActive
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
              }`}
              title="Prevent phone screen from dimming while travelling"
            >
              <Sun className={`w-3.5 h-3.5 ${wakeLockActive ? "text-amber-500 animate-spin" : ""}`} />
              <span>{wakeLockActive ? "Screen Awake Active" : "Keep screen awake while travelling"}</span>
            </button>
          )}

          {onShowNoticeModal && (
            <button
              type="button"
              onClick={onShowNoticeModal}
              className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
              title="Location Guidance Help"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
