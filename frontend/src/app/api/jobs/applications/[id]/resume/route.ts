import { NextResponse } from "next/server";
import { query, isDatabaseUnavailableError } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const applicationId = resolvedParams.id;

    if (!applicationId) {
      return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
    }

    // Authorization & ownership check
    const sql = `
      SELECT 
        ja.id,
        ja.candidate_id,
        ja.resume_path,
        ja.resume_url,
        ja.resume_filename,
        ja.resume_mime,
        j.job_provider_id
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.id = $1
      LIMIT 1;
    `;

    const res = await query(sql, [applicationId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = res.rows[0];

    const isCandidateOwner = app.candidate_id === authUser.userId;
    const isEmployerOwner = app.job_provider_id === authUser.userId;
    const isAdmin = authUser.role === "admin";

    if (!isCandidateOwner && !isEmployerOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view or download this resume" },
        { status: 403 }
      );
    }

    const targetUrl = app.resume_path || app.resume_url;
    if (!targetUrl) {
      return NextResponse.json({ error: "No resume on file for this application" }, { status: 404 });
    }

    const filename = app.resume_filename || `resume-${applicationId}.pdf`;
    const mime = app.resume_mime || "application/pdf";

    // 1. Remote Vercel Blob / Cloud Storage URL handling
    if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
      const blobResponse = await fetch(targetUrl);
      if (!blobResponse.ok) {
        return NextResponse.json({ error: "Failed to retrieve resume file from cloud storage" }, { status: 502 });
      }

      const blobData = await blobResponse.arrayBuffer();
      return new NextResponse(blobData, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    // 2. PostgreSQL Database-backed resume handling (/api/jobs/resumes/res_... or res_...)
    if (targetUrl.includes("/api/jobs/resumes/") || targetUrl.startsWith("res_")) {
      try {
        const { getResumeFromDatabase } = await import("@/lib/jobResumes");
        const resumeId = targetUrl.replace(/^\/api\/jobs\/resumes\//, "").trim();
        const dbRecord = await getResumeFromDatabase(resumeId);

        if (dbRecord) {
          return new NextResponse(new Uint8Array(dbRecord.buffer), {
            status: 200,
            headers: {
              "Content-Type": dbRecord.mime || mime,
              "Content-Disposition": `attachment; filename="${encodeURIComponent(dbRecord.filename || filename)}"`,
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
            },
          });
        }
      } catch (dbErr: any) {
        console.warn("Database resume retrieval warning:", dbErr?.message || dbErr);
      }
    }

    // 3. Base64 Data URL handling (data:application/pdf;base64,...)
    if (targetUrl.startsWith("data:")) {
      const commaIdx = targetUrl.indexOf(",");
      if (commaIdx !== -1) {
        const base64Data = targetUrl.substring(commaIdx + 1);
        const fileBuffer = Buffer.from(base64Data, "base64");
        return new NextResponse(new Uint8Array(fileBuffer), {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        });
      }
    }

    // 4. Local Filesystem path handling (/uploads/job-resumes/...)
    const relativePath = targetUrl.startsWith("/") ? targetUrl.slice(1) : targetUrl;
    const fullPath = path.join(process.cwd(), "public", relativePath);

    if (fs.existsSync(fullPath)) {
      const fileBuffer = await fs.promises.readFile(fullPath);
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    // 5. Fallback: Search PostgreSQL for candidate's latest uploaded resume
    try {
      const { getLatestResumeByUser } = await import("@/lib/jobResumes");
      const fallbackRecord = await getLatestResumeByUser(app.candidate_id);
      if (fallbackRecord) {
        return new NextResponse(new Uint8Array(fallbackRecord.buffer), {
          status: 200,
          headers: {
            "Content-Type": fallbackRecord.mime || mime,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fallbackRecord.filename || filename)}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        });
      }
    } catch (_) {}

    return NextResponse.json({ error: "Resume file not found on storage" }, { status: 404 });
  } catch (error: any) {
    console.error("GET /api/jobs/applications/[id]/resume error:", error);
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({ error: "Database temporarily unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to download resume" }, { status: 500 });
  }
}
