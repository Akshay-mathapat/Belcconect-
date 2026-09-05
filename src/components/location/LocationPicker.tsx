"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Home,
  Building,
  Layers,
  Sparkles,
  Search,
  X,
  Info,
  Loader2
} from "lucide-react";

export interface ConfirmedLocationData {
  type: string; // 'Home' | 'Office' | 'Other'
  text: string;
  latitude: number;
  longitude: number;
  placeId?: string | null;
  locationAccuracy?: number | null;
  houseNumber?: string;
  buildingName?: string;
  floor?: string;
  landmark?: string;
  locality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  deliveryInstructions?: string;
}

interface LocationPickerProps {
  onConfirm: (location: ConfirmedLocationData) => void;
  onCancel?: () => void;
  initialLocation?: Partial<ConfirmedLocationData>;
}

// Default center: Belagavi, Karnataka
const DEFAULT_LAT = 15.8497;
const DEFAULT_LNG = 74.4977;

export default function LocationPicker({ onConfirm, onCancel, initialLocation }: LocationPickerProps) {
  // Coordinates State
  const [lat, setLat] = useState<number>(initialLocation?.latitude || DEFAULT_LAT);
  const [lng, setLng] = useState<number>(initialLocation?.longitude || DEFAULT_LNG);
  const [accuracy, setAccuracy] = useState<number | null>(initialLocation?.locationAccuracy || null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Address Fields State
  const [addressType, setAddressType] = useState<string>(initialLocation?.type || "Home");
  const [houseNumber, setHouseNumber] = useState<string>(initialLocation?.houseNumber || "");
  const [buildingName, setBuildingName] = useState<string>(initialLocation?.buildingName || "");
  const [floor, setFloor] = useState<string>(initialLocation?.floor || "");
  const [landmark, setLandmark] = useState<string>(initialLocation?.landmark || "");
  const [locality, setLocality] = useState<string>(initialLocation?.locality || "");
  const [city, setCity] = useState<string>(initialLocation?.city || "Belagavi");
  const [state, setState] = useState<string>(initialLocation?.state || "Karnataka");
  const [pincode, setPincode] = useState<string>(initialLocation?.pincode || "");
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>(initialLocation?.deliveryInstructions || "");

  // Reverse Geocoding & Map state
  const [reverseGeocodedAddr, setReverseGeocodedAddr] = useState<string>("");
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapTileType, setMapTileType] = useState<"street" | "satellite">("street");
  const [placeId, setPlaceId] = useState<string | null>(initialLocation?.placeId || null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize client-side Leaflet Map
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function initLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = (await import("leaflet")).default;

      // Fix default Leaflet icon paths in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Ensure leaflet CSS link element is present
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (leafletMapRef.current) {
        try {
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }
          leafletMapRef.current.off();
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
      }

      const mapContainer = mapContainerRef.current;
      const map = L.map(mapContainer, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true
      });

      leafletMapRef.current = map;

      // Set initial Tile Layer
      const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });

      const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
      });

      if (mapTileType === "satellite") {
        satelliteLayer.addTo(map);
      } else {
        streetLayer.addTo(map);
      }

      // Custom Red Pin Icon
      const pinIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 36px; height: 36px; background: #dc2626; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
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

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: pinIcon
      }).addTo(map);

      markerRef.current = marker;

      // Handle marker drag end
      marker.on("dragend", (e: any) => {
        const position = marker.getLatLng();
        if (isMounted) {
          setLat(position.lat);
          setLng(position.lng);
          triggerReverseGeocode(position.lat, position.lng);
        }
      });

      // Handle map click
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        if (isMounted) {
          setLat(clickLat);
          setLng(clickLng);
          triggerReverseGeocode(clickLat, clickLng);
        }
      });

      // Invalidate map size after container settles in modal
      setTimeout(() => {
        if (isMounted && leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      }, 300);

      // Attach ResizeObserver to keep tile layout synced on container resize/animation
      if (typeof ResizeObserver !== "undefined" && mapContainer) {
        resizeObserver = new ResizeObserver(() => {
          if (isMounted && leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainer);
      }

      // Initial Reverse Geocode
      triggerReverseGeocode(lat, lng);
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (leafletMapRef.current) {
        try {
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }
          leafletMapRef.current.off();
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update map tile layer when mapTileType changes
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      map.eachLayer((layer: any) => {
        if (layer.options && layer.options.attribution) {
          map.removeLayer(layer);
        }
      });

      if (mapTileType === "satellite") {
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri"
        }).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
      }
    });
  }, [mapTileType]);

  // Update map view & marker when lat/lng state changes programmatically
  const updateMapPosition = (newLat: number, newLng: number) => {
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([newLat, newLng], 17);
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }
  };

  // Reverse Geocoding call
  const triggerReverseGeocode = async (targetLat: number, targetLng: number) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(`/api/location/reverse-geocode?lat=${targetLat}&lng=${targetLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReverseGeocodedAddr(data.address || "");
          if (data.locality) setLocality(data.locality);
          if (data.city) setCity(data.city);
          if (data.state) setState(data.state);
          if (data.pincode) setPincode(data.pincode);
          if (data.buildingName && !buildingName) setBuildingName(data.buildingName);
          if (data.placeId) setPlaceId(data.placeId);
        }
      }
    } catch (e) {
      console.error("Reverse geocode error:", e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Request HTML5 Geolocation
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        setLat(newLat);
        setLng(newLng);
        setAccuracy(acc);
        setIsGpsLoading(false);

        updateMapPosition(newLat, newLng);
        triggerReverseGeocode(newLat, newLng);
      },
      (err) => {
        setIsGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Location permission denied. Please enable GPS permissions in browser address bar or drag the map pin to your location.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("GPS position unavailable. Please drag the pin on the map.");
        } else {
          setGpsError("GPS request timed out. Drag map pin to select building.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts = [
      houseNumber ? `Flat/House ${houseNumber}` : null,
      buildingName,
      floor ? `Floor ${floor}` : null,
      locality,
      landmark ? `Near ${landmark}` : null,
      city,
      state,
      pincode
    ].filter(Boolean);

    const fullText = parts.length > 0 ? parts.join(", ") : (reverseGeocodedAddr || "Pinned Location");

    const payload: ConfirmedLocationData = {
      type: addressType,
      text: fullText,
      latitude: lat,
      longitude: lng,
      placeId,
      locationAccuracy: accuracy,
      houseNumber: houseNumber.trim() || undefined,
      buildingName: buildingName.trim() || undefined,
      floor: floor.trim() || undefined,
      landmark: landmark.trim() || undefined,
      locality: locality.trim() || undefined,
      city: city.trim() || "Belagavi",
      state: state.trim() || "Karnataka",
      pincode: pincode.trim() || undefined,
      deliveryInstructions: deliveryInstructions.trim() || undefined
    };

    onConfirm(payload);
  };

  return (
    <div data-location-modal-open="true" className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Select Service Location</h3>
            <p className="text-xs text-muted-foreground">Drag pin on map to your exact entrance or building</p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Map Section */}
      <div className="relative w-full h-[280px] sm:h-[320px] bg-slate-200 dark:bg-slate-800">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Map Controls Floating Overlay */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          {/* Tile Layer Toggle */}
          <button
            type="button"
            onClick={() => setMapTileType((prev) => (prev === "street" ? "satellite" : "street"))}
            className="px-3 py-1.5 rounded-xl bg-background/90 dark:bg-slate-900/90 border border-border/80 text-foreground text-xs font-bold shadow-md hover:bg-background transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            {mapTileType === "street" ? "Satellite" : "Street"}
          </button>
        </div>

        {/* Floating GPS Button */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isGpsLoading}
            className="pointer-events-auto px-4 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-xs shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-blue-400/30"
          >
            {isGpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            <span>{isGpsLoading ? "Locating GPS..." : "📍 Use My Current Location"}</span>
          </button>

          {accuracy !== null && (
            <span className="pointer-events-auto px-2.5 py-1 rounded-xl bg-background/90 dark:bg-slate-900/90 text-foreground text-[10px] font-bold border border-border shadow-md backdrop-blur-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Accurate (~{Math.round(accuracy)}m)
            </span>
          )}
        </div>
      </div>

      {/* GPS Warning Banner if any */}
      {gpsError && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2 px-4 sm:px-6">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Low accuracy notice */}
      {accuracy !== null && accuracy > 100 && (
        <div className="p-2.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-2 px-4 sm:px-6">
          <Info className="w-4 h-4 shrink-0 text-blue-500" />
          <span>GPS position accuracy is wide (~{Math.round(accuracy)}m). Please drag the map pin to your specific building.</span>
        </div>
      )}

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[50vh] overflow-y-auto">
        {/* Address Category Tag */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Save Address As
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "Home", label: "Home", icon: Home },
              { id: "Office", label: "Office", icon: Building },
              { id: "Other", label: "Other", icon: MapPin }
            ].map((item) => {
              const IconComp = item.icon;
              const isSelected = addressType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAddressType(item.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                      : "bg-muted/30 border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detected Locality / Reverse Geocoded Box */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Pinned Location Coordinates</span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
          <p className="text-xs text-foreground font-medium line-clamp-2">
            {isReverseGeocoding ? "Detecting area & street name..." : reverseGeocodedAddr || "Belagavi, Karnataka"}
          </p>
        </div>

        {/* Structured Address Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Flat / House / Shop No. <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="e.g. Flat 302 / House #45"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Building / Apartment Name
            </label>
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="e.g. Royal Heights / Plot 12"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Floor / Unit (Optional)
            </label>
            <input
              type="text"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g. 3rd Floor"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Nearby Landmark
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Tilakwadi Post Office"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Locality
            </label>
            <input
              type="text"
              required
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="e.g. Tilakwadi"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              City
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Belagavi"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              PIN Code
            </label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="590006"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Service Instructions for Provider (Optional)
          </label>
          <input
            type="text"
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="e.g. Ring doorbell 2 times, gate is open, park bike near stairs"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/60">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-600/25 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Save Location</span>
          </button>
        </div>
      </form>
    </div>
  );
}
