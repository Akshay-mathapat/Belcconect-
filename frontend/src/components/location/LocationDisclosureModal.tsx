"use client";

import { motion } from "framer-motion";
import { MapPin, Navigation, ShieldCheck, X } from "lucide-react";
import { SITE_NAME } from "@/constants/site";

interface LocationDisclosureModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onDeny: () => void;
  isProvider?: boolean;
}

export function LocationDisclosureModal({
  isOpen,
  onAgree,
  onDeny,
  isProvider = false,
}: LocationDisclosureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-foreground"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Location Access Disclosure</h3>
              <p className="text-xs text-muted-foreground">{SITE_NAME} Data Safety</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDeny}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Explanatory Content */}
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            {SITE_NAME} requests access to your device’s location to provide core service functionality:
          </p>

          <div className="space-y-2.5 p-3.5 rounded-2xl bg-muted/40 border border-border">
            <div className="flex items-start gap-2.5">
              <Navigation className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block text-xs">Accurate Navigation & ETAs</strong>
                <span>Calculates realistic 20 km/h Belagavi city urban travel routes and live arrival time predictions.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block text-xs">Local Service Matching</strong>
                <span>Matches you with verified service providers nearest to your area (Tilakwadi, Shahapur, Camp, etc.).</span>
              </div>
            </div>

            {isProvider && (
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block text-xs">Active Job Background Tracking</strong>
                  <span>Background location only activates when you accept a booking and ceases immediately when completed or cancelled.</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/80">
            Your location data is collected solely for fulfillment of accepted service bookings and is never sold to third parties or used for advertising.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onDeny}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer text-center"
          >
            Not Now (Enter Manually)
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="w-full sm:flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer text-center"
          >
            Agree & Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
}
