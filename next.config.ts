import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com https://unpkg.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
              // connect-src: allows connections to local ports, OSRM, LiveKit, and Dev Tunnels (for signaling)
              "connect-src 'self' ws: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://router.project-osrm.org https://*.livekit.cloud wss://*.livekit.cloud https://*.devtunnels.ms wss://*.devtunnels.ms",
              "media-src 'self' blob:",
              "object-src 'none'",
              "frame-ancestors 'none'"
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;