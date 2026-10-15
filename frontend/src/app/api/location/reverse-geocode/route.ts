import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/jwt";
import { checkIpRateLimit, checkUserRateLimit } from "@/lib/rateLimit";
import { getMapsProvider } from "@/lib/maps/mapService";

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
    // 0. Authentication: Login is strictly required
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 0b. Rate Limiting: Per-IP and Per-User rate limits
    const ipRate = await checkIpRateLimit(request, 120, 60);
    if (!ipRate.isAllowed) {
      return NextResponse.json(
        { error: "Too many requests from this IP. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipRate.retryAfter || 60),
            "X-RateLimit-Limit": "120",
            "X-RateLimit-Remaining": "0"
          }
        }
      );
    }

    const userRate = await checkUserRateLimit(authUser.userId, 60, 60);
    if (!userRate.isAllowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(userRate.retryAfter || 60),
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0"
          }
        }
      );
    }

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
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "private, max-age=3600" }
      });
    }

    // 2. In-flight request deduplication
    if (inFlightRequests.has(cacheKey)) {
      const data = await inFlightRequests.get(cacheKey);
      return NextResponse.json(data);
    }

    // 3. Execute lookup with upstream timeout
    const fetchPromise = (async () => {
      const mapsProvider = getMapsProvider();
      const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      // Primary: Google Maps Platform Geocoding API
      if ((mapsProvider === "google" || !mapsProvider) && googleKey) {
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
              fallback: false,
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
          console.warn("[Reverse-Geocode] Google Maps Geocoding failed:", err);
        }
      }

      // Fallback: OpenStreetMap Nominatim reverse geocoding API ONLY allowed in dev/test
      if (mapsProvider === "osm" && process.env.NODE_ENV !== "production") {
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
              headers: {
                "User-Agent": "BelConnect-Dev/1.0 (dev-testing@belconnect.in)"
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
              provider: "osm",
              fallback: false,
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
      }

      // Offline / Degraded Fallback:
      // When upstream providers are unavailable or in production without Google key,
      // preserve coordinates and return clear fallback state without blank UI or misleading address.
      return {
        success: true,
        fallback: true,
        unavailable: true,
        provider: "fallback",
        address: `Belagavi, Karnataka (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
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

      return NextResponse.json(resultData, {
        headers: { "Cache-Control": "private, max-age=3600" }
      });
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
