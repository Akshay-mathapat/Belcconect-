import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── GET /api/jobprovider/jobs — List Employer's Posted Jobs ───────────────
export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    if (authUser.role !== "job_provider" && authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only job providers can access employer jobs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const conditions: string[] = ["j.job_provider_id = $1"];
    const params: any[] = [authUser.userId];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`j.status = $${params.length}`);
    }

    const sql = `
      SELECT 
        j.id,
        j.job_provider_id,
        j.title,
        j.category,
        j.job_type,
        j.work_mode,
        j.location,
        j.salary_type,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.salary_text,
        j.openings,
        j.experience_required,
        j.education_required,
        j.description,
        j.responsibilities,
        j.requirements,
        j.perks_benefits,
        j.deadline,
        j.status,
        j.views_count,
        j.is_boosted,
        j.created_at,
        j.updated_at,
        (SELECT COUNT(*)::int FROM job_applications ja WHERE ja.job_id = j.id) AS applicants_count
      FROM jobs j
      WHERE ${conditions.join(" AND ")}
      ORDER BY j.created_at DESC;
    `;

    const res = await query(sql, params);
    return NextResponse.json({ jobs: res.rows });
  } catch (error: any) {
    console.error("GET /api/jobprovider/jobs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch employer jobs" },
      { status: 500 }
    );
  }
}
