import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  InMemoryStore,
  UpstashRedisStore,
  PostgresRateLimitStore,
  setPostgresQueryFn,
  memoryFallbackStore,
  resolveStore,
  getClientIp,
  checkIpRateLimit,
  checkEmailRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
} from "./rateLimitCore";

// Initialize PostgreSQL store with the DB query runner
setPostgresQueryFn(query);

export interface RateLimitResult {
  isAllowed: boolean;
  remaining: number;
  retryAfter: number;
  totalPoints: number;
}

export interface IRateLimitStore {
  name: string;
  increment(key: string, windowSeconds: number): Promise<{ points: number; retryAfter: number }>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<{ points: number; retryAfter: number }>;
}

export {
  InMemoryStore,
  UpstashRedisStore,
  PostgresRateLimitStore,
  memoryFallbackStore,
  resolveStore,
  getClientIp,
  checkIpRateLimit,
  checkEmailRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
};

/**
 * Compatibility wrapper for endpoints using checkRateLimit(request, limit, windowMs).
 */
export async function checkRateLimit(
  request: Request,
  limit: number = 120,
  windowMs: number = 60 * 1000
): Promise<{
  isAllowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
  response?: NextResponse;
}> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const result = await checkIpRateLimit(request, limit, windowSeconds);

  if (!result.isAllowed) {
    const response = NextResponse.json(
      {
        error: `Too many requests. Please try again in ${result.retryAfter} second(s).`,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );

    return {
      isAllowed: false,
      remaining: 0,
      limit,
      resetTime: Date.now() + result.retryAfter * 1000,
      response,
    };
  }

  return {
    isAllowed: true,
    remaining: result.remaining,
    limit,
    resetTime: Date.now() + windowSeconds * 1000,
  };
}

export function resetRateLimit(): void {
  memoryFallbackStore.clear();
}

