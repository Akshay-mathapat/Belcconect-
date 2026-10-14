import { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { SERVICE_CATEGORIES } from "@/constants/site";
import { query } from "@/lib/db";

// Hourly sitemap revalidation on Vercel Edge cache
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Static high-priority landing & institutional pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: absoluteUrl("/services"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/jobs"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/help"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/cancellation"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // 2. Service Category pages (Belagavi local service hubs)
  const categoryRoutes: MetadataRoute.Sitemap = SERVICE_CATEGORIES.map((cat) => ({
    url: absoluteUrl(`/services/${cat.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // 3. Dynamic database routes (Verified providers & active jobs)
  let dynamicProviderRoutes: MetadataRoute.Sitemap = [];
  let dynamicJobRoutes: MetadataRoute.Sitemap = [];

  try {
    // Only verified and currently available service providers (never private/unverified)
    const providersRes = await query(
      `SELECT id, created_at, verified_at 
       FROM service_providers 
       WHERE (verification_status = 'verified' OR is_verified = true) 
         AND is_available = true 
       ORDER BY id ASC 
       LIMIT 5000`
    );

    if (providersRes && Array.isArray(providersRes.rows)) {
      dynamicProviderRoutes = providersRes.rows.map((p: any) => ({
        url: absoluteUrl(`/provider-profile/${p.id}`),
        lastModified: p.verified_at ? new Date(p.verified_at) : p.created_at ? new Date(p.created_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.warn("[Sitemap] Failed to query verified providers, skipping dynamic provider URLs:", err);
  }

  try {
    // Only active, non-expired jobs (never closed/draft jobs)
    const jobsRes = await query(
      `SELECT id, updated_at, published_at, created_at 
       FROM jobs 
       WHERE status = 'active' 
         AND (deadline IS NULL OR deadline >= CURRENT_DATE) 
       ORDER BY id ASC 
       LIMIT 5000`
    );

    if (jobsRes && Array.isArray(jobsRes.rows)) {
      dynamicJobRoutes = jobsRes.rows.map((j: any) => ({
        url: absoluteUrl(`/jobs/${j.id}`),
        lastModified: j.updated_at
          ? new Date(j.updated_at)
          : j.published_at
          ? new Date(j.published_at)
          : j.created_at
          ? new Date(j.created_at)
          : now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.warn("[Sitemap] Failed to query active jobs, skipping dynamic job URLs:", err);
  }

  // Combine static and dynamic entries; if database fails, static entries are safely preserved
  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...dynamicProviderRoutes,
    ...dynamicJobRoutes,
  ];
}

