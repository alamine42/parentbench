import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../../auth/route";
import { estimateCost } from "@/lib/costs";

/**
 * GET /api/admin/costs/estimate?modelId=xxx
 * Get cost estimate for running an evaluation on a model
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin authentication not configured" },
      { status: 500 }
    );
  }

  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: "modelId is required" },
        { status: 400 }
      );
    }

    const estimate = await estimateCost(modelId);

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Failed to estimate cost:", error);
    return NextResponse.json(
      { error: "Failed to estimate cost" },
      { status: 500 }
    );
  }
}
