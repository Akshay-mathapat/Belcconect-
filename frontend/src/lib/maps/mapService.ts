/**
 * BelConnect - Maps, Directions & Geocoding Service
 * Central module for distance calculation, route caching, movement threshold guards,
 * Google Maps integration, and offline/degraded fallbacks for Belagavi city.
 */

// Belagavi City Center coordinates (ONLY allowed default center per project hardening rules)
export const BELAGAVI_CITY_CENTER = {
  lat: 15.8497,
  lng: 74.4977
} as const;

export const CITY_TRAFFIC_SPEED_KMH = 20; // 20 km/h average Belagavi urban traffic speed
export const DEFAULT_ROUTE_REFRESH_THRESHOLD_METERS = 50; // Minimum provider movement before re-fetching route
export const DEFAULT_ROUTE_CACHE_TTL_MS = 45 * 1000; // 45 seconds route cache TTL
export const DEFAULT_GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour geocode cache TTL
export const MAX_ROUTE_CACHE_SIZE = 1000;

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteResult {
  success: boolean;
  distanceMeters: number;
  durationMinutes: number;
  coordinates: RouteCoordinate[];
  provider: "google" | "osm" | "fallback";
  fallback: boolean;
  fallbackReason?: string;
  cached?: boolean;
}

export interface GeocodeResult {
  success: boolean;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  locality?: string;
  placeId?: string | null;
  latitude: number;
  longitude: number;
  provider: "google" | "osm" | "fallback";
  fallback: boolean;
}

/**
 * Parses and returns the configured MAPS_PROVIDER from environment.
 * In production mode, defaults strictly to "google".
 */
export function getMapsProvider(): "google" | "osm" | "fallback" {
  const envProvider = (process.env.MAPS_PROVIDER || "").trim().toLowerCase();
  if (envProvider === "osm") {
    // Only permit raw OSM if explicitly allowed and NOT in strict production
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PUBLIC_OSM) {
      return "google";
    }
    return "osm";
  }
  return "google";
}

/**
 * Rounds coordinate to 4 decimal places (~11 meters precision at the equator)
 * to maximize cache hit rates for nearby requests.
 */
export function roundCoord(coord: number, decimals = 4): number {
  if (typeof coord !== "number" || isNaN(coord)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(coord * factor) / factor;
}

/**
 * Generates normalized cache key for routes between two points.
 */
export function getRouteCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  return `${roundCoord(originLat)},${roundCoord(originLng)}->${roundCoord(destLat)},${roundCoord(destLng)}`;
}

/**
 * Calculates straight-line distance in meters between two lat/lng coordinates
 * using the Haversine formula (spherical earth model R = 6371000m).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Estimates travel time in minutes based on distance and Belagavi city traffic speed (default 20 km/h).
 * 20 km/h = 20,000 m / 3600 s = 5.555 m/s.
 * Minimum 1 minute for non-zero distance.
 */
export function estimateCityTravelTime(
  distanceMeters: number,
  speedKmh = CITY_TRAFFIC_SPEED_KMH
): number {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const safeSpeed = speedKmh > 0 ? speedKmh : CITY_TRAFFIC_SPEED_KMH;
  const speedMetersPerMin = (safeSpeed * 1000) / 60;
  const minutes = Math.ceil(distanceMeters / speedMetersPerMin);
  return Math.max(1, minutes);
}

/**
 * Guard function to prevent the 35s route refresh timer from hammering the Directions API.
 * Only returns true if the provider has moved more than thresholdMeters (default 50m).
 */
export function shouldRefreshRoute(
  lastCoords: RouteCoordinate | null | undefined,
  currentCoords: RouteCoordinate | null | undefined,
  thresholdMeters = DEFAULT_ROUTE_REFRESH_THRESHOLD_METERS
): boolean {
  if (!currentCoords || typeof currentCoords.lat !== "number" || typeof currentCoords.lng !== "number") {
    return false;
  }
  if (!lastCoords || typeof lastCoords.lat !== "number" || typeof lastCoords.lng !== "number") {
    return true; // First time fetching route
  }

  const movedMeters = calculateHaversineDistance(
    lastCoords.lat,
    lastCoords.lng,
    currentCoords.lat,
    currentCoords.lng
  );

  return movedMeters >= thresholdMeters;
}

/**
 * Offline/Degraded Mode:
 * Generates a clean straight-line fallback route when directions API is unavailable.
 */
export function computeFallbackRoute(
  origin: RouteCoordinate,
  dest: RouteCoordinate,
  reason = "Estimated via direct distance • 20 km/h Belagavi city traffic"
): RouteResult {
  const distanceMeters = calculateHaversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
  const durationMinutes = estimateCityTravelTime(distanceMeters, CITY_TRAFFIC_SPEED_KMH);

  return {
    success: true,
    distanceMeters,
    durationMinutes,
    coordinates: [
      { lat: origin.lat, lng: origin.lng },
      { lat: dest.lat, lng: dest.lng }
    ],
    provider: "fallback",
    fallback: true,
    fallbackReason: reason
  };
}

/**
 * Decodes a Google Maps encoded polyline string into an array of { lat, lng } coordinates.
 */
export function decodeGooglePolyline(encoded: string): RouteCoordinate[] {
  if (!encoded || typeof encoded !== "string") return [];

  const points: RouteCoordinate[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }

  return points;
}

// In-Memory Route Cache
interface RouteCacheEntry {
  result: RouteResult;
  timestamp: number;
  ttlMs: number;
}

const routeMemoryCache = new Map<string, RouteCacheEntry>();

export function getCachedRoute(cacheKey: string, now = Date.now()): RouteResult | null {
  const entry = routeMemoryCache.get(cacheKey);
  if (!entry) return null;
  if (now - entry.timestamp > entry.ttlMs) {
    routeMemoryCache.delete(cacheKey);
    return null;
  }
  return { ...entry.result, cached: true };
}

export function setCachedRoute(
  cacheKey: string,
  result: RouteResult,
  ttlMs = DEFAULT_ROUTE_CACHE_TTL_MS,
  now = Date.now()
): void {
  if (routeMemoryCache.size >= MAX_ROUTE_CACHE_SIZE) {
    const oldestKey = routeMemoryCache.keys().next().value;
    if (oldestKey) routeMemoryCache.delete(oldestKey);
  }
  routeMemoryCache.set(cacheKey, {
    result,
    timestamp: now,
    ttlMs
  });
}

export function clearRouteCache(): void {
  routeMemoryCache.clear();
}

