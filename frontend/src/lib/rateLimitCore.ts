import crypto from "crypto";

const MAX_MEMORY_ENTRIES = 5000;

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

export class InMemoryStore implements IRateLimitStore {
  name = "memory";
  private map = new Map<string, { points: number; expireAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<{ points: number; retryAfter: number }> {
    const now = Date.now();
    let entry = this.map.get(key);

    if (!entry || now >= entry.expireAt) {
      if (this.map.size >= MAX_MEMORY_ENTRIES) {
        this.cleanup();
      }
      entry = { points: 1, expireAt: now + windowSeconds * 1000 };
      this.map.set(key, entry);
      return { points: 1, retryAfter: windowSeconds };
    }

    entry.points += 1;
    const retryAfter = Math.max(1, Math.ceil((entry.expireAt - now) / 1000));
    return { points: entry.points, retryAfter };
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }

  async get(key: string): Promise<{ points: number; retryAfter: number }> {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || now >= entry.expireAt) {
      return { points: 0, retryAfter: 0 };
    }
    const retryAfter = Math.max(1, Math.ceil((entry.expireAt - now) / 1000));
    return { points: entry.points, retryAfter };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [k, v] of this.map.entries()) {
      if (now >= v.expireAt) {
        this.map.delete(k);
      }
    }
    if (this.map.size >= MAX_MEMORY_ENTRIES) {
      const keysToDelete = Array.from(this.map.keys()).slice(0, Math.floor(MAX_MEMORY_ENTRIES * 0.2));
      for (const k of keysToDelete) {
        this.map.delete(k);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

export class UpstashRedisStore implements IRateLimitStore {
  name = "upstash";
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async increment(key: string, windowSeconds: number): Promise<{ points: number; retryAfter: number }> {
    const endpoint = `${this.url.replace(/\/+$/, "")}/pipeline`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds, "NX"],
        ["TTL", key],
      ]),
    });

    if (!res.ok) {
      throw new Error(`Upstash HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const points = data[0]?.result ?? 1;
    const ttl = data[2]?.result ?? windowSeconds;
    const retryAfter = Math.max(1, typeof ttl === "number" && ttl > 0 ? ttl : windowSeconds);
    return { points, retryAfter };
  }

  async reset(key: string): Promise<void> {
    const endpoint = `${this.url.replace(/\/+$/, "")}/del/${encodeURIComponent(key)}`;
    await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    }).catch(() => {});
  }

  async get(key: string): Promise<{ points: number; retryAfter: number }> {
    const endpoint = `${this.url.replace(/\/+$/, "")}/pipeline`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["GET", key],
        ["TTL", key],
      ]),
    });

    if (!res.ok) {
      throw new Error(`Upstash HTTP ${res.status}`);
    }

    const data = await res.json();
    const points = parseInt(data[0]?.result || "0", 10);
    const ttl = data[1]?.result ?? 0;
    const retryAfter = Math.max(0, typeof ttl === "number" && ttl > 0 ? ttl : 0);
    return { points, retryAfter };
  }
}

type QueryFunction = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
let activePgQueryFn: QueryFunction | null = null;

export function setPostgresQueryFn(fn: QueryFunction): void {
  activePgQueryFn = fn;
}

export class PostgresRateLimitStore implements IRateLimitStore {
  name = "postgres";
  private queryFn: QueryFunction | null;

  constructor(queryFn?: QueryFunction) {
    this.queryFn = queryFn || activePgQueryFn;
  }

  async increment(key: string, windowSeconds: number): Promise<{ points: number; retryAfter: number }> {
    const query = this.queryFn || activePgQueryFn;
    if (!query) {
      throw new Error("PostgreSQL query function not initialized");
    }

    const sql = `
      INSERT INTO rate_limits (key, points, expire_at)
      VALUES ($1, 1, NOW() + ($2 || ' seconds')::interval)
      ON CONFLICT (key) DO UPDATE
      SET points = CASE
            WHEN rate_limits.expire_at < NOW() THEN 1
            ELSE rate_limits.points + 1
          END,
          expire_at = CASE
            WHEN rate_limits.expire_at < NOW() THEN NOW() + ($2 || ' seconds')::interval
            ELSE rate_limits.expire_at
          END
      RETURNING points, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expire_at - NOW()))))::int AS retry_after;
    `;

    const res = await query(sql, [key, windowSeconds]);
    if (!res.rows || res.rows.length === 0) {
      throw new Error("PostgreSQL rate_limits table returned empty row");
    }

    if (Math.random() < 0.02) {
      query("DELETE FROM rate_limits WHERE expire_at < NOW()").catch(() => {});
    }

    const row = res.rows[0];
    return {
      points: Number(row.points) || 1,
      retryAfter: Number(row.retry_after) || windowSeconds,
    };
  }

  async reset(key: string): Promise<void> {
    const query = this.queryFn || activePgQueryFn;
    if (!query) return;
    await query("DELETE FROM rate_limits WHERE key = $1", [key]);
  }

  async get(key: string): Promise<{ points: number; retryAfter: number }> {
    const query = this.queryFn || activePgQueryFn;
    if (!query) {
      throw new Error("PostgreSQL query function not initialized");
    }

    const sql = `
      SELECT points, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expire_at - NOW()))))::int AS retry_after
      FROM rate_limits
      WHERE key = $1 AND expire_at > NOW();
    `;
    const res = await query(sql, [key]);
    if (!res.rows || res.rows.length === 0) {
      return { points: 0, retryAfter: 0 };
    }
    const row = res.rows[0];
    return {
      points: Number(row.points) || 0,
      retryAfter: Number(row.retry_after) || 0,
    };
  }
}

export const memoryFallbackStore = new InMemoryStore();
let hasLoggedMemoryWarning = false;

export function resolveStore(): IRateLimitStore {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    return new UpstashRedisStore(upstashUrl, upstashToken);
  }

  if (activePgQueryFn || process.env.DATABASE_URL) {
    return new PostgresRateLimitStore();
  }

  if (!hasLoggedMemoryWarning && typeof window === "undefined") {
    hasLoggedMemoryWarning = true;
    console.warn(
      "[RateLimit] Notice: Neither UPSTASH_REDIS nor PostgreSQL rate_limits is configured. Falling back to in-memory store."
    );
  }

  return memoryFallbackStore;
}

export function getClientIp(request?: Request | { headers?: Headers | Record<string, string | null | undefined> }): string {
  const headers = request && "headers" in request ? request.headers : null;
  if (headers) {
    const getHeader = (name: string): string | null => {
      if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
      const rec = headers as Record<string, string | null | undefined>;
      return rec[name] || rec[name.toLowerCase()] || null;
    };

    const forwarded = getHeader("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0].trim();
      if (first) return first;
    }

    const realIp = getHeader("x-real-ip");
    if (realIp && realIp.trim()) {
      return realIp.trim();
    }
  }

  return `anon_req_${crypto.randomUUID()}`;
}

export async function checkIpRateLimit(
  requestOrIp: Request | string,
  limit: number = 120,
  windowSeconds: number = 60,
  storeOverride?: IRateLimitStore
): Promise<RateLimitResult> {
  let ipKey: string;
  if (typeof requestOrIp === "string") {
    ipKey = requestOrIp.startsWith("anon_req_")
      ? requestOrIp
      : `rl:ip:${requestOrIp}`;
  } else {
    const clientIp = getClientIp(requestOrIp);
    ipKey = clientIp.startsWith("anon_req_")
      ? clientIp
      : `rl:ip:${clientIp}`;
  }

  if (ipKey.startsWith("anon_req_")) {
    return {
      isAllowed: true,
      remaining: limit - 1,
      retryAfter: 0,
      totalPoints: 1,
    };
  }

  const store = storeOverride || resolveStore();

  try {
    const { points, retryAfter } = await store.increment(ipKey, windowSeconds);
    const isAllowed = points <= limit;
    return {
      isAllowed,
      remaining: Math.max(0, limit - points),
      retryAfter: isAllowed ? 0 : retryAfter,
      totalPoints: points,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[RateLimit] Warning: Store (${store.name}) failed during IP check for ${ipKey}. Failing open:`,
      msg
    );
    return {
      isAllowed: true,
      remaining: 1,
      retryAfter: 0,
      totalPoints: 0,
    };
  }
}

