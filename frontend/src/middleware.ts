import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo";

/**
 * BelConnect SEO & Domain Hygiene Middleware
 * 1. 301 Redirect www to non-www for canonical consolidation
 * 2. 301 Redirect leftover *.vercel.app traffic to custom domain if configured
 * 3. Defence-in-Depth: Injects X-Robots-Tag: noindex, nofollow on all private route prefixes
 */

const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/provider",
  "/job-provider",
  "/jobprovider",
  "/bookings",
  "/book",
  "/auth",
  "/login",
  "/register",
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // 1. Canonical Domain Hygiene: 301 Redirect www to non-www
  if (host.startsWith("www.")) {
    const nonWwwHost = host.replace(/^www\./, "");
    const destination = `https://${nonWwwHost}${pathname}${search}`;
    return NextResponse.redirect(destination, 301);
  }

  // 2. Custom Domain Consolidation: 301 Redirect *.vercel.app to custom domain if configured
  try {
    const canonicalHost = new URL(SITE_URL).host;
    const isCustomDomain =
      canonicalHost &&
      !canonicalHost.endsWith("vercel.app") &&
      !canonicalHost.includes("localhost") &&
      !canonicalHost.includes("127.0.0.1");

    if (isCustomDomain && host.endsWith(".vercel.app")) {
      const destination = `https://${canonicalHost}${pathname}${search}`;
      return NextResponse.redirect(destination, 301);
    }
  } catch {
    // If URL parsing fails, ignore redirect
  }

  // 3. Defence-in-depth: Set X-Robots-Tag header on private routes
  const response = NextResponse.next();
  const isPrivate = PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isPrivate) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, fonts, and manifest files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)).*)",
  ],
};

