"use client";

import { useState, useEffect } from "react";
import { Download, CheckCircle2, Smartphone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useTranslation } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";

interface InstallAppButtonProps {
  className?: string;
  isMobileOnly?: boolean;
}

export function InstallAppButton({ className = "", isMobileOnly = false }: InstallAppButtonProps) {
  const { isInstalled, installApp, installSuccess, setInstallSuccess } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const isNative =
          Capacitor.isNativePlatform() ||
          Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
          ((window as any).Capacitor?.getPlatform?.() !== "web" && Boolean((window as any).Capacitor));
        setIsNativeApp(Boolean(isNative));
      } catch {
        setIsNativeApp(false);
      }
    }
  }, []);

  const isCurrentlyNative =
    typeof window !== "undefined" &&
    (Capacitor.isNativePlatform() ||
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      ((window as any).Capacitor?.getPlatform?.() !== "web" && Boolean((window as any).Capacitor)));

  // If already inside the native Android/iOS APK, or already installed as standalone PWA
  if (isCurrentlyNative || isNativeApp || (isInstalled && !installSuccess)) {
    return null;
  }

  const handleInstallClick = async () => {
    const outcome = await installApp();
    if (outcome === "unavailable") {
      setShowGuide(true);
    }
  };

  return (
    <>
      {!isInstalled && (
        <div className={`relative inline-flex items-center ${className}`}>
          <button
            onClick={handleInstallClick}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            title="Install BelConnect App"
            aria-label="Install BelConnect App"
            data-tour="install-app-button"
            className={`group relative inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1D4ED8]/60 dark:border-blue-400/60 bg-transparent text-[#1D4ED8] dark:text-blue-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:border-[#1D4ED8] dark:hover:border-blue-400 text-xs font-bold transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer min-h-[44px] h-[44px] ${
              isMobileOnly ? "px-3 py-2" : "px-3.5 py-2"
            }`}
          >
            {/* Outline Download Icon */}
            <Download className="h-4 w-4 text-[#1D4ED8] dark:text-blue-300 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5" />

            {/* Button Text */}
            <span className={`${isMobileOnly ? "inline" : "hidden sm:inline-block"} font-bold tracking-tight whitespace-nowrap`}>
              Install App
            </span>
          </button>

          {/* Tooltip on Hover */}
          <AnimatePresence>
            {tooltipVisible && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-lg border border-slate-700/50 pointer-events-none"
              >
                Install BelConnect App
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Guide Modal for unsupported native prompt or manual desktop/mobile install */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <span>Install BelConnect App</span>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>To install BelConnect as an application on your device:</p>
                <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
                  <li>Click your browser menu icon or address bar install button.</li>
                  <li>Select <span className="text-blue-600 font-bold">&ldquo;Install BelConnect&rdquo;</span> or <span className="text-blue-600 font-bold">&ldquo;Add to Home Screen&rdquo;</span>.</li>
                  <li>Confirm to launch BelConnect as a standalone app!</li>
                </ol>
              </div>

              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightweight Success Toast */}
      <AnimatePresence>
        {installSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 text-xs font-semibold"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
            <div>
              <p className="font-bold">BelConnect App installed successfully!</p>
              <p className="text-[10px] text-emerald-100 font-normal">You can now access BelConnect from your home screen or desktop.</p>
            </div>
            <button onClick={() => setInstallSuccess(false)} className="ml-2 hover:opacity-80 p-1">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
