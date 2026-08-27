"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation, Compass, AlertCircle, Info, Radio, Clock, ExternalLink } from "lucide-react";
import { getSocket } from "@/lib/socket";

interface ProviderMapViewProps {
  bookingId?: string;
  latitude?: number | null;
  longitude?: number | null;
  providerLatitude?: number | null;
  providerLongitude?: number | null;
  address: string;
  landmark?: string | null;
  instructions?: string | null;
  customerName?: string;
  customerPhone?: string;
}

export default function ProviderMapView({
  bookingId,
  latitude,
  longitude,
  providerLatitude,
  providerLongitude,
  address,
  landmark,
  instructions,
  customerName,
  customerPhone
}: ProviderMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Position & Orientation State
  const [providerCoords, setProviderCoords] = useState<{ lat: number; lng: number } | null>(
    providerLatitude && providerLongitude
      ? { lat: providerLatitude, lng: providerLongitude }
      : null
  );
  const [heading, setHeading] = useState<number>(0);

  // Metrics
  const [etaBadgeText, setEtaBadgeText] = useState<string>("ETA: Calc...");
  const [distanceText, setDistanceText] = useState<string>("Calculating route...");
  
  // Real-Time Pulse Relative Timer
  const [lastPingTimestamp, setLastPingTimestamp] = useState<number | null>(null);
  const [secondsAgoText, setSecondsAgoText] = useState<string>("Live beacon active");

  const currentMarkerCoords = useRef<{ lat: number; lng: number } | null>(
    providerLatitude && providerLongitude
      ? { lat: providerLatitude, lng: providerLongitude }
      : null
  );

  const hasCustomerCoords =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  // Update providerCoords when props change (fallback or initial load)
  useEffect(() => {
    if (providerLatitude && providerLongitude) {
      setProviderCoords({ lat: providerLatitude, lng: providerLongitude });
    }
  }, [providerLatitude, providerLongitude]);

  // 1. Subscribe to Socket.IO Room for Synchronized Event Streaming
  useEffect(() => {
    if (!bookingId) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit("booking:subscribe", { bookingId });

    const handleLocationUpdate = (data: any) => {
      if (data && data.bookingId === bookingId && data.latitude && data.longitude) {
        const newLat = Number(data.latitude);
        const newLng = Number(data.longitude);
        setProviderCoords({ lat: newLat, lng: newLng });
        if (typeof data.heading === "number" && !isNaN(data.heading)) {
          setHeading(data.heading);
        }
        setLastPingTimestamp(data.timestamp || Date.now());
      }
    };

    socket.on("location:update", handleLocationUpdate);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId });
      socket.off("location:update", handleLocationUpdate);
    };
  }, [bookingId]);

  // 2. Relative Timer Ticker
  useEffect(() => {
    if (!lastPingTimestamp) return;

    const updateTimer = () => {
      const diffSecs = Math.max(0, Math.floor((Date.now() - lastPingTimestamp) / 1000));
      if (diffSecs === 0) {
        setSecondsAgoText("Live • Updated just now");
      } else {
        setSecondsAgoText(`Live • Updated ${diffSecs}s ago`);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [lastPingTimestamp]);

  // 3. Compute OSRM Route & ETA for Provider Map
  useEffect(() => {
    if (!hasCustomerCoords || !providerCoords) return;

    let isMounted = true;

    async function fetchOsrmRoute() {
      try {
        const { lat: pLat, lng: pLng } = providerCoords!;
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${longitude},${latitude}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM route failed");

        const data = await res.json();
        if (!isMounted || !data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const distKm = (route.distance / 1000).toFixed(1);
        const durationMins = Math.ceil(route.duration / 60);

        setDistanceText(`${distKm} km (${durationMins} mins)`);
        setEtaBadgeText(`ETA: ${durationMins} min`);

        // Draw Route Polyline
        if (leafletMapRef.current && route.geometry && route.geometry.coordinates) {
          const L = (await import("leaflet")).default;
          const latLngs = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);

          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(latLngs);
          } else {
            routePolylineRef.current = L.polyline(latLngs, {
              color: "#2563eb",
              weight: 5,
              opacity: 0.85,
              dashArray: "8, 8"
            }).addTo(leafletMapRef.current);
          }
        }
      } catch (err) {
        console.warn("[ProviderMapView] OSRM Route fallback:", err);
      }
    }

    fetchOsrmRoute();
    const interval = setInterval(fetchOsrmRoute, 40000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasCustomerCoords, providerCoords, latitude, longitude]);

  // 4. Initialize Map Canvas
  useEffect(() => {
    if (!hasCustomerCoords || typeof window === "undefined" || !mapContainerRef.current) return;

    async function initMap() {
      const L = (await import("leaflet")).default;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const container = mapContainerRef.current;
      if (!container) return;

      if (!leafletMapRef.current) {
        const map = L.map(container, {
          center: [latitude!, longitude!],
          zoom: 15,
          zoomControl: true,
          dragging: true
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        leafletMapRef.current = map;
      }

      const map = leafletMapRef.current;

      // Customer Destination Marker (Red Pin)
      const customerIcon = L.divIcon({
        className: "customer-map-pin",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.3); border-radius: 50%; animation: ping 1.5s infinite;"></div>
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

      if (!customerMarkerRef.current) {
        customerMarkerRef.current = L.marker([latitude!, longitude!], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<b>${customerName || "Customer Address"}</b><br/>${address}`);
      }
    }

    initMap();
  }, [hasCustomerCoords, latitude, longitude, address, customerName]);

  // 5. Smooth Lerp Marker Movement & Rotation for Provider Position
  useEffect(() => {
    if (!providerCoords || typeof window === "undefined") return;

    let isMounted = true;

    async function updateProviderMarkerSmooth() {
      const L = (await import("leaflet")).default;
      const map = leafletMapRef.current;
      if (!map) return;

      const targetLat = providerCoords!.lat;
      const targetLng = providerCoords!.lng;

      const buildIconHtml = (deg: number, badge: string) => `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -100%); width: 130px;">
          <!-- Floating Map ETA Badge -->
          <div style="background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1.5px solid #3b82f6; box-shadow: 0 4px 14px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: ping 1.2s infinite; display: inline-block;"></span>
            <span>${badge}</span>
          </div>

          <!-- Directional Delivery Vehicle Marker Container -->
          <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 52px; height: 52px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: pulse 1.8s infinite;"></div>
            <div style="width: 42px; height: 42px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.5); transform: rotate(${deg}deg); transition: transform 0.4s ease;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="18" r="2.5" fill="#ffffff"/>
                <circle cx="18" cy="18" r="2.5" fill="#ffffff"/>
                <path d="M8.5 18h7"/>
                <path d="M6 15.5l2-8.5h5l2.5 5.5h2.5"/>
                <path d="M13 7l2 4"/>
                <rect x="3" y="9.5" width="5" height="5" rx="1" fill="#60a5fa" stroke="#ffffff" stroke-width="1.2"/>
              </svg>
            </div>
          </div>
        </div>
      `;

      const providerIcon = L.divIcon({
        className: "provider-dominos-pin",
        html: buildIconHtml(heading, etaBadgeText),
        iconSize: [120, 80],
        iconAnchor: [60, 80]
      });

      if (!providerMarkerRef.current) {
        providerMarkerRef.current = L.marker([targetLat, targetLng], { icon: providerIcon })
          .addTo(map)
          .bindPopup("<b>Your Live Position</b>");
        currentMarkerCoords.current = { lat: targetLat, lng: targetLng };

        if (hasCustomerCoords) {
          const bounds = L.latLngBounds(
            [latitude!, longitude!],
            [targetLat, targetLng]
          );
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
      } else {
        providerMarkerRef.current.setIcon(providerIcon);

        const startLat = currentMarkerCoords.current?.lat || targetLat;
        const startLng = currentMarkerCoords.current?.lng || targetLng;

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
  }, [providerCoords, heading, etaBadgeText, hasCustomerCoords, latitude, longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
        customerMarkerRef.current = null;
        providerMarkerRef.current = null;
        routePolylineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl space-y-0">
      {/* Map Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <Radio className="h-5 w-5 animate-pulse text-emerald-300" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm sm:text-base text-foreground leading-tight flex items-center gap-2">
              <span>Customer Destination & Navigation</span>
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              {distanceText} • {secondsAgoText}
            </p>
          </div>
        </div>

        {hasCustomerCoords && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Navigate in Google Maps</span>
          </a>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-900">
        {hasCustomerCoords ? (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-xs font-bold text-foreground">Destination coordinates pending</p>
            <p className="text-[11px] max-w-xs">{address}</p>
          </div>
        )}
      </div>

      {/* Delivery Instructions Footer */}
      {(landmark || instructions) && (
        <div className="p-4 bg-muted/30 border-t border-border/60 text-xs space-y-1.5">
          {landmark && (
            <p className="text-foreground">
              <strong className="text-amber-500">Landmark:</strong> {landmark}
            </p>
          )}
          {instructions && (
            <p className="text-foreground">
              <strong className="text-blue-500">Entry Instructions:</strong> {instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
