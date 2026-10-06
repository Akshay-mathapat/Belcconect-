"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation, Compass, AlertCircle, Info, Radio, Clock, ExternalLink, ShieldCheck } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const customerLiveMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const initialProvValid = isValidCoord(providerLatitude, providerLongitude);

  // Position & Orientation State
  const [providerCoords, setProviderCoords] = useState<{ lat: number; lng: number } | null>(
    initialProvValid
      ? { lat: Number(providerLatitude), lng: Number(providerLongitude) }
      : null
  );
  const [heading, setHeading] = useState<number>(0);

  // Metrics State
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routeAvailable, setRouteAvailable] = useState<boolean>(true);
  
  // Real-Time Pulse Relative Timer & Freshness
  const [lastPingTimestamp, setLastPingTimestamp] = useState<number | null>(null);
  const [freshnessStatus, setFreshnessStatus] = useState<"live" | "updating" | "unavailable">("live");
  const [secsAgo, setSecsAgo] = useState<number>(0);

  const currentMarkerCoords = useRef<{ lat: number; lng: number } | null>(
    initialProvValid
      ? { lat: Number(providerLatitude), lng: Number(providerLongitude) }
      : null
  );

  const hasCustomerCoords = isValidCoord(latitude, longitude);

  // Update providerCoords when props change (fallback or initial load)
  useEffect(() => {
    if (isValidCoord(providerLatitude, providerLongitude)) {
      setProviderCoords({ lat: Number(providerLatitude), lng: Number(providerLongitude) });
    }
  }, [providerLatitude, providerLongitude]);

  // Customer Live Coords State
  const [customerLiveCoords, setCustomerLiveCoords] = useState<{ lat: number; lng: number } | null>(
    hasCustomerCoords ? { lat: Number(latitude), lng: Number(longitude) } : null
  );

  // 1. Subscribe to Socket.IO Room for Synchronized Event Streaming (with auto-reconnect)
  useEffect(() => {
    if (!bookingId) return;

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
        setProviderCoords({ lat: newLat, lng: newLng });
        if (typeof data.heading === "number" && Number.isFinite(data.heading)) {
          setHeading(data.heading);
        }
        const parsedTs = Number(data.timestamp);
        const ts = Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : Date.now();
        setLastPingTimestamp(ts);
      }
    };

    const handleCustomerLocationUpdate = (data: any) => {
      if (data && data.bookingId === bookingId && isValidCoord(data.latitude, data.longitude)) {
        const cLat = Number(data.latitude);
        const cLng = Number(data.longitude);
        setCustomerLiveCoords({ lat: cLat, lng: cLng });
        const parsedTs = Number(data.timestamp);
        const ts = Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : Date.now();
        setLastPingTimestamp(ts);
      }
    };

    socket.on("provider:location:update", handleLocationUpdate);
    socket.on("customer:location:update", handleCustomerLocationUpdate);

    return () => {
      socket.off("connect", subscribeRoom);
      socket.emit("booking:unsubscribe", { bookingId });
      socket.off("provider:location:update", handleLocationUpdate);
      socket.off("customer:location:update", handleCustomerLocationUpdate);
    };
  }, [bookingId]);

  // 2. Relative Freshness Timer Ticker
  useEffect(() => {
    const updateFreshness = () => {
      if (!lastPingTimestamp) {
        setFreshnessStatus("live");
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

  // 3. Compute OSRM Route & ETA for Provider Map
  useEffect(() => {
    if (!hasCustomerCoords || !providerCoords) return;

    let isMounted = true;

    async function fetchOsrmRoute() {
      try {
        const { lat: pLat, lng: pLng } = providerCoords!;
        const cLat = Number(latitude);
        const cLng = Number(longitude);
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${cLng},${cLat}?overview=full&geometries=geojson`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("OSRM route failed");

        const data = await res.json();
        if (!isMounted || !data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const distKmVal = Number((route.distance / 1000).toFixed(1));
        const durationMinsVal = Math.ceil(route.duration / 60);

        setDistanceKm(distKmVal);
        setEtaMins(durationMinsVal);
        setRouteAvailable(true);

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
              opacity: 0.85
            }).addTo(leafletMapRef.current);
          }
        }
      } catch (err) {
        console.warn("[ProviderMapView] OSRM Route fallback:", err);
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
    const interval = setInterval(fetchOsrmRoute, 35000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasCustomerCoords, providerCoords, latitude, longitude]);

  const canShowMap = hasCustomerCoords || providerCoords !== null || customerLiveCoords !== null;

  // 4. Initialize Map Canvas & Customer / Destination Markers with < 25m Decluttering
  useEffect(() => {
    if (!canShowMap || typeof window === "undefined" || !mapContainerRef.current) return;

    async function initMap() {
      const L = (await import("leaflet")).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const container = mapContainerRef.current;
      if (!container) return;

      const destLat = hasCustomerCoords ? Number(latitude) : (providerCoords ? providerCoords.lat : 0);
      const destLng = hasCustomerCoords ? Number(longitude) : (providerCoords ? providerCoords.lng : 0);

      if (!leafletMapRef.current) {
        const map = L.map(container, {
          center: [destLat, destLng],
          zoom: 15,
          zoomControl: false,
          dragging: true
        });

        // Position zoom controls at top-right to prevent collision
        L.control.zoom({ position: "topright" }).addTo(map);

        L.tileLayer("/api/map-tile/osm/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        leafletMapRef.current = map;

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

      // Check distance between customer live location and service spot to declutter overlapping markers
      let isOverlap = false;
      if (customerLiveCoords) {
        const dMeters = getDistanceMeters(customerLiveCoords.lat, customerLiveCoords.lng, destLat, destLng);
        if (dMeters < 25) {
          isOverlap = true;
        }
      }

      // 1. Service Destination Marker (Only if customer pinned location coords exist)
      if (hasCustomerCoords) {
        const destIcon = L.divIcon({
          className: "service-dest-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 90px;">
              <div style="background: #ef4444; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid #ffffff; white-space: nowrap; margin-bottom: 2px;">
                📍 ${isOverlap ? t("location.customerIsHere") : t("location.serviceSpot")}
              </div>
              <div style="width: 32px; height: 32px; background: #ef4444; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
            </div>
          `,
          iconSize: [90, 50],
          iconAnchor: [45, 34]
        });

        if (!destMarkerRef.current) {
          destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon })
            .addTo(map)
            .bindPopup(`<b>${customerName || "Customer Spot"}</b><br/>${address}`);
        } else {
          destMarkerRef.current.setIcon(destIcon);
        }
      } else if (destMarkerRef.current) {
        try {
          map.removeLayer(destMarkerRef.current);
          destMarkerRef.current = null;
        } catch (e) {}
      }

      // 2. Customer Live Moving GPS Marker (Render separately ONLY if NOT overlapping < 25m)
      if (customerLiveCoords && !isOverlap) {
        const liveCustomerIcon = L.divIcon({
          className: "customer-live-gps-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 95px;">
              <div style="background: #10b981; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; border: 1px solid #ffffff; white-space: nowrap; margin-bottom: 2px; display: flex; align-items: center; gap: 3px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff; animation: ping 1s infinite;"></span>
                <span>🔴 ${t("location.customerLive")}</span>
              </div>
              <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 42px; height: 42px; background: rgba(16, 185, 129, 0.4); border-radius: 50%; animation: ping 1.5s infinite;"></div>
                <div style="width: 32px; height: 32px; background: #059669; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
              </div>
            </div>
          `,
          iconSize: [95, 55],
          iconAnchor: [47.5, 36]
        });

        if (!customerLiveMarkerRef.current) {
          customerLiveMarkerRef.current = L.marker([customerLiveCoords.lat, customerLiveCoords.lng], { icon: liveCustomerIcon })
            .addTo(map)
            .bindPopup(`<b>${customerName || "Customer"} (${t("location.customerLive")})</b>`);
        } else {
          customerLiveMarkerRef.current.setLatLng([customerLiveCoords.lat, customerLiveCoords.lng]);
          customerLiveMarkerRef.current.setIcon(liveCustomerIcon);
        }
      } else if (isOverlap && customerLiveMarkerRef.current) {
        try {
          map.removeLayer(customerLiveMarkerRef.current);
          customerLiveMarkerRef.current = null;
        } catch (e) {}
      }
    }

    initMap();
  }, [hasCustomerCoords, latitude, longitude, address, customerName, customerLiveCoords, t]);

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

      const badgeText = etaMins !== null
        ? t("location.estimatedEta", { eta: etaMins })
        : t("location.navigationActive");

      const buildIconHtml = (deg: number, badge: string) => `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 130px;">
          <!-- Floating Map ETA Badge -->
          <div style="background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1.5px solid #3b82f6; box-shadow: 0 4px 14px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: ping 1.2s infinite; display: inline-block;"></span>
            <span>${badge}</span>
          </div>

          <!-- Two-Wheeler Vehicle Marker Container -->
          <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 52px; height: 52px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: pulse 1.8s infinite;"></div>
            <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.5); transform: rotate(${deg}deg); transition: transform 0.4s ease;">
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

      const providerIcon = L.divIcon({
        className: "provider-gps-pin",
        html: buildIconHtml(heading, badgeText),
        iconSize: [130, 80],
        iconAnchor: [65, 56]
      });

      if (!providerMarkerRef.current) {
        providerMarkerRef.current = L.marker([targetLat, targetLng], { icon: providerIcon })
          .addTo(map)
          .bindPopup(`<b>${t("location.you")}</b>`);
        currentMarkerCoords.current = { lat: targetLat, lng: targetLng };

        if (hasCustomerCoords) {
          const bounds = L.latLngBounds(
            [Number(latitude), Number(longitude)],
            [targetLat, targetLng]
          );
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        } else {
          map.setView([targetLat, targetLng], 15);
        }
      } else {
        providerMarkerRef.current.setIcon(providerIcon);

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
  }, [providerCoords, heading, etaMins, hasCustomerCoords, latitude, longitude, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        try {
          if (providerMarkerRef.current) {
            providerMarkerRef.current.remove();
            providerMarkerRef.current = null;
          }
          if (destMarkerRef.current) {
            destMarkerRef.current.remove();
            destMarkerRef.current = null;
          }
          if (customerLiveMarkerRef.current) {
            customerLiveMarkerRef.current.remove();
            customerLiveMarkerRef.current = null;
          }
          if (routePolylineRef.current) {
            routePolylineRef.current.remove();
            routePolylineRef.current = null;
          }
          leafletMapRef.current.off();
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
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
            <h3 className="font-heading font-extrabold text-sm sm:text-base text-white leading-tight flex items-center gap-2">
              <span>{t("location.customerDestination")}</span>
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              {distanceKm !== null ? `${distanceKm} km (${etaMins || 0} mins)` : t("location.routeUnavailable")}
              {customerLiveCoords && ` • ${t("location.customerLiveAvailable")}`}
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
            <span className="hidden sm:inline">{t("location.navigateGoogleMaps")}</span>
          </a>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-900">
        {canShowMap ? (
          <>
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            {(providerCoords || hasCustomerCoords) && (
              <button
                type="button"
                onClick={async () => {
                  if (leafletMapRef.current) {
                    const L = (await import("leaflet")).default;
                    const points: [number, number][] = [];
                    if (hasCustomerCoords) points.push([Number(latitude), Number(longitude)]);
                    if (providerCoords) points.push([providerCoords.lat, providerCoords.lng]);
                    if (customerLiveCoords) points.push([customerLiveCoords.lat, customerLiveCoords.lng]);
                    if (points.length > 1) {
                      const bounds = L.latLngBounds(points);
                      leafletMapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
                    } else if (points.length === 1) {
                      leafletMapRef.current.setView(points[0], 15);
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
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-xs font-bold text-foreground">{t("location.destinationUnavailable")}</p>
            <p className="text-[11px] max-w-xs">{address}</p>
          </div>
        )}
      </div>

      {/* Delivery Instructions Footer */}
      {(landmark || instructions) && (
        <div className="p-4 bg-muted/30 border-t border-border/60 text-xs space-y-1.5">
          {landmark && (
            <p className="text-foreground">
              <strong className="text-amber-500">{t("location.landmark")}:</strong> {landmark}
            </p>
          )}
          {instructions && (
            <p className="text-foreground">
              <strong className="text-blue-500">{t("location.instructions")}:</strong> {instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

