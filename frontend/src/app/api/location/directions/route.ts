import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/jwt";
import { checkIpRateLimit, checkUserRateLimit } from "@/lib/rateLimit";
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
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, max-age=30" }
      });
    }

    const provider = getMapsProvider();
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 2. Google Maps Platform Directions API (Default provider)
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
            return NextResponse.json(result, {
              headers: { "Cache-Control": "private, max-age=30" }
            });
          }
        }
      } catch (err: any) {
        // Fall through to explicit OSM or graceful degraded fallback
      }
    }

    // 3. OSRM routing ONLY when MAPS_PROVIDER explicitly says "osm" (never silent fallback in production)
    if (provider === "osm") {
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
            return NextResponse.json(result, {
              headers: { "Cache-Control": "private, max-age=30" }
            });
          }
        }
      } catch {}
    }

    // 4. Offline / Degraded Mode:
    // If upstream map APIs are unreachable, rate-limited, or failed, return straight-line
    // distance and travel time at 20 km/h Belagavi city traffic.
    const fallbackResult = computeFallbackRoute(origin, dest);
    // Cache degraded response for a shorter window (15s) so service recovers quickly
    setCachedRoute(cacheKey, fallbackResult, 15 * 1000);
    return NextResponse.json(fallbackResult, {
      headers: { "Cache-Control": "private, max-age=15" }
    });
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

