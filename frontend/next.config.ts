import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com https://unpkg.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
              // connect-src: allows connections to local ports, OSRM, LiveKit, Dev Tunnels, Google, and Render signaling server
              "connect-src 'self' ws: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://accounts.google.com https://router.project-osrm.org https://*.livekit.cloud wss://*.livekit.cloud https://*.devtunnels.ms wss://*.devtunnels.ms https://*.onrender.com wss://*.onrender.com",
              "media-src 'self' blob:",
              "frame-src 'self' https://accounts.google.com",
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