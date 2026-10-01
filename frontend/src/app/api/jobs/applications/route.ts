import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── GET /api/jobs/applications — Candidate's Own Applications (Job Seeker) ─
export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication session" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM job_applications WHERE candidate_id = $1`,
      [authUser.userId]
    );
    const total = countRes.rows[0]?.total || 0;

    const sql = `
      SELECT 
        ja.id,
        ja.job_id,
        ja.candidate_id,
        ja.candidate_name,
        ja.candidate_email,
        ja.candidate_phone,
        ja.experience,
        ja.location,
        ja.resume_url,
        ja.cover_note,
        ja.status,
        ja.created_at,
        ja.updated_at,
        j.title AS job_title,
        j.category AS job_category,
        j.job_type,
        j.work_mode,
        j.location AS job_location,
        j.status AS job_status,
        COALESCE(bp.company_name, jp.name, 'BelConnect Partner') AS company_name,
        bp.logo_url AS company_logo
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      LEFT JOIN business_profiles bp ON j.job_provider_id = bp.job_provider_id
      LEFT JOIN job_providers jp ON j.job_provider_id = jp.id
      WHERE ja.candidate_id = $1
      ORDER BY ja.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const res = await query(sql, [authUser.userId, limit, offset]);

    return NextResponse.json({
      applications: res.rows,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/jobs/applications error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to fetch candidate applications" },
      { status: 500 }
    );
  }
}
