import { NextResponse } from "next/server";
import {
  getMapsProvider,
  getRouteCacheKey,
  getCachedRoute,
  setCachedRoute,
  decodeGooglePolyline,
  computeFallbackRoute,
  RouteCoordinate,
  RouteResult
} from "@/lib/maps/mapService";

function parseCoordinate(param: string | null): number | null {
  if (!param) return null;
  const num = parseFloat(param);
  return Number.isFinite(num) ? num : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Support both originLat/originLng and pLat/pLng or origin/dest query naming
    const originLat = parseCoordinate(searchParams.get("originLat") || searchParams.get("pLat") || searchParams.get("startLat"));
    const originLng = parseCoordinate(searchParams.get("originLng") || searchParams.get("pLng") || searchParams.get("startLng"));
    const destLat = parseCoordinate(searchParams.get("destLat") || searchParams.get("cLat") || searchParams.get("endLat"));
    const destLng = parseCoordinate(searchParams.get("destLng") || searchParams.get("cLng") || searchParams.get("endLng"));

    if (originLat === null || originLng === null || destLat === null || destLng === null) {
      return NextResponse.json(
        { error: "Missing or invalid coordinates. Required: originLat, originLng, destLat, destLng" },
        { status: 400 }
      );
    }

    if (
      originLat < -90 || originLat > 90 ||
      destLat < -90 || destLat > 90 ||
      originLng < -180 || originLng > 180 ||
      destLng < -180 || destLng > 180
    ) {
      return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
    }

    const origin: RouteCoordinate = { lat: originLat, lng: originLng };
    const dest: RouteCoordinate = { lat: destLat, lng: destLng };

    // 1. Check in-memory cache (30-60 second TTL for active routes)
    const cacheKey = getRouteCacheKey(originLat, originLng, destLat, destLng);
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const provider = getMapsProvider();
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 2. Google Maps Platform Directions API
    if (provider === "google" && googleApiKey) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${googleApiKey}`;
        const res = await fetch(googleUrl, { signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "OK" && data.routes && data.routes.length > 0) {
            const leg = data.routes[0].legs[0];
            const distanceMeters = leg.distance.value;
            const durationMinutes = Math.max(1, Math.ceil(leg.duration.value / 60));
            const polylineEncoded = data.routes[0].overview_polyline?.points || "";
            const coordinates = decodeGooglePolyline(polylineEncoded);

            const result: RouteResult = {
              success: true,
              distanceMeters,
              durationMinutes,
              coordinates: coordinates.length > 0 ? coordinates : [origin, dest],
              provider: "google",
              fallback: false
            };

            setCachedRoute(cacheKey, result, 45 * 1000);
            return NextResponse.json(result);
          } else {
            // Google Directions legacy API is not enabled or denied for this key; quietly fall through to OSRM
            if (process.env.NODE_ENV !== "production") {
              console.log(`[Directions API] Google Directions status: ${data.status} - falling back to OSRM`);
            }
          }
        }
      } catch (err: any) {
        // Fall back to OSRM without crashing
      }
    }

    // 3. Fallback routing via OSRM if Google Directions API is unavailable or denied
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const r = data.routes[0];
            const distanceMeters = Math.round(r.distance);
            const durationMinutes = Math.max(1, Math.ceil(r.duration / 60));
            const coords = (r.geometry?.coordinates || []).map(([lng, lat]: [number, number]) => ({ lat, lng }));

            const result: RouteResult = {
              success: true,
              distanceMeters,
              durationMinutes,
              coordinates: coords.length > 0 ? coords : [origin, dest],
              provider: "osm",
              fallback: false
            };

            setCachedRoute(cacheKey, result, 45 * 1000);
            return NextResponse.json(result);
          }
        }
      } catch {}

    // 4. Offline / Degraded Mode:
    // If upstream map APIs are unreachable, rate-limited, or failed, return straight-line
    // distance and travel time at 20 km/h Belagavi city traffic.
    const fallbackResult = computeFallbackRoute(origin, dest);
    // Cache degraded response for a shorter window (15s) so service recovers quickly
    setCachedRoute(cacheKey, fallbackResult, 15 * 1000);
    return NextResponse.json(fallbackResult);
  } catch (error: any) {
    console.error("[Directions API] Fatal handler error:", error);
    // Even on uncaught exception, return clean fallback
    const fallback = computeFallbackRoute(
      { lat: 15.8497, lng: 74.4977 },
      { lat: 15.8497, lng: 74.4977 },
      "Directions service degraded • Defaulting to Belagavi city center"
    );
    return NextResponse.json(fallback);
  }
}

