import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── GET /api/jobprovider/candidates — Applications Across All Employer Jobs 
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
        { error: "Forbidden: Only job providers can view candidates" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const jobId = searchParams.get("job_id");
    const q = searchParams.get("q")?.trim() || "";

    const conditions: string[] = ["j.job_provider_id = $1"];
    const params: any[] = [authUser.userId];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`ja.status = $${params.length}`);
    }

    if (jobId && jobId !== "all") {
      params.push(jobId);
      conditions.push(`ja.job_id = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const pIdx = params.length;
      conditions.push(
        `(ja.candidate_name ILIKE $${pIdx} OR ja.candidate_email ILIKE $${pIdx} OR j.title ILIKE $${pIdx} OR ja.location ILIKE $${pIdx})`
      );
    }

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
        c.avatar AS candidate_avatar
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      LEFT JOIN customers c ON ja.candidate_id = c.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ja.created_at DESC;
    `;

    const res = await query(sql, params);
    return NextResponse.json({ candidates: res.rows });
  } catch (error: any) {
    console.error("GET /api/jobprovider/candidates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/jobprovider/candidates — Update Application Status ─────────
export async function PATCH(request: Request) {
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
        { error: "Forbidden: Only job providers can update candidate status" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { applicationId, status } = body;

    if (!applicationId || !status) {
      return NextResponse.json(
        { error: "Application ID and new status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["new", "reviewed", "shortlisted", "hired", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify application belongs to a job owned by this employer
    const checkSql = `
      SELECT ja.id, j.job_provider_id
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.id = $1
      LIMIT 1;
    `;
    const checkRes = await query(checkSql, [applicationId]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (checkRes.rows[0].job_provider_id !== authUser.userId && authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: You do not own the job for this application" },
        { status: 403 }
      );
    }

    const updateSql = `
      UPDATE job_applications
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const updateRes = await query(updateSql, [status, applicationId]);

    return NextResponse.json({
      success: true,
      application: updateRes.rows[0],
      message: `Candidate status updated to ${status}`,
    });
  } catch (error: any) {
    console.error("PATCH /api/jobprovider/candidates error:", error);
    return NextResponse.json(
      { error: "Failed to update candidate status" },
      { status: 500 }
    );
  }
}
