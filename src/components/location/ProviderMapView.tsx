"use client";

import React, { useEffect, useRef } from "react";
import { MapPin, Navigation, Compass, AlertCircle, Phone, Info } from "lucide-react";

interface ProviderMapViewProps {
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  landmark?: string | null;
  instructions?: string | null;
  customerName?: string;
  customerPhone?: string;
}

export default function ProviderMapView({
  latitude,
  longitude,
  address,
  landmark,
  instructions,
  customerName,
  customerPhone
}: ProviderMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  useEffect(() => {
    if (!hasCoordinates || typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = (await import("leaflet")).default;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const container = mapContainerRef.current;
      if (!container) return;

      const map = L.map(container, {
        center: [latitude!, longitude!],
        zoom: 16,
        zoomControl: true,
        dragging: true
      });

      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "provider-map-pin",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(37, 99, 235, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 36px; height: 36px; background: #2563eb; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
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

      const marker = L.marker([latitude!, longitude!], { icon: pinIcon }).addTo(map);
      marker.bindPopup(`<b>${customerName || "Customer Location"}</b><br/>${address}`).openPopup();
    }

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
      }
    };
  }, [hasCoordinates, latitude, longitude, address, customerName]);

  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md flex flex-col">
      {/* Map Header / Title */}
      <div className="p-4 bg-muted/30 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
          <h4 className="text-sm font-bold text-foreground">Customer Destination</h4>
        </div>
        {hasCoordinates ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
            <Compass className="w-3 h-3" /> Exact GPS Pin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
            <AlertCircle className="w-3 h-3" /> Text Address
          </span>
        )}
      </div>

      {/* Map Box */}
      <div className="relative w-full h-[220px] bg-slate-200 dark:bg-slate-800">
        {hasCoordinates ? (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <MapPin className="w-8 h-8 text-blue-600 mb-2 animate-bounce" />
            <p className="text-xs font-semibold text-foreground max-w-xs">{address}</p>
          </div>
        )}
      </div>

      {/* Address & Navigation Details Footer */}
      <div className="p-4 sm:p-5 space-y-3 bg-card">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
            Confirmed Address
          </span>
          <p className="text-sm font-bold text-foreground leading-snug">{address}</p>
        </div>

        {landmark && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Landmark: <strong>{landmark}</strong></span>
          </div>
        )}

        {instructions && (
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-500" />
            <span>Instructions: <strong>{instructions}</strong></span>
          </div>
        )}

        {/* Turn-by-Turn Navigation Button */}
        <div className="pt-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>🧭 Navigate to Customer (Google Maps)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
