"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Volume2, VolumeX, CheckCircle, ArrowRight, X, MapPin, Calendar, Clock } from "lucide-react";
import { bookingAlertManager, ActiveBookingAlert } from "@/lib/bookingAlertManager";
import { useTranslation } from "@/lib/i18n";

export default function BookingAlertBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const [alert, setAlert] = useState<ActiveBookingAlert | null>(null);
  const [soundPlaying, setSoundPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = bookingAlertManager.subscribe((activeAlert) => {
      setAlert(activeAlert);
      setSoundPlaying(!!activeAlert);
    });

    // Auto-reflect sound timeout after 10s
    const soundTimer = setTimeout(() => {
      setSoundPlaying(false);
    }, 10000);

    return () => {
      unsubscribe();
      clearTimeout(soundTimer);
    };
  }, [alert?.bookingId]);

  if (!alert) return null;

  const handleStopSound = () => {
    bookingAlertManager.stopSoundOnly();
    setSoundPlaying(false);
  };

  const handleDismiss = () => {
    bookingAlertManager.stopAlert();
    setSoundPlaying(false);
  };

  const handleView = () => {
    bookingAlertManager.stopAlert();
    setSoundPlaying(false);
    router.push("/provider/bookings?tab=Requested");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed top-4 inset-x-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999] pointer-events-auto"
      >
        <div className="relative rounded-2xl border-2 border-primary/40 bg-card text-card-foreground p-4 sm:p-5 shadow-2xl backdrop-blur-xl ring-4 ring-primary/10 overflow-hidden">
          {/* Animated top indicator */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 animate-pulse" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss alert"
            className="absolute top-3.5 right-3.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5 mb-3">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Bell className="w-6 h-6 animate-bounce text-primary" />
              </div>
              {soundPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div className="flex-1 pr-6">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-foreground">
                  {t("booking.newBookingReceived") || "New Booking Received!"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {alert.customerName} booked <span className="font-semibold text-foreground">{alert.serviceName}</span>
              </p>
            </div>
          </div>

          {/* Details summary */}
          <div className="rounded-xl bg-muted/60 p-3 mb-3.5 text-xs space-y-1.5 border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {alert.date} {alert.time ? `• ${alert.time}` : ""}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Visit Fee: ₹{alert.visitingCharge || 250}
              </span>
            </div>
            {alert.address && (
              <div className="flex items-start gap-1.5 text-muted-foreground pt-1 border-t border-border/40">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="line-clamp-1">{alert.address}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {soundPlaying && (
              <button
                type="button"
                onClick={handleStopSound}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border bg-muted/70 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                <span>{t("booking.stopRingtone") || "Stop Ringtone"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleView}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-sm transition-all cursor-pointer"
            >
              <span>{t("booking.viewJob") || "View Booking"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
