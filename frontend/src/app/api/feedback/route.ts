import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

const ALLOWED_FEEDBACK_CATEGORIES = [
  "general",
  "booking_flow",
  "calling_chat",
  "location_tracking",
  "provider_quality",
  "feature_request"
];

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { category, rating, message } = body;

    const normalizedCategory = typeof category === "string" ? category.trim().toLowerCase() : "";
    if (!normalizedCategory || !ALLOWED_FEEDBACK_CATEGORIES.includes(normalizedCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${ALLOWED_FEEDBACK_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let parsedRating: number | null = null;
    if (rating !== undefined && rating !== null) {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json(
          { error: "Rating must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
      parsedRating = r;
    }

    const feedbackId = `fb-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const cleanMessage = message.trim().slice(0, 3000);
    const userRole = authUser.role || "user";

    await query(
      `INSERT INTO app_feedback (id, user_id, user_role, category, rating, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        feedbackId,
        authUser.userId,
        userRole,
        normalizedCategory,
        parsedRating,
        cleanMessage
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! It helps us improve BelConnect."
    });
  } catch (error: any) {
    console.error("Error submitting app feedback:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
