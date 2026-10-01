import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── GET /api/jobs — Public Search & Filter for Job Listings ───────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const jobType = searchParams.get("job_type")?.trim() || "";
    const workMode = searchParams.get("work_mode")?.trim() || "";
    const location = searchParams.get("location")?.trim() || "";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const conditions: string[] = ["j.status = 'active'"];
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      const pIdx = params.length;
      conditions.push(
        `(j.title ILIKE $${pIdx} OR j.description ILIKE $${pIdx} OR j.category ILIKE $${pIdx} OR bp.company_name ILIKE $${pIdx} OR jp.name ILIKE $${pIdx})`
      );
    }

    if (category && category !== "all") {
      params.push(category);
      conditions.push(`j.category ILIKE $${params.length}`);
    }

    if (jobType && jobType !== "all") {
      params.push(jobType);
      conditions.push(`j.job_type ILIKE $${params.length}`);
    }

    if (workMode && workMode !== "all") {
      params.push(workMode);
      conditions.push(`j.work_mode ILIKE $${params.length}`);
    }

    if (location && location !== "all") {
      params.push(`%${location}%`);
      conditions.push(`j.location ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM jobs j
      LEFT JOIN business_profiles bp ON j.job_provider_id = bp.job_provider_id
      LEFT JOIN job_providers jp ON j.job_provider_id = jp.id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const queryParams = [...params, limit, offset];
    const dataSql = `
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
        COALESCE(bp.company_name, jp.name, 'BelConnect Partner') AS company_name,
        bp.logo_url AS company_logo,
        bp.city AS company_city,
        (SELECT COUNT(*)::int FROM job_applications ja WHERE ja.job_id = j.id) AS applicants_count
      FROM jobs j
      LEFT JOIN business_profiles bp ON j.job_provider_id = bp.job_provider_id
      LEFT JOIN job_providers jp ON j.job_provider_id = jp.id
      ${whereClause}
      ORDER BY j.is_boosted DESC, j.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const dataRes = await query(dataSql, queryParams);

    return NextResponse.json({
      jobs: dataRes.rows,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job listings" },
      { status: 500 }
    );
  }
}

// ── POST /api/jobs — Create New Job (Employer / Job Provider) ─────────────
export async function POST(request: Request) {
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
        { error: "Forbidden: Only job providers can post job listings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      category,
      jobType = "Full-time",
      workMode = "On-site",
      location = "Belagavi",
      salaryType = "Competitive",
      salaryMin = null,
      salaryMax = null,
      salaryCurrency = "INR",
      salaryText = "",
      openings = 1,
      experienceRequired = "",
      educationRequired = "",
      description,
      responsibilities = "",
      requirements = "",
      perksBenefits = "",
      deadline = null,
      status = "active",
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Job title is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }
    if (!category || typeof category !== "string" || !category.trim()) {
      return NextResponse.json({ error: "Job category is required" }, { status: 400 });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const insertSql = `
      INSERT INTO jobs (
        id,
        job_provider_id,
        title,
        category,
        job_type,
        work_mode,
        location,
        salary_type,
        salary_min,
        salary_max,
        salary_currency,
        salary_text,
        openings,
        experience_required,
        education_required,
        description,
        responsibilities,
        requirements,
        perks_benefits,
        deadline,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
      )
      RETURNING *;
    `;

    const res = await query(insertSql, [
      jobId,
      authUser.userId,
      title.trim(),
      category.trim(),
      jobType.trim(),
      workMode.trim(),
      location.trim(),
      salaryType.trim(),
      salaryMin ? parseFloat(salaryMin) : null,
      salaryMax ? parseFloat(salaryMax) : null,
      salaryCurrency.trim(),
      salaryText?.trim() || null,
      parseInt(openings, 10) || 1,
      experienceRequired?.trim() || null,
      educationRequired?.trim() || null,
      description.trim(),
      responsibilities?.trim() || null,
      requirements?.trim() || null,
      perksBenefits?.trim() || null,
      deadline ? deadline : null,
      status || "active",
    ]);

    return NextResponse.json({ success: true, job: res.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/jobs error:", error);
    return NextResponse.json(
      { error: "Failed to create job post" },
      { status: 500 }
    );
  }
}
