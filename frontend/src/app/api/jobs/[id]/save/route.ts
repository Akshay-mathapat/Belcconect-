import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// ── POST /api/jobs/[id]/save — Toggle Save / Bookmark Job (Candidate) ─────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to bookmark jobs" },
        { status: 401 }
      );
    }

    const { id: jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // Check if already saved
    const existing = await query(
      `SELECT id FROM job_saved_jobs WHERE user_id = $1 AND job_id = $2 LIMIT 1`,
      [authUser.userId, jobId]
    );

    if (existing.rows.length > 0) {
      // Remove bookmark
      await query(
        `DELETE FROM job_saved_jobs WHERE user_id = $1 AND job_id = $2`,
        [authUser.userId, jobId]
      );
      return NextResponse.json({ saved: false, message: "Job removed from bookmarks" });
    } else {
      // Add bookmark
      const saveId = `saved_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await query(
        `INSERT INTO job_saved_jobs (id, user_id, job_id, created_at) VALUES ($1, $2, $3, NOW())`,
        [saveId, authUser.userId, jobId]
      );
      return NextResponse.json({ saved: true, message: "Job bookmarked successfully" });
    }
  } catch (error: any) {
    console.error("POST /api/jobs/[id]/save error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to update saved job status" },
      { status: 500 }
    );
  }
}
