"use client";

import { disconnectChatSocket } from "@/lib/socketChat";

/**
 * Custom error thrown or attached when an authenticated request lacks a valid token.
 */
export class AuthRequiredError extends Error {
  public readonly status = 401;
  constructor(message = "Unauthorized: Missing authentication token") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export interface AuthFetchOptions {
  /**
   * If true (default), requires a valid JWT token before dispatching the request.
   * If false, allows public requests without authentication headers.
   */
  protected?: boolean;
  /**
   * If true, returns a rejected Promise on missing token.
   * If false (default), returns a controlled 401 Response object to prevent unhandled rejection loops.
   */
  throwOnMissingToken?: boolean;
}

/**
 * Returns the current valid JWT token from localStorage or cookie.
 */
export function getClientToken(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Check direct token keys in localStorage
  const keys = ["cityconnect_token", "auth_token", "cityconnect_auth_token"];
  for (const key of keys) {
    const val = localStorage.getItem(key);
    if (val && typeof val === "string" && val !== "undefined" && val !== "null" && val.trim().length > 10) {
      return val.trim();
    }
  }

  // 2. Check persisted zustand store in localStorage
  try {
    const rawStore = localStorage.getItem("belconnect-auth-store");
    if (rawStore) {
      const parsed = JSON.parse(rawStore);
      const storeToken = parsed?.state?.currentUser?.token;
      if (storeToken && typeof storeToken === "string" && storeToken.trim().length > 10) {
        return storeToken.trim();
      }
    }
  } catch (e) {}

  // 3. Fallback to auth_token cookie
  try {
    const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match && match[1] && match[1] !== "undefined" && match[1] !== "null" && match[1].trim().length > 10) {
      return decodeURIComponent(match[1].trim());
    }
  } catch (e) {}
  return null;
}

// Module-level guard to prevent multiple simultaneous 401 responses from flooding logout/redirects
let isHandlingAuthExpired = false;
let lastAuthExpiredTime = 0;

export function triggerAuthExpired() {
  if (typeof window !== "undefined") {
    const p = window.location.pathname.toLowerCase();
    // NEVER trigger auth logout or wipe tokens while the user is actively on auth/login pages
    if (p.startsWith("/login") || p.startsWith("/auth") || p.startsWith("/register")) {
      return;
    }
  }

  const now = Date.now();
  // Debounce to at most once per 5 seconds
  if (isHandlingAuthExpired || (now - lastAuthExpiredTime < 5000)) {
    return;
  }
  isHandlingAuthExpired = true;
  lastAuthExpiredTime = now;

  console.warn("[AUTH] Session expired or 401 received. Halting sockets and dispatching 'auth:expired'.");

  // Disconnect authenticated chat socket immediately
  try {
    disconnectChatSocket();
  } catch (e) {}

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("cityconnect_token");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("cityconnect_auth_token");
      localStorage.removeItem("cityconnect_user_id");
      localStorage.removeItem("user_id");
      document.cookie = "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  setTimeout(() => {
    isHandlingAuthExpired = false;
  }, 5000);
}

/**
 * Central authenticated fetch helper.
 * - Injects Authorization: Bearer <token>
 * - Injects credentials: "include"
 * - Prevents unauthenticated requests to protected endpoints
 * - Automatically triggers auth:expired once on HTTP 401
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: AuthFetchOptions = { protected: true }
): Promise<Response> {
  const isProtected = options.protected !== false;
  const token = getClientToken();

  if (isProtected && !token) {
    triggerAuthExpired();
    if (options.throwOnMissingToken) {
      return Promise.reject(new AuthRequiredError());
    }
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing authentication token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials || "include"
  });

  if (response.status === 401) {
    triggerAuthExpired();
  }

  return response;
}
