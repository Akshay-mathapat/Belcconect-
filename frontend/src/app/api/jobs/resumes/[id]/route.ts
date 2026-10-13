import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/jwt";
import { query, isDatabaseUnavailableError } from "@/lib/db";
import { getResumeFromDatabase } from "@/lib/jobResumes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const resumeId = resolvedParams.id?.trim();

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    // Retrieve from PostgreSQL database
    const record = await getResumeFromDatabase(resumeId);
    if (!record) {
      return NextResponse.json({ error: "Resume file not found" }, { status: 404 });
    }

    // Authorization: owner, admin, or employer with an application referencing this resume
    const isOwner = record.userId === authUser.userId;
    const isAdmin = authUser.role === "admin";
    let isAuthorizedEmployer = false;

    if (!isOwner && !isAdmin) {
      try {
        const pattern = `%${resumeId}%`;
        const check = await query(
          `SELECT 1 FROM job_applications ja
           JOIN jobs j ON ja.job_id = j.id
           WHERE j.job_provider_id = $1
             AND (ja.resume_path LIKE $2 OR ja.resume_url LIKE $2)
           LIMIT 1`,
          [authUser.userId, pattern]
        );
        if (check.rows.length > 0) {
          isAuthorizedEmployer = true;
        }
      } catch (err: any) {
        console.warn("Authorization check warning:", err?.message || err);
      }
    }

    if (!isOwner && !isAdmin && !isAuthorizedEmployer) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view or download this resume" },
        { status: 403 }
      );
    }

    const filename = record.filename || `resume-${resumeId}.pdf`;
    const mime = record.mime || "application/pdf";

    return new NextResponse(new Uint8Array(record.buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("GET /api/jobs/resumes/[id] error:", error);
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ error: "Database temporarily unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to download resume" }, { status: 500 });
  }
}

