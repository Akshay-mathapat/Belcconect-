import { NextResponse } from "next/server";

interface CacheEntry {
  data: any;
  timestamp: number;
}

// In-memory cache for reverse-geocoded coordinates (1 hour TTL, max 2000 entries)
const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 2000;

// In-flight request deduplication
const inFlightRequests = new Map<string, Promise<any>>();

export async function GET(request: Request) {
  let lat = 0;
  let lng = 0;

  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: "Missing lat and lng parameters" }, { status: 400 });
    }

    lat = parseFloat(latStr);
    lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid lat/lng range" }, { status: 400 });
    }

    // Round to 4 decimal places (~11 meters resolution) to maximize cache hits
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // 1. Check in-memory cache
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // 2. In-flight request deduplication
    if (inFlightRequests.has(cacheKey)) {
      const data = await inFlightRequests.get(cacheKey);
      return NextResponse.json(data);
    }

    // 3. Execute lookup with upstream timeout
    const fetchPromise = (async () => {
      const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (googleKey) {
        try {
          const googleRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`,
            { signal: AbortSignal.timeout(3000) }
          );
          const googleData = await googleRes.json();
          if (googleData.status === "OK" && googleData.results.length > 0) {
            const top = googleData.results[0];
            let locality = "";
            let city = "";
            let state = "";
            let pincode = "";

            top.address_components.forEach((comp: any) => {
              if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) {
                locality = comp.long_name;
              }
              if (comp.types.includes("locality")) {
                city = comp.long_name;
              }
              if (comp.types.includes("administrative_area_level_1")) {
                state = comp.long_name;
              }
              if (comp.types.includes("postal_code")) {
                pincode = comp.long_name;
              }
            });

            return {
              success: true,
              provider: "google",
              address: top.formatted_address,
              placeId: top.place_id,
              locality: locality || city,
              city: city || locality || "Belagavi",
              state: state || "Karnataka",
              pincode,
              latitude: lat,
              longitude: lng
            };
          }
        } catch (err) {
          console.warn("Google Maps reverse geocode failed, falling back to OSM Nominatim:", err);
        }
      }

      // Fallback: OpenStreetMap Nominatim reverse geocoding API with 3s timeout
      try {
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          {
            headers: {
              "User-Agent": "BelConnect-LocationService/2.0 (support@belconnect.in)"
            },
            signal: AbortSignal.timeout(3000)
          }
        );

        if (osmRes.ok) {
          const osmData = await osmRes.json();
          const addr = osmData.address || {};

          const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || "";
          const city = addr.city || addr.town || addr.village || addr.county || "Belagavi";
          const state = addr.state || "Karnataka";
          const pincode = addr.postcode || "";
          const buildingName = addr.building || addr.amenity || addr.historic || "";

          const parts = [buildingName, locality, city, state, pincode].filter(Boolean);
          const formatted = osmData.display_name || parts.join(", ");

          return {
            success: true,
            provider: "openstreetmap",
            address: formatted,
            placeId: osmData.place_id ? `osm-${osmData.place_id}` : null,
            buildingName,
            locality: locality || city,
            city,
            state,
            pincode,
            latitude: lat,
            longitude: lng
          };
        }
      } catch (osmErr) {
        // Fall through to graceful coordinate preservation
      }

      // If both upstream providers are unavailable or rate-limited:
      // Preserve coordinates and return clear fallback state without fabricating misleading address
      return {
        success: true,
        unavailable: true,
        address: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        city: "Belagavi",
        state: "Karnataka",
        latitude: lat,
        longitude: lng
      };
    })();

    inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const resultData = await fetchPromise;

      // Cache result and manage cache size
      if (geocodeCache.size >= MAX_CACHE_SIZE) {
        const firstKey = geocodeCache.keys().next().value;
        if (firstKey) geocodeCache.delete(firstKey);
      }
      geocodeCache.set(cacheKey, { data: resultData, timestamp: Date.now() });

      return NextResponse.json(resultData);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  } catch (error: any) {
    console.error("Reverse geocoding error:", error?.message || error);
    return NextResponse.json({
      success: true,
      unavailable: true,
      address: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: "Belagavi",
      state: "Karnataka",
      latitude: lat,
      longitude: lng
    });
  }
}
