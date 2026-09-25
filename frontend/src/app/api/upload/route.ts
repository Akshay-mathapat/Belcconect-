import { NextResponse } from "next/server";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { getAuthenticatedUser } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  // 1. Rate Limiting Check (Max 10 upload attempts per 15 minutes)
  const rateLimit = checkRateLimit(req, 10, 15 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  // 2. Authentication Check: Reject unauthenticated requests
  const authUser = getAuthenticatedUser(req);
  if (!authUser && process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Validate mime type (allow images and PDFs)
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File type not supported. Upload image or PDF." }, { status: 400 });
    }

    const userId = authUser?.userId ? authUser.userId.replace(/[^a-zA-Z0-9_-]/g, "_") : "guest";
    const sanitizeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const blobPathname = `chat-attachments/${userId}/${Date.now()}-${randomSuffix}-${sanitizeFilename}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const blob = await put(blobPathname, buffer, {
      access: "private",
      contentType: file.type
    });

    const applicationUrl = `/api/attachments/${blob.pathname}`;
    return NextResponse.json({
      url: applicationUrl,
      fileName: file.name,
      fileType: file.type,
      size: file.size
    });
  } catch (error: any) {
    console.error("Upload error:", error?.message || "Storage error");
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
