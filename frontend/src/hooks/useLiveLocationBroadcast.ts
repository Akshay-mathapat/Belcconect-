"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BookingStatus } from "@/types/provider";
import { getSocket } from "@/lib/socket";
import { Capacitor, registerPlugin } from "@capacitor/core";

const ProviderLocationPlugin = registerPlugin<any>("ProviderLocation");

const ACTIVE_TRACKING_STATUSES: (BookingStatus | string)[] = ["OnTheWay", "Started"];

// Haversine formula to compute distance in meters between two lat/lng pairs
function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface LiveLocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export function useLiveLocationBroadcast(
  bookingId: string | null | undefined,
  status: BookingStatus | string | null | undefined,
  role: "provider" | "customer" = "provider",
  enabled: boolean = true
) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<LiveLocationPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Background & Online UX Statuses
  const [isBackground, setIsBackground] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastTxTimestamp, setLastTxTimestamp] = useState<number | null>(null);

  // Screen Wake Lock API state
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockRequested, setWakeLockRequested] = useState(false);
  const wakeLockSentinelRef = useRef<any>(null);

  // Foreground notice dialog visibility state
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const lastSentPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastDbSavedPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Check Wake Lock support
  useEffect(() => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      setWakeLockSupported(true);
    }
  }, []);

  // Notice Trigger: When status transitions to OnTheWay or Started (e.g. Start Travel)
  useEffect(() => {
    if (
      role === "provider" &&
      status &&
      ACTIVE_TRACKING_STATUSES.includes(status) &&
      prevStatusRef.current !== status
    ) {
      setShowNoticeModal(true);
    }
    prevStatusRef.current = status ?? null;
  }, [status, role]);

  const dismissNoticeModal = useCallback(() => {
    setShowNoticeModal(false);
  }, []);

  const triggerNoticeModal = useCallback(() => {
    setShowNoticeModal(true);
  }, []);

  // Wake Lock Request & Release Management
  const requestWakeLock = useCallback(async () => {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (wakeLockSentinelRef.current) return;
      const sentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockSentinelRef.current = sentinel;
      setWakeLockActive(true);
      setWakeLockRequested(true);

      sentinel.addEventListener("release", () => {
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
      });
    } catch (err) {
      console.warn("[Wake Lock] Failed to acquire screen wake lock:", err);
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch (e) {}
      wakeLockSentinelRef.current = null;
    }
    setWakeLockActive(false);
    setWakeLockRequested(false);
  }, []);

  const toggleWakeLock = useCallback(() => {
    if (wakeLockActive) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  }, [wakeLockActive, requestWakeLock, releaseWakeLock]);

  // Stop native tracking explicitly when booking status is no longer active
  useEffect(() => {
    if (Capacitor.isNativePlatform() && status) {
      if (!ACTIVE_TRACKING_STATUSES.includes(status)) {
        ProviderLocationPlugin.stopTracking().catch(console.error);
      }
    }
  }, [status]);

  // Main Tracking Effect
  useEffect(() => {
    isMountedRef.current = true;
    const isWindowActive = Boolean(
      enabled && bookingId && status && ACTIVE_TRACKING_STATUSES.includes(status)
    );

    // Helper to safely clear watch
    const stopWatch = () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    // Stop tracking immediately if disabled or outside active tracking window
    if (!isWindowActive) {
      if (!Capacitor.isNativePlatform()) {
        stopWatch();
      }
      releaseWakeLock();
      setIsTracking(false);
      return;
    }

    setIsTracking(true);
    setError(null);

    // Capacitor Native Android Background Location Service
    if (Capacitor.isNativePlatform()) {
      const token = localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") || "";
      
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      if (!apiUrl && typeof window !== "undefined") {
        if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          apiUrl = window.location.origin + "/api";
        } else {
          apiUrl = "http://10.0.2.2:3000/api";
        }
      }
      if (!apiUrl.endsWith("/api")) {
          apiUrl += "/api";
      }
      
      ProviderLocationPlugin.startTracking({
        bookingId: bookingId!,
        token,
        apiUrl
      }).catch((err: any) => {
        console.error("Native tracking failed to start", err);
        setError("Native background location service failed to start.");
      });
      
      // Native service is NOT stopped on component unmount
      return;
    }

    // --- Web Browser Fallback ---
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit("booking:subscribe", { bookingId });
    }

    // Broadcast Real Position handler
    const handleSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, heading, speed, accuracy: rawAccuracy } = pos.coords;
      const now = Date.now();

      // Throttle React state updates to max 1Hz to prevent Chromium watchPosition spam bug
      if (lastSentPositionRef.current && (now - lastSentPositionRef.current.time < 1000)) {
        return;
      }

      // Validate numeric ranges strictly
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        console.warn(`[Location Broadcast] Out-of-bounds coordinates rejected: lat=${latitude}, lng=${longitude}`);
        return;
      }

      // Ignore extremely inaccurate reading (> 150m) to prevent erratic marker jumps
      if (typeof rawAccuracy === "number" && rawAccuracy > 150) {
        console.warn(`[Location Broadcast] Inaccurate reading rejected (${rawAccuracy}m accuracy)`);
        return;
      }

      setAccuracy(rawAccuracy ?? null);

      const newPos: LiveLocationPosition = {
        latitude,
        longitude,
        accuracy: rawAccuracy ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        timestamp: now
      };

      setLastPosition(newPos);

      // Throttled tracking broadcast: send Socket.IO if moved >= 5m OR at least 3.0 seconds elapsed
      let shouldSendSocket = false;

      if (!lastSentPositionRef.current) {
        shouldSendSocket = true;
      } else {
        const timeElapsedMs = now - lastSentPositionRef.current.time;
        const distMeters = getHaversineDistanceMeters(
          lastSentPositionRef.current.lat,
          lastSentPositionRef.current.lng,
          latitude,
          longitude
        );

        if (distMeters >= 5 || timeElapsedMs >= 3000) {
          shouldSendSocket = true;
        }
      }

      if (shouldSendSocket) {
        lastSentPositionRef.current = { lat: latitude, lng: longitude, time: now };
        setLastTxTimestamp(now);

        const payload = {
          bookingId,
          latitude,
          longitude,
          accuracy: rawAccuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp: now
        };

        // Emit Socket.IO event for real-time tracking (single authoritative event)
        const curSocket = getSocket();
        if (curSocket && curSocket.connected) {
          if (role === "provider") {
            curSocket.emit("provider:location:update", payload);
          } else {
            curSocket.emit("customer:location:update", payload);
          }
        }
      }

      // Throttled PostgreSQL DB persistence: REST POST every ~12 seconds OR if moved >= 25 meters
      let shouldSaveDb = false;
      if (!lastDbSavedPositionRef.current) {
        shouldSaveDb = true;
      } else {
        const dbTimeElapsedMs = now - lastDbSavedPositionRef.current.time;
        const dbDistMeters = getHaversineDistanceMeters(
          lastDbSavedPositionRef.current.lat,
          lastDbSavedPositionRef.current.lng,
          latitude,
          longitude
        );
        if (dbDistMeters >= 25 || dbTimeElapsedMs >= 12000) {
          shouldSaveDb = true;
        }
      }

      if (shouldSaveDb) {
        lastDbSavedPositionRef.current = { lat: latitude, lng: longitude, time: now };

        const token = typeof window !== "undefined"
          ? (localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token"))
          : null;
        const userId = typeof window !== "undefined"
          ? (localStorage.getItem("cityconnect_user_id") || localStorage.getItem("user_id"))
          : null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json"
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (userId) headers["x-user-id"] = userId;

        const endpoint = role === "provider" 
          ? `/api/bookings/${bookingId}/provider-location` 
          : `/api/bookings/${bookingId}/customer-location`;

        fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ latitude, longitude, accuracy: rawAccuracy ?? null })
        }).catch((err) => console.warn("[Location Broadcast] REST POST error:", err));
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn(`[Location Broadcast] Geolocation error (${err.code}): ${err.message}`);
      let userMsg = err.message;
      if (err.code === err.PERMISSION_DENIED) {
        userMsg = "Location permission denied. Please allow location access to share your live location.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        userMsg = "Unable to determine your current location. Please check device GPS settings.";
      } else if (err.code === err.TIMEOUT) {
        userMsg = "Location request timed out. Retrying...";
      }
      setError(userMsg);
    };

    const startWatch = () => {
      if (watchIdRef.current !== null) return;
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    };

    startWatch();

    // Restoration routine when returning from background / reconnecting
    const restoreTrackingSession = () => {
      if (!isMountedRef.current) return;

      // 1. Check network online status
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOffline(true);
        return;
      }
      setIsOffline(false);

      // 2. Restart watchPosition if lost or cleared
      if (watchIdRef.current === null && navigator.geolocation) {
        startWatch();
      }

      // 3. Reconnect & resubscribe Socket.IO if disconnected
      const curSocket = getSocket();
      if (curSocket) {
        if (!curSocket.connected) {
          curSocket.connect();
        }
        curSocket.emit("booking:subscribe", { bookingId });
      }

      // 4. Force a single high-accuracy getCurrentPosition to send next REAL reading immediately
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err) => console.warn("[Location Broadcast] Quick resume position check:", err.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }

      // 5. Reacquire wake lock if requested previously
      if (wakeLockRequested && !wakeLockSentinelRef.current) {
        requestWakeLock();
      }
    };

    // Page Visibility API handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setIsBackground(true);
        // Do NOT stop tracking intentionally, let OS handle suspension
      } else {
        setIsBackground(false);
        restoreTrackingSession();
      }
    };

    // Online & Focus Event handlers
    const handleOnline = () => {
      setIsOffline(false);
      restoreTrackingSession();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleFocusOrPageshow = () => {
      restoreTrackingSession();
    };

    // Attach Lifecycle Listeners safely
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("focus", handleFocusOrPageshow);
      window.addEventListener("pageshow", handleFocusOrPageshow);

      // Initial offline check
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOffline(true);
      }
    }

    return () => {
      isMountedRef.current = false;
      stopWatch();
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("focus", handleFocusOrPageshow);
        window.removeEventListener("pageshow", handleFocusOrPageshow);
      }
    };
  }, [bookingId, status, role, enabled, wakeLockRequested, requestWakeLock, releaseWakeLock]);

  return {
    isTracking,
    lastPosition,
    accuracy,
    error,
    isBackground,
    isOffline,
    lastTxTimestamp,
    showNoticeModal,
    dismissNoticeModal,
    triggerNoticeModal,
    wakeLockSupported,
    wakeLockActive,
    toggleWakeLock,
    requestWakeLock
  };
}
