import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized: Administrator privileges required." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: authUser.userId,
        email: authUser.email,
        role: authUser.role
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to verify session." },
      { status: 500 }
    );
  }
}

