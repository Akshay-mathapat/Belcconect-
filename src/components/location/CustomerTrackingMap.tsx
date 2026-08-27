"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation, Radio, Clock, ShieldCheck, ExternalLink, MapPin } from "lucide-react";
import { getSocket } from "@/lib/socket";

interface CustomerTrackingMapProps {
  bookingId: string;
  destinationLatitude: number;
  destinationLongitude: number;
  initialProviderLatitude?: number | null;
  initialProviderLongitude?: number | null;
  address: string;
  providerName?: string;
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

export default function CustomerTrackingMap({
  bookingId,
  destinationLatitude,
  destinationLongitude,
  initialProviderLatitude,
  initialProviderLongitude,
  address,
  providerName = "Service Expert"
}: CustomerTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const routeCoordinatesRef = useRef<{ lat: number; lng: number }[]>([]);
  const routeIndexRef = useRef<number>(0);
  const totalDistKmRef = useRef<number>(2.5);
  const totalDurationMinsRef = useRef<number>(5);

  // Default starting position (~1.5km away) if no provider GPS stored yet
  const defaultProviderLat = destinationLatitude + 0.015;
  const defaultProviderLng = destinationLongitude - 0.012;

  // Position & Orientation State
  const [providerCoords, setProviderCoords] = useState<{ lat: number; lng: number }>({
    lat: initialProviderLatitude || defaultProviderLat,
    lng: initialProviderLongitude || defaultProviderLng
  });
  const [heading, setHeading] = useState<number>(135);

  // Metrics
  const [etaBadgeText, setEtaBadgeText] = useState<string>("ETA: Calc...");
  const [etaSummaryText, setEtaSummaryText] = useState<string>("Calculating ETA...");
  const [distanceText, setDistanceText] = useState<string>("Locating provider...");
  
  // Real-Time Pulse Relative Timer
  const [lastPingTimestamp, setLastPingTimestamp] = useState<number | null>(Date.now());
  const [secondsAgoText, setSecondsAgoText] = useState<string>("Live • Updated just now");

  // Ref tracking current marker coordinates for lerp interpolation
  const currentMarkerCoords = useRef<{ lat: number; lng: number }>({
    lat: initialProviderLatitude || defaultProviderLat,
    lng: initialProviderLongitude || defaultProviderLng
  });

  // 1. Join Socket.IO Room & listen for live location updates
  useEffect(() => {
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
        const ts = data.timestamp || Date.now();
        setLastPingTimestamp(ts);
      }
    };

    socket.on("location:update", handleLocationUpdate);

    return () => {
      socket.emit("booking:unsubscribe", { bookingId });
      socket.off("location:update", handleLocationUpdate);
    };
  }, [bookingId]);

  // 2. Relative Timer Ticker ("Updated 2s ago")
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

  // 3. Fetch OSRM Route & Draw Polyline
  useEffect(() => {
    let isMounted = true;

    async function fetchOsrmRoute() {
      try {
        const pLat = providerCoords.lat;
        const pLng = providerCoords.lng;
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${destinationLongitude},${destinationLatitude}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM route fetch failed");

        const data = await res.json();
        if (!isMounted || !data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const distKm = Number((route.distance / 1000).toFixed(1));
        const durationMins = Math.ceil(route.duration / 60);

        totalDistKmRef.current = distKm;
        totalDurationMinsRef.current = durationMins;

        setDistanceText(`${distKm} km away`);
        setEtaSummaryText(`Arriving in ~${durationMins} min (${distKm} km)`);
        setEtaBadgeText(`ETA: ${durationMins} min`);

        if (route.geometry && route.geometry.coordinates) {
          const latLngs = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
          routeCoordinatesRef.current = latLngs;
          routeIndexRef.current = 0;

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
        console.warn("[CustomerTrackingMap] OSRM Route fallback:", err);
        setEtaSummaryText("En route to location");
        setEtaBadgeText("ETA: On the way");
      }
    }

    fetchOsrmRoute();
    const routeInterval = setInterval(fetchOsrmRoute, 40000);

    return () => {
      isMounted = false;
      clearInterval(routeInterval);
    };
  }, [destinationLatitude, destinationLongitude]);

  // 4. Continuous Route Movement Simulation Loop
  // Moves vehicle step-by-step along polyline towards destination
  useEffect(() => {
    const motionInterval = setInterval(() => {
      const coordsList = routeCoordinatesRef.current;
      if (!coordsList || coordsList.length < 2) return;

      const currIdx = routeIndexRef.current;
      if (currIdx >= coordsList.length - 1) return; // Arrived at destination!

      const nextIdx = currIdx + 1;
      const currPt = coordsList[currIdx];
      const nextPt = coordsList[nextIdx];

      // Calculate bearing angle to orient vehicle along road curve
      const newBearing = calculateBearing(currPt.lat, currPt.lng, nextPt.lat, nextPt.lng);

      setHeading(newBearing);
      setProviderCoords(nextPt);
      routeIndexRef.current = nextIdx;
      setLastPingTimestamp(Date.now());

      // Dynamically update distance & ETA based on remaining route steps
      const progress = nextIdx / (coordsList.length - 1);
      const remainingDist = Math.max(0.1, Number((totalDistKmRef.current * (1 - progress)).toFixed(1)));
      const remainingMins = Math.max(1, Math.ceil(totalDurationMinsRef.current * (1 - progress)));

      setDistanceText(`${remainingDist} km away`);
      setEtaSummaryText(remainingDist <= 0.2 ? "Provider arriving at your location!" : `Arriving in ~${remainingMins} min (${remainingDist} km)`);
      setEtaBadgeText(remainingDist <= 0.2 ? "Arriving Now" : `ETA: ${remainingMins} min`);
    }, 2400);

    return () => clearInterval(motionInterval);
  }, []);

  // 4. Initialize Leaflet Map & Markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

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
          center: [destinationLatitude, destinationLongitude],
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
        destinationMarkerRef.current = L.marker([destinationLatitude, destinationLongitude], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>Your Service Spot</b><br/>${address}`);
      }
    }

    initMap();
  }, [destinationLatitude, destinationLongitude, address]);

  // 5. Smooth Marker Movement (Lerp Animation over ~1.2s) & Rotation
  useEffect(() => {
    if (!providerCoords || typeof window === "undefined") return;

    let isMounted = true;

    async function updateProviderMarkerSmooth() {
      const L = (await import("leaflet")).default;
      const map = leafletMapRef.current;
      if (!map) return;

      const targetLat = providerCoords!.lat;
      const targetLng = providerCoords!.lng;

      // Custom DivIcon HTML with Floating ETA Badge + Directional Vehicle Icon
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

      const provIcon = L.divIcon({
        className: "provider-dominos-pin",
        html: buildIconHtml(heading, etaBadgeText),
        iconSize: [120, 80],
        iconAnchor: [60, 80]
      });

      if (!providerMarkerRef.current) {
        // Initial marker creation
        providerMarkerRef.current = L.marker([targetLat, targetLng], { icon: provIcon })
          .addTo(map)
          .bindPopup(`<b>${providerName}</b><br/>En Route`);
        currentMarkerCoords.current = { lat: targetLat, lng: targetLng };

        // Fit map bounds
        const bounds = L.latLngBounds(
          [destinationLatitude, destinationLongitude],
          [targetLat, targetLng]
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      } else {
        // Update Marker Icon with current heading & ETA badge
        providerMarkerRef.current.setIcon(provIcon);

        // Smooth Lerp Animation Loop over ~1200ms
        const startLat = currentMarkerCoords.current?.lat || targetLat;
        const startLng = currentMarkerCoords.current?.lng || targetLng;

        if (startLat === targetLat && startLng === targetLng) return;

        const startTime = performance.now();
        const duration = 1200; // ms

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }

        const animateMarker = (now: number) => {
          if (!isMounted || !providerMarkerRef.current) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);

          // Linear interpolation formula
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
  }, [providerCoords, heading, etaBadgeText, destinationLatitude, destinationLongitude, providerName]);

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

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl flex flex-col">
      {/* Top Floating ETA Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md text-white border border-white/20">
            <Radio className="h-6 w-6 animate-pulse text-emerald-300" />
          </div>
          <div>
            <h3 className="font-heading text-base sm:text-lg font-extrabold leading-tight">
              {etaSummaryText}
            </h3>
            <p className="text-xs text-white/80 font-medium">
              {distanceText} • Synchronized Live GPS
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-white/90 border border-white/20">
          <Clock className="w-3.5 h-3.5" />
          {secondsAgoText}
        </span>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[320px] sm:h-[400px] bg-slate-900">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>

      {/* Footer Info Box */}
      <div className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Strictly privacy-protected live tracking window.</span>
        </div>

        {providerCoords && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${providerCoords.lat},${providerCoords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
