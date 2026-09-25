import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getAuthenticatedUser } from "@/lib/jwt";
import { query } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pathname: string[] }> }
) {
  try {
    const { pathname: pathSegments } = await params;

    if (!pathSegments || !Array.isArray(pathSegments) || pathSegments.length === 0) {
      return NextResponse.json({ error: "Missing attachment path" }, { status: 400 });
    }

    const blobPathname = pathSegments.join("/");

    // 1. Enforce strict prefix
    if (!blobPathname.startsWith("chat-attachments/")) {
      return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
    }

    // 2. Reject path traversal, backslashes, double slashes, protocols, encoded chars
    if (
      blobPathname.includes("..") ||
      blobPathname.includes("//") ||
      blobPathname.includes("\\") ||
      blobPathname.includes(":") ||
      blobPathname.includes("%")
    ) {
      return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
    }

    // 3. Strict character whitelist
    if (!/^chat-attachments\/[a-zA-Z0-9._\/-]+$/.test(blobPathname)) {
      return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
    }

    // 4. Authenticate requester using existing session / cookie / header authentication
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication session" },
        { status: 401 }
      );
    }

    // 5. Participant authorization check
    let isAuthorized = false;

    if (authUser.role === "admin") {
      isAuthorized = true;
    } else if (authUser.userId) {
      // Fast path: if path format is chat-attachments/<userId>/... and requester matches uploader
      if (pathSegments.length >= 3 && pathSegments[1] === authUser.userId) {
        isAuthorized = true;
      } else {
        // Recipient path: verify requester is a participant in the conversation containing this attachment
        try {
          const appUrl = `/api/attachments/${blobPathname}`;
          const msgCheck = await query(
            `SELECT m.sender_id, c.customer_id, c.provider_id
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE m.media_url = $1
             LIMIT 1`,
            [appUrl]
          );

          if (msgCheck.rows.length > 0) {
            const row = msgCheck.rows[0];
            if (
              authUser.userId === row.customer_id ||
              authUser.userId === row.provider_id ||
              authUser.userId === row.sender_id
            ) {
              isAuthorized = true;
            }
          }
        } catch (dbErr: any) {
          console.error("Attachment participant check error:", dbErr?.message || "Database query failed");
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Not authorized to view this attachment" },
        { status: 403 }
      );
    }

    // 6. Fetch from private Vercel Blob
    let blobResult: any = null;
    try {
      blobResult = await get(blobPathname, { access: "private" });
    } catch (err: any) {
      if (err?.name === "BlobNotFoundError" || err?.message?.includes("not found")) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }
      console.error("Blob retrieval error:", err?.message || "Storage error");
      return NextResponse.json({ error: "Failed to retrieve attachment" }, { status: 500 });
    }

    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // 7. Construct safe response with headers
    const contentType = blobResult.blob.contentType || "application/octet-stream";
    const filename = pathSegments[pathSegments.length - 1] || "attachment";

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("Content-Disposition", `inline; filename="${filename}"`);
    responseHeaders.set("Cache-Control", "private, max-age=3600");

    if (blobResult.blob.size) {
      responseHeaders.set("Content-Length", String(blobResult.blob.size));
    }

    return new Response(blobResult.stream, {
      status: 200,
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error("Attachment retrieval error:", error?.message || "Internal error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
