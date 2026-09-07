import { NextResponse } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitStore>();

// Cleanup expired entries periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipStore.entries()) {
      if (now > data.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}

export function resetRateLimit(ip?: string): void {
  if (ip) {
    ipStore.delete(ip);
  } else {
    ipStore.clear();
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Enforces rate limiting per IP address.
 * @param request The incoming HTTP request
 * @param limit Maximum allowed attempts (default: 5)
 * @param windowMs Window duration in milliseconds (default: 15 minutes)
 */
export function checkRateLimit(
  request: Request,
  limit: number = 5,
  windowMs: number = 5 * 60 * 1000
): {
  isAllowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
  response?: NextResponse;
} {
  const ip = getClientIp(request);
  const now = Date.now();
  const record = ipStore.get(ip);

  if (!record || now > record.resetTime) {
    ipStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      isAllowed: true,
      remaining: limit - 1,
      limit,
      resetTime: now + windowMs,
    };
  }

  if (record.count >= limit) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    const response = NextResponse.json(
      {
        error: `Too many login attempts. Please try again in ${Math.ceil(
          retryAfterSeconds / 60
        )} minute(s). (Max ${limit} attempts allowed)`,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(record.resetTime / 1000)),
        },
      }
    );

    return {
      isAllowed: false,
      remaining: 0,
      limit,
      resetTime: record.resetTime,
      response,
    };
  }

  record.count += 1;
  return {
    isAllowed: true,
    remaining: limit - record.count,
    limit,
    resetTime: record.resetTime,
  };
}
