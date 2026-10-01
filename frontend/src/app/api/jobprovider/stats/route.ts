import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── GET /api/jobprovider/stats — Real Live Employer Dashboard Metrics ──────
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
        { error: "Forbidden: Only job providers can access employer stats" },
        { status: 403 }
      );
    }

    const providerId = authUser.userId;

    // 1. KPI Counts
    const countsSql = `
      SELECT
        (SELECT COUNT(*)::int FROM jobs WHERE job_provider_id = $1 AND status = 'active') AS active_jobs,
        (SELECT COUNT(ja.id)::int FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE j.job_provider_id = $1) AS total_applicants,
        (SELECT COUNT(ja.id)::int FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE j.job_provider_id = $1 AND ja.status = 'new') AS new_applicants,
        (SELECT COUNT(*)::int FROM job_interviews WHERE job_provider_id = $1 AND status = 'scheduled') AS scheduled_interviews,
        (SELECT COUNT(ja.id)::int FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE j.job_provider_id = $1 AND ja.status = 'hired') AS candidates_hired
    `;
    const countsRes = await query(countsSql, [providerId]);
    const metrics = countsRes.rows[0] || {
      active_jobs: 0,
      total_applicants: 0,
      new_applicants: 0,
      scheduled_interviews: 0,
      candidates_hired: 0,
    };

    // 2. Recent Applications (Top 5)
    const recentAppsSql = `
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
        ja.status,
        ja.created_at,
        j.title AS job_title,
        c.avatar AS candidate_avatar
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      LEFT JOIN customers c ON ja.candidate_id = c.id
      WHERE j.job_provider_id = $1
      ORDER BY ja.created_at DESC
      LIMIT 5;
    `;
    const recentAppsRes = await query(recentAppsSql, [providerId]);

    // 3. Upcoming Interviews (Top 5)
    const upcomingInterviewsSql = `
      SELECT 
        ji.id,
        ji.job_id,
        ji.application_id,
        ji.candidate_name,
        ji.job_title,
        ji.interview_date,
        ji.interview_time,
        ji.interview_mode,
        ji.meeting_link,
        ji.location_details,
        ji.status
      FROM job_interviews ji
      WHERE ji.job_provider_id = $1 AND ji.status = 'scheduled'
      ORDER BY ji.interview_date ASC, ji.interview_time ASC
      LIMIT 5;
    `;
    const interviewsRes = await query(upcomingInterviewsSql, [providerId]);

    // 4. Active Job Listings (Top 5)
    const activeJobsSql = `
      SELECT 
        j.id,
        j.title,
        j.location,
        j.job_type,
        j.work_mode,
        j.salary_type,
        j.salary_text,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.status,
        j.created_at,
        j.deadline,
        (SELECT COUNT(*)::int FROM job_applications ja WHERE ja.job_id = j.id) AS applicants_count
      FROM jobs j
      WHERE j.job_provider_id = $1
      ORDER BY j.created_at DESC
      LIMIT 5;
    `;
    const activeJobsRes = await query(activeJobsSql, [providerId]);

    return NextResponse.json({
      metrics: {
        activeJobs: metrics.active_jobs,
        totalApplicants: metrics.total_applicants,
        newApplicants: metrics.new_applicants,
        interviewsScheduled: metrics.scheduled_interviews,
        candidatesHired: metrics.candidates_hired,
      },
      recentApplications: recentAppsRes.rows,
      upcomingInterviews: interviewsRes.rows,
      activeJobListings: activeJobsRes.rows,
    });
  } catch (error: any) {
    console.error("GET /api/jobprovider/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
