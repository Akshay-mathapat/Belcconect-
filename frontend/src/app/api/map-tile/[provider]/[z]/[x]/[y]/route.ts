import { getAuthenticatedUser } from "@/lib/jwt";
import { checkIpRateLimit, checkUserRateLimit } from "@/lib/rateLimit";
import { getMapsProvider } from "@/lib/maps/mapService";

const TILE_SOURCES = {
  google: (z: string, x: string, y: string) =>
    `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
  carto: (z: string, x: string, y: string) =>
    `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
  esri: (z: string, x: string, y: string) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  osm: (z: string, x: string, y: string) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  default: (z: string, x: string, y: string) =>
    `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
} as const;

function isTileCoordinate(value: string) {
  return /^\d{1,8}$/.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string; z: string; x: string; y: string }> }
) {
  // 0. Authentication: Login is strictly required
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return new Response("Authentication required", { status: 401 });
  }

  // 0b. Rate Limiting: Per-IP and Per-User rate limits for map tiles (300 requests/min)
  const ipRate = await checkIpRateLimit(request, 300, 60);
  if (!ipRate.isAllowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "Retry-After": String(ipRate.retryAfter || 60),
        "X-RateLimit-Limit": "300",
        "X-RateLimit-Remaining": "0"
      }
    });
  }

  const userRate = await checkUserRateLimit(authUser.userId, 300, 60);
  if (!userRate.isAllowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "Retry-After": String(userRate.retryAfter || 60),
        "X-RateLimit-Limit": "300",
        "X-RateLimit-Remaining": "0"
      }
    });
  }

  const { provider, z, x, y: rawY } = await params;
  const y = rawY.replace(/\.png$/, "");

  if (!isTileCoordinate(z) || !isTileCoordinate(x) || !isTileCoordinate(y)) {
    return new Response("Invalid map tile", { status: 400 });
  }

  // Determine effective provider (Google is the default provider)
  const activeMapsProvider = getMapsProvider(); // "google" | "osm" | "fallback"
  let effectiveProvider = provider.toLowerCase();
  if (effectiveProvider === "default" || !TILE_SOURCES[effectiveProvider as keyof typeof TILE_SOURCES]) {
    effectiveProvider = activeMapsProvider === "osm" ? "osm" : "google";
  }

  // Use OSM tiles ONLY when MAPS_PROVIDER explicitly says "osm" (and allowed), never in production as fallback
  if (effectiveProvider === "osm" && activeMapsProvider !== "osm") {
    effectiveProvider = "google";
  }

  const sourceBuilder = TILE_SOURCES[effectiveProvider as keyof typeof TILE_SOURCES] || TILE_SOURCES.google;

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/+$/, "");
    if (!appUrl && process.env.NODE_ENV === "production") {
      throw new Error("FATAL: NEXT_PUBLIC_APP_URL or APP_URL environment variable is required.");
    }
    const domain = appUrl || "http://localhost:3000";

    const primaryUrl = sourceBuilder(z, x, y);
    let upstream = await fetch(primaryUrl, {
      headers: { "User-Agent": `BelConnect/1.0 (+${domain}; support@belconnect.in)` },
      next: { revalidate: 86400 },
    });

    // If OSM tile is unavailable or rate-limited, fallback to Google tiles
    if (!upstream.ok && effectiveProvider === "osm") {
      upstream = await fetch(`https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`, {
        headers: { "User-Agent": "BelConnect/1.0 map tile proxy" },
        next: { revalidate: 86400 },
      });
    }

    if (!upstream.ok) {
      return new Response("Map tile unavailable", { status: upstream.status });
    }

    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    // Network fallback to Google tiles on any error
    try {
      const fallback = await fetch(`https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`);
      if (fallback.ok) {
        return new Response(await fallback.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=86400",
          },
        });
      }
    } catch (_) {}
    return new Response("Map tile unavailable", { status: 502 });
  }
}

