/**
 * Single source of truth for resolving the Socket.IO signaling server URL.
 *
 * Rules:
 * - URL must come ONLY from environment variables (NEXT_PUBLIC_SIGNALING_URL or SIGNALING_SERVER_URL).
 * - Normalized to have NO trailing slash.
 * - In production, if the signaling URL points to a *.vercel.app host, logs a loud fatal error:
 *   Socket.IO cannot run on Vercel serverless; it must point to the Render backend.
 */
export function getSignalingUrl(): string {
  const rawUrl =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIGNALING_URL) ||
    (typeof process !== "undefined" && process.env.SIGNALING_SERVER_URL) ||
    "";

  let cleaned = typeof rawUrl === "string" ? rawUrl.trim() : "";

  // Strip trailing slashes
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }

  const isProduction =
    typeof process !== "undefined" && process.env.NODE_ENV === "production";

  // Check if signaling URL mistakenly points to Vercel
  if (cleaned.includes("vercel.app")) {
    console.error(
      `[FATAL SIGNALING CONFIG ERROR] Signaling URL "${cleaned}" points to Vercel! ` +
      `Socket.IO cannot run on Vercel serverless infrastructure. ` +
      `It MUST point to your Render backend web service (e.g. NEXT_PUBLIC_SIGNALING_URL=https://your-backend.onrender.com).`
    );
  }

  // If environment variable is configured, return the normalized URL
  if (cleaned) {
    return cleaned;
  }

  // Production check: environment variable is strictly required
  if (isProduction) {
    console.error(
      `[FATAL SIGNALING CONFIG ERROR] NEXT_PUBLIC_SIGNALING_URL is missing in production! ` +
      `Real-time calls, live location tracking, and chat require a running Render backend service.`
    );
    return "";
  }

  // Non-production / Local development fallbacks only
  if (typeof window !== "undefined") {
    const browserHost = window.location.hostname;
    const protocol = window.location.protocol;

    // VS Code Dev Tunnels forwarding port 3000 -> 4001
    if (browserHost.includes("devtunnels.ms")) {
      const derivedSignalingHost = browserHost.replace(/-3000(?=\.|\b)/, "-4001");
      return `${protocol}//${derivedSignalingHost}`;
    }

    if (browserHost === "localhost" || browserHost === "127.0.0.1") {
      return `http://${browserHost}:4001`;
    }
  }

  return "http://localhost:4001";
}
