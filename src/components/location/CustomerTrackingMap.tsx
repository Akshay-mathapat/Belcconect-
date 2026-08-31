"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation, Radio, Clock, ShieldCheck, ExternalLink, MapPin, Loader2, AlertCircle } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useTranslation } from "@/lib/i18n";

interface CustomerTrackingMapProps {
  bookingId: string;
  destinationLatitude: number;
  destinationLongitude: number;
  initialProviderLatitude?: number | null;
  initialProviderLongitude?: number | null;
  providerLocationUpdatedAt?: string | number | null;
  address: string;
  providerName?: string;
}

// Strict coordinate validation helper: -90 <= lat <= 90 and -180 <= lng <= 180
function isValidCoord(lat: any, lng: any): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}

// Bearing calculation between two lat/lng points (0° - 360°)
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

// Distance in meters between two lat/lng pairs (Haversine formula)
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const parseDbTimestamp = (tsVal?: string | number | null): number | null => {
  if (tsVal === null || tsVal === undefined) return null;
  if (typeof tsVal === "number") return Number.isFinite(tsVal) ? tsVal : null;
  const parsed = new Date(tsVal).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export default function CustomerTrackingMap({
  bookingId,
  destinationLatitude,
  destinationLongitude,
  initialProviderLatitude,
  initialProviderLongitude,
  providerLocationUpdatedAt,
  address,
  providerName = "Service Expert"
}: CustomerTrackingMapProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Timestamps for priority tracking (Socket vs DB)
  const socketLastTimestampRef = useRef<number | null>(null);
  const dbLastTimestampRef = useRef<number | null>(null);

  // Check if real initial GPS coordinates exist and parse valid timestamp
  const initialValid = isValidCoord(initialProviderLatitude, initialProviderLongitude);
  const initialDbTs = initialValid ? parseDbTimestamp(providerLocationUpdatedAt) : null;

  // Position & Orientation State
  const [providerCoords, setProviderCoords] = useState<{ lat: number; lng: number } | null>(
    initialValid
      ? { lat: Number(initialProviderLatitude), lng: Number(initialProviderLongitude) }
      : null
  );
  const [heading, setHeading] = useState<number>(135);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Real-Time Freshness Tracking (Live <= 15s | Updating <= 60s | Unavailable > 60s)
  const [lastPingTimestamp, setLastPingTimestamp] = useState<number | null>(initialDbTs);
  const [freshnessStatus, setFreshnessStatus] = useState<"live" | "updating" | "unavailable">(
    initialDbTs !== null && (Date.now() - initialDbTs) <= 15000
      ? "live"
      : initialDbTs !== null && (Date.now() - initialDbTs) <= 60000
      ? "updating"
      : "unavailable"
  );
  const [secsAgo, setSecsAgo] = useState<number>(0);

  // Routing Metrics State
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const [routeAvailable, setRouteAvailable] = useState<boolean>(true);
  const [providerLocationName, setProviderLocationName] = useState<string | null>(null);
  const lastGeocodedCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Fetch reverse-geocoded area/locality name when provider coordinates change significantly
  useEffect(() => {
    if (!providerCoords) return;

    if (lastGeocodedCoords.current) {
      const dist = getDistanceMeters(
        lastGeocodedCoords.current.lat,
        lastGeocodedCoords.current.lng,
        providerCoords.lat,
        providerCoords.lng
      );
      if (dist < 80) return; // Skip reverse geocoding if moved less than 80 meters
    }

    let isMounted = true;
    const fetchAreaName = async () => {
      try {
        const res = await fetch(
          `/api/location/reverse-geocode?lat=${providerCoords.lat}&lng=${providerCoords.lng}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data) {
          const area = data.locality
            ? `${data.locality}, ${data.city || "Belagavi"}`
            : data.address
            ? data.address.split(",").slice(0, 2).join(",")
            : null;
          if (area) {
            setProviderLocationName(area);
            lastGeocodedCoords.current = providerCoords;
          }
        }
      } catch (err) {
        console.warn("[CustomerTrackingMap] Failed to reverse geocode provider location:", err);
      }
    };

    fetchAreaName();
    return () => {
      isMounted = false;
    };
  }, [providerCoords]);

  // Ref tracking current marker coordinates for lerp interpolation
  const currentMarkerCoords = useRef<{ lat: number; lng: number } | null>(
    initialValid
      ? { lat: Number(initialProviderLatitude), lng: Number(initialProviderLongitude) }
      : null
  );

  // 1. Join Socket.IO Room & listen for live location updates (with auto-reconnect)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const subscribeRoom = () => {
      socket.emit("booking:subscribe", { bookingId });
    };

    subscribeRoom();
    socket.on("connect", subscribeRoom);

    const handleLocationUpdate = (data: any) => {
      if (data && data.bookingId === bookingId && isValidCoord(data.latitude, data.longitude)) {
        const newLat = Number(data.latitude);
        const newLng = Number(data.longitude);
        const acc = typeof data.accuracy === "number" && Number.isFinite(data.accuracy) ? data.accuracy : null;
        
        const parsedTs = Number(data.timestamp);
        const ts = Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : Date.now();

        // Discard out-of-order stale socket packets
        if (socketLastTimestampRef.current && ts < socketLastTimestampRef.current) {
          return;
        }

        socketLastTimestampRef.current = ts;
        setAccuracy(acc);

        setProviderCoords((prevCoords) => {
          if (typeof data.heading === "number" && !isNaN(data.heading) && data.heading !== 0) {
            setHeading(data.heading);
          } else if (prevCoords && (prevCoords.lat !== newLat || prevCoords.lng !== newLng)) {
            const computedHeading = calculateBearing(prevCoords.lat, prevCoords.lng, newLat, newLng);
            if (computedHeading !== 0) {
              setHeading(computedHeading);
            }
          }
          return { lat: newLat, lng: newLng };
        });

        setLastPingTimestamp(ts);
      }
    };

    socket.on("provider:location:update", handleLocationUpdate);

    return () => {
      socket.off("connect", subscribeRoom);
      socket.emit("booking:unsubscribe", { bookingId });
      socket.off("provider:location:update", handleLocationUpdate);
    };
  }, [bookingId]);

  // 2. React to PostgreSQL Polled DB Fallback Props (without overwriting newer Socket.IO updates)
  useEffect(() => {
    if (isValidCoord(initialProviderLatitude, initialProviderLongitude)) {
      const dbLat = Number(initialProviderLatitude);
      const dbLng = Number(initialProviderLongitude);
      const dbTs = parseDbTimestamp(providerLocationUpdatedAt) || Date.now();

      // Only apply DB fallback if Socket.IO position is absent or older than valid DB timestamp
      if (!socketLastTimestampRef.current || (dbTs !== null && socketLastTimestampRef.current < dbTs)) {
        if (dbTs !== null) {
          dbLastTimestampRef.current = dbTs;
        }
        setProviderCoords({ lat: dbLat, lng: dbLng });
        if (dbTs !== null) {
          setLastPingTimestamp(dbTs);
        }
      }
    }
  }, [initialProviderLatitude, initialProviderLongitude, providerLocationUpdatedAt]);

  // Periodic DB fallback polling when socket updates are quiet
  useEffect(() => {
    if (!bookingId) return;

    const pollDbLocation = async () => {
      // Skip REST poll if recent socket ping arrived in last 10s
      if (socketLastTimestampRef.current && (Date.now() - socketLastTimestampRef.current) < 10000) {
        return;
      }

      try {
        const token = typeof window !== "undefined"
          ? (localStorage.getItem("cityconnect_auth_token") || localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token"))
          : null;
        const userId = typeof window !== "undefined"
          ? (localStorage.getItem("cityconnect_user_id") || localStorage.getItem("user_id"))
          : null;

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (userId) headers["x-user-id"] = userId;

        const res = await fetch(`/api/bookings/${bookingId}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const b = data.booking;
        if (b && isValidCoord(b.providerCurrentLatitude, b.providerCurrentLongitude)) {
          const lat = Number(b.providerCurrentLatitude);
          const lng = Number(b.providerCurrentLongitude);
          const updatedTs = parseDbTimestamp(b.providerLocationUpdatedAt) || Date.now();

          if (!socketLastTimestampRef.current || socketLastTimestampRef.current < updatedTs) {
            setProviderCoords({ lat, lng });
            setLastPingTimestamp(updatedTs);
          }
        }
      } catch (err) {
        console.warn("[CustomerTrackingMap] Polling fallback error:", err);
      }
    };

    const interval = setInterval(pollDbLocation, 10000);
    return () => clearInterval(interval);
  }, [bookingId]);

  // 3. Strict 1-Second Freshness State Timer (Live <= 15s | Updating <= 60s | Unavailable > 60s)
  useEffect(() => {
    const updateFreshness = () => {
      if (!lastPingTimestamp) {
        setFreshnessStatus("unavailable");
        setSecsAgo(0);
        return;
      }

      const diffSecs = Math.max(0, Math.floor((Date.now() - lastPingTimestamp) / 1000));
      setSecsAgo(diffSecs);

      if (diffSecs <= 15) {
        setFreshnessStatus("live");
      } else if (diffSecs <= 60) {
        setFreshnessStatus("updating");
      } else {
        setFreshnessStatus("unavailable");
      }
    };

    updateFreshness();
    const timerInterval = setInterval(updateFreshness, 1000);
    return () => clearInterval(timerInterval);
  }, [lastPingTimestamp]);

  // 4. Fetch OSRM Route strictly between REAL provider position & destination (No fake movement)
  useEffect(() => {
    if (!providerCoords) return;
    let isMounted = true;

    async function fetchOsrmRoute() {
      if (!providerCoords) return;
      try {
        const destLat = destinationLatitude ?? 15.8497;
        const destLng = destinationLongitude ?? 74.4977;
        const pLat = providerCoords.lat;
        const pLng = providerCoords.lng;
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${destLng},${destLat}?overview=full&geometries=geojson`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("OSRM route fetch failed");

        const data = await res.json();
        if (!isMounted || !data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const distKmVal = Number((route.distance / 1000).toFixed(1));
        const durationMinsVal = Math.ceil(route.duration / 60);

        setDistanceKm(distKmVal);
        setEtaMins(durationMinsVal);
        setRouteAvailable(true);

        if (route.geometry && route.geometry.coordinates) {
          const latLngs = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));

          // Draw Polyline on Leaflet Map
          if (leafletMapRef.current) {
            const L = (await import("leaflet")).default;
            const polylinePoints = latLngs.map((pt: { lat: number; lng: number }) => [pt.lat, pt.lng]);

            if (routePolylineRef.current) {
              routePolylineRef.current.setLatLngs(polylinePoints);
            } else {
              routePolylineRef.current = L.polyline(polylinePoints, {
                color: "#2563eb",
                weight: 5,
                opacity: 0.85,
                dashArray: "8, 8"
              }).addTo(leafletMapRef.current);
            }
          }
        }
      } catch (err) {
        console.warn("[CustomerTrackingMap] OSRM Route fetch fallback:", err);
        if (isMounted) {
          setRouteAvailable(false);
          if (routePolylineRef.current && leafletMapRef.current) {
            try {
              leafletMapRef.current.removeLayer(routePolylineRef.current);
              routePolylineRef.current = null;
            } catch (e) {}
          }
        }
      }
    }

    fetchOsrmRoute();
    const routeInterval = setInterval(fetchOsrmRoute, 35000);

    return () => {
      isMounted = false;
      clearInterval(routeInterval);
    };
  }, [providerCoords, destinationLatitude, destinationLongitude]);

  // 5. Initialize Leaflet Map & Customer Destination Marker
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    async function initMap() {
      const L = (await import("leaflet")).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const container = mapContainerRef.current;
      if (!container) return;

      const hasValidDest = isValidCoord(destinationLatitude, destinationLongitude);
      const destLat = hasValidDest ? Number(destinationLatitude) : null;
      const destLng = hasValidDest ? Number(destinationLongitude) : null;

      if (!leafletMapRef.current) {
        const initialCenter: [number, number] = hasValidDest
          ? [destLat!, destLng!]
          : providerCoords
          ? [providerCoords.lat, providerCoords.lng]
          : [15.8497, 74.4977];

        const map = L.map(container, {
          center: initialCenter,
          zoom: 15,
          zoomControl: false,
          dragging: true
        });

        // Position zoom controls at top-right to prevent collision with map pins and overlays
        L.control.zoom({ position: "topright" }).addTo(map);

        // Fast, reliable OpenStreetMap tile layer (Carto Voyager styled map)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        leafletMapRef.current = map;

        // Force tile grid recalculation
        const triggerInvalidate = () => {
          if (leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        };

        setTimeout(triggerInvalidate, 100);
        setTimeout(triggerInvalidate, 400);
        setTimeout(triggerInvalidate, 1200);

        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(triggerInvalidate);
          ro.observe(container);
        }
      }

      const map = leafletMapRef.current;

      // Customer Destination Marker (Red Pin) - Render strictly if valid destination coordinates exist
      if (hasValidDest) {
        const destIcon = L.divIcon({
          className: "customer-dest-pin",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
              <div style="position: absolute; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.3); border-radius: 50%;"></div>
              <div style="width: 36px; height: 36px; background: #ef4444; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = L.marker([destLat!, destLng!], { icon: destIcon })
            .addTo(map)
            .bindPopup(`<b>${t("location.serviceDestination")}</b><br/>${address}`);
        }
      } else if (destinationMarkerRef.current) {
        try {
          map.removeLayer(destinationMarkerRef.current);
          destinationMarkerRef.current = null;
        } catch (e) {}
      }
    }

    initMap();
  }, [destinationLatitude, destinationLongitude, address, t, providerCoords]);

  // 6. Smooth Marker Movement strictly between REAL GPS Updates & Freshness-aware Visual Styling
  useEffect(() => {
    if (!providerCoords || typeof window === "undefined") return;

    let isMounted = true;

    async function updateProviderMarkerSmooth() {
      const L = (await import("leaflet")).default;
      const map = leafletMapRef.current;
      if (!map) return;

      const targetLat = providerCoords!.lat;
      const targetLng = providerCoords!.lng;

      // Single Marker HTML based on Freshness State
      const isUnavailable = freshnessStatus === "unavailable";
      const isLive = freshnessStatus === "live";

      const badgeText = isUnavailable
        ? t("location.lastKnown")
        : etaMins !== null
        ? t("location.estimatedEta", { eta: etaMins })
        : t("location.providerOnTheWay");

      const locationTextDisplay = providerLocationName
        ? `📍 ${providerLocationName}`
        : isUnavailable
        ? t("location.lastKnown")
        : t("location.live");

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2px;">
          <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${providerName}</div>
          <div style="font-size: 11px; color: #2563eb; font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 3px;">
            <span>${locationTextDisplay}</span>
          </div>
        </div>
      `;

      const buildIconHtml = (deg: number, text: string) => `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 140px;">
          <!-- Floating Map Tag -->
          <div style="background: ${isUnavailable ? "#334155" : "#0f172a"}; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1.5px solid ${isUnavailable ? "#94a3b8" : "#3b82f6"}; box-shadow: 0 4px 14px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${isUnavailable ? "#94a3b8" : isLive ? "#10b981" : "#f59e0b"}; ${!isUnavailable ? "animation: ping 1.2s infinite;" : ""} display: inline-block;"></span>
            <span>${text}</span>
          </div>

          <!-- Vehicle Marker Container -->
          <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            ${!isUnavailable ? `<div style="position: absolute; width: 52px; height: 52px; background: ${isLive ? "rgba(37, 99, 235, 0.35)" : "rgba(245, 158, 11, 0.35)"}; border-radius: 50%; animation: pulse 1.8s infinite;"></div>` : ""}
            <div style="width: 44px; height: 44px; background: ${isUnavailable ? "linear-gradient(135deg, #475569, #334155)" : "linear-gradient(135deg, #2563eb, #1d4ed8)"}; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.5); transform: rotate(${deg}deg); transition: transform 0.4s ease; filter: ${isUnavailable ? "grayscale(0.6)" : "none"};">
              <!-- Letstrack-style Top-Down Vehicle / Bike Marker SVG -->
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <!-- Vehicle Body Shadow / Glow -->
                <ellipse cx="18" cy="18" rx="7" ry="15" fill="rgba(0,0,0,0.3)" transform="rotate(0 18 18)"/>
                <!-- Main Motorcycle/Vehicle Frame -->
                <path d="M18 4 C15 7 14 12 14 20 C14 25 15 29 18 32 C21 29 22 25 22 20 C22 12 21 7 18 4 Z" fill="#ffffff"/>
                <!-- Front Windshield / Headlight -->
                <path d="M16 6 L20 6 L19 11 L17 11 Z" fill="#60a5fa"/>
                <!-- Rider Helmet (Top-Down Oval) -->
                <ellipse cx="18" cy="17" rx="4.5" ry="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
                <!-- Visor Accent -->
                <path d="M15.5 14.5 C16.5 13.5 19.5 13.5 20.5 14.5" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                <!-- Handlebars -->
                <rect x="9" y="10" width="18" height="2.5" rx="1.2" fill="#ffffff"/>
                <!-- Rear Break Lights -->
                <circle cx="16" cy="30" r="1" fill="#ef4444"/>
                <circle cx="20" cy="30" r="1" fill="#ef4444"/>
              </svg>
            </div>
          </div>
        </div>
      `;

      const provIcon = L.divIcon({
        className: "provider-gps-pin",
        html: buildIconHtml(heading, badgeText),
        iconSize: [140, 85],
        iconAnchor: [70, 61]
      });

      const destLat = destinationLatitude ?? 15.8497;
      const destLng = destinationLongitude ?? 74.4977;

      const bounds = L.latLngBounds([destLat, destLng], [targetLat, targetLng]);

      if (!providerMarkerRef.current) {
        providerMarkerRef.current = L.marker([targetLat, targetLng], { icon: provIcon })
          .addTo(map)
          .bindPopup(popupHtml);
        currentMarkerCoords.current = { lat: targetLat, lng: targetLng };

        const hasValidDest = isValidCoord(destinationLatitude, destinationLongitude);
        if (hasValidDest) {
          const bounds = L.latLngBounds([Number(destinationLatitude), Number(destinationLongitude)], [targetLat, targetLng]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else {
          map.setView([targetLat, targetLng], 15);
        }
      } else {
        providerMarkerRef.current.setIcon(provIcon);
        providerMarkerRef.current.setPopupContent(popupHtml);

        const startLat = currentMarkerCoords.current?.lat ?? targetLat;
        const startLng = currentMarkerCoords.current?.lng ?? targetLng;

        if (startLat === targetLat && startLng === targetLng) return;

        const startTime = performance.now();
        const duration = 1200;

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }

        const animateMarker = (now: number) => {
          if (!isMounted || !providerMarkerRef.current) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);

          const curLat = startLat + (targetLat - startLat) * progress;
          const curLng = startLng + (targetLng - startLng) * progress;

          providerMarkerRef.current.setLatLng([curLat, curLng]);
          currentMarkerCoords.current = { lat: curLat, lng: curLng };

          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animateMarker);
          }
        };

        animFrameRef.current = requestAnimationFrame(animateMarker);
      }
    }

    updateProviderMarkerSmooth();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [providerCoords, heading, freshnessStatus, etaMins, destinationLatitude, destinationLongitude, providerName, providerLocationName, t]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
        destinationMarkerRef.current = null;
        providerMarkerRef.current = null;
        routePolylineRef.current = null;
      }
    };
  }, []);

  // Header Title & Subtitle Derivation based on Freshness & Routing
  const getHeaderTitle = () => {
    if (!providerCoords) return t("location.waitingProvider");
    if (freshnessStatus === "unavailable") return t("location.unavailable");
    if (etaMins !== null && distanceKm !== null) {
      return t("location.arrivingIn", { eta: etaMins, dist: `${distanceKm} km` });
    }
    return t("location.providerOnTheWay");
  };

  const getHeaderSubtitle = () => {
    if (!providerCoords) return t("location.waitingProvider");
    if (freshnessStatus === "unavailable") return t("location.lastKnown");
    if (!routeAvailable) return t("location.routeUnavailable");
    return t("location.privacyNotice");
  };

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl flex flex-col">
      {/* Top Floating Status Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-md ${
            freshnessStatus === "live"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : freshnessStatus === "updating"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-slate-700/40 text-slate-300 border-slate-600/40"
          }`}>
            {freshnessStatus === "live" ? (
              <Radio className="h-6 w-6 animate-pulse text-emerald-400" />
            ) : freshnessStatus === "updating" ? (
              <Clock className="h-6 w-6 animate-spin text-amber-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-base sm:text-lg font-extrabold leading-tight">
              {getHeaderTitle()}
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              {getHeaderSubtitle()}
            </p>
          </div>
        </div>

        {/* Single Authoritative Pill Badge */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md ${
          freshnessStatus === "live"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
            : freshnessStatus === "updating"
            ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
            : "bg-slate-800 text-slate-400 border-slate-700"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            freshnessStatus === "live"
              ? "bg-emerald-400 animate-ping"
              : freshnessStatus === "updating"
              ? "bg-amber-400 animate-pulse"
              : "bg-slate-500"
          }`} />
          {freshnessStatus === "live"
            ? t("location.live")
            : freshnessStatus === "updating"
            ? t("location.updating")
            : t("location.unavailable")}
          {secsAgo > 0 && freshnessStatus !== "unavailable" && ` (${secsAgo}s)`}
        </span>
      </div>

      {/* Map Canvas with Floating Overlay when Provider Coords are Absent */}
      <div className="relative w-full h-[320px] sm:h-[400px] bg-slate-900">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Recenter Map Button */}
        {providerCoords && (
          <button
            type="button"
            onClick={async () => {
              if (leafletMapRef.current) {
                const L = (await import("leaflet")).default;
                const hasValidDest = isValidCoord(destinationLatitude, destinationLongitude);
                if (hasValidDest) {
                  const bounds = L.latLngBounds(
                    [Number(destinationLatitude), Number(destinationLongitude)],
                    [providerCoords.lat, providerCoords.lng]
                  );
                  leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                } else {
                  leafletMapRef.current.setView([providerCoords.lat, providerCoords.lng], 16);
                }
              }
            }}
            className="absolute bottom-4 right-4 z-10 p-2.5 rounded-2xl bg-slate-900/90 text-white border border-slate-700/80 shadow-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 text-xs font-bold backdrop-blur-md cursor-pointer"
            title="Recenter Map"
          >
            <Navigation className="w-4 h-4 text-blue-400 fill-current" />
            <span className="hidden sm:inline">Recenter</span>
          </button>
        )}

        {!providerCoords && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 max-w-sm shadow-2xl flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  {t("location.waitingProvider")}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The service provider has not started travelling yet. Live GPS movement will appear here as soon as travel begins.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{t("location.privacyNotice")}</span>
        </div>

        {providerCoords && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${providerCoords.lat},${providerCoords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            <span>{t("location.openGoogleMaps")}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