export async function checkEmailRateLimit(
  email: string,
  limit: number = 10,
  storeOverride?: IRateLimitStore
): Promise<RateLimitResult> {
  const cleanEmail = email.trim().toLowerCase();
  const key = `rl:fail:email:${cleanEmail}`;
  const store = storeOverride || resolveStore();

  try {
    const { points, retryAfter } = await store.get(key);
    const isAllowed = points < limit;
    return {
      isAllowed,
      remaining: Math.max(0, limit - points),
      retryAfter: isAllowed ? 0 : retryAfter,
      totalPoints: points,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[RateLimit] Error checking email limit for ${cleanEmail}; failing open:`,
      msg
    );
    return {
      isAllowed: true,
      remaining: 1,
      retryAfter: 0,
      totalPoints: 0,
    };
  }
}

export async function recordLoginFailure(
  email: string,
  limit: number = 10,
  windowSeconds: number = 15 * 60,
  storeOverride?: IRateLimitStore
): Promise<RateLimitResult> {
  const cleanEmail = email.trim().toLowerCase();
  const key = `rl:fail:email:${cleanEmail}`;
  const store = storeOverride || resolveStore();

  try {
    const { points, retryAfter } = await store.increment(key, windowSeconds);
    const isAllowed = points < limit;
    return {
      isAllowed,
      remaining: Math.max(0, limit - points),
      retryAfter: isAllowed ? 0 : retryAfter,
      totalPoints: points,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[RateLimit] Error recording failure for ${cleanEmail}:`,
      msg
    );
    return {
      isAllowed: true,
      remaining: 1,
      retryAfter: 0,
      totalPoints: 1,
    };
  }
}

export async function recordLoginSuccess(
  email: string,
  storeOverride?: IRateLimitStore
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const key = `rl:fail:email:${cleanEmail}`;
  const store = storeOverride || resolveStore();

  try {
    await store.reset(key);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[RateLimit] Error resetting failure for ${cleanEmail}:`,
      msg
    );
  }
}