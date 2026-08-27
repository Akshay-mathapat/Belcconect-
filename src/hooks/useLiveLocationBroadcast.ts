"use client";

import { useEffect, useRef, useState } from "react";
import { BookingStatus } from "@/types/provider";
import { getSocket } from "@/lib/socket";

const ACTIVE_TRACKING_STATUSES: (BookingStatus | string)[] = ["Accepted", "OnTheWay", "Started"];

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
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export function useLiveLocationBroadcast(
  bookingId: string | null | undefined,
  status: BookingStatus | string | null | undefined
) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<LiveLocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastSentPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const isWindowActive = Boolean(
      bookingId && status && ACTIVE_TRACKING_STATUSES.includes(status)
    );

    // Stop tracking immediately if outside active window
    if (!isWindowActive) {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      return;
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setIsTracking(true);
    setError(null);

    const socket = getSocket();

    const handleSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, heading, speed } = pos.coords;
      const now = Date.now();

      const newPos: LiveLocationPosition = {
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        timestamp: now
      };

      setLastPosition(newPos);

      // Throttling logic: send if moved >20m OR at least 10 seconds elapsed
      let shouldSend = false;

      if (!lastSentPositionRef.current) {
        shouldSend = true;
      } else {
        const timeElapsedMs = now - lastSentPositionRef.current.time;
        const distMeters = getHaversineDistanceMeters(
          lastSentPositionRef.current.lat,
          lastSentPositionRef.current.lng,
          latitude,
          longitude
        );

        if (distMeters >= 20 || timeElapsedMs >= 10000) {
          shouldSend = true;
        }
      }

      if (shouldSend) {
        lastSentPositionRef.current = { lat: latitude, lng: longitude, time: now };

        // (a) Emit Socket.IO event for real-time customer tracking
        if (socket && socket.connected) {
          socket.emit("location:update", {
            bookingId,
            latitude,
            longitude,
            heading: heading ?? null,
            speed: speed ?? null,
            timestamp: now
          });
        }

        // (b) REST POST to persist last-known position fire-and-forget
        fetch(`/api/bookings/${bookingId}/location`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": typeof window !== "undefined" ? localStorage.getItem("cityconnect_user_id") || "provider-1" : "provider-1"
          },
          body: JSON.stringify({ latitude, longitude })
        }).catch((err) => console.warn("[Location Broadcast] REST POST error:", err));
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn(`[Location Broadcast] Geolocation error (${err.code}): ${err.message}`);
      setError(err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    };
  }, [bookingId, status]);

  return { isTracking, lastPosition, error };
}
