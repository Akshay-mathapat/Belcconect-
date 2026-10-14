import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // If not on production, disallow search engines completely from preview/staging branches
  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/admin/",
        "/account",
        "/account/",
        "/provider",
        "/provider/",
        "/job-provider",
        "/job-provider/",
        "/jobprovider",
        "/jobprovider/",
        "/bookings",
        "/bookings/",
        "/book",
        "/book/",
        "/auth",
        "/auth/",
        "/login",
        "/login/",
        "/register",
        "/register/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

