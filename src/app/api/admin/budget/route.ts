import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../auth/route";
import { getBudgetStatus, setBudgetAlert } from "@/lib/costs";

/**
 * GET /api/admin/budget
 * Get current budget status
 */
export async function GET() {
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
    const status = await getBudgetStatus();
    return NextResponse.json({ budget: status });
  } catch (error) {
    console.error("Failed to fetch budget status:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/budget
 * Set budget alert threshold
 *
 * Body:
 * - thresholdUsd: number
 * - periodDays: number (7, 30, or 90)
 * - name?: string
 */
export async function POST(request: NextRequest) {
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
    const { thresholdUsd, periodDays, name } = await request.json();

    if (typeof thresholdUsd !== "number" || thresholdUsd <= 0) {
      return NextResponse.json(
        { error: "thresholdUsd must be a positive number" },
        { status: 400 }
      );
    }

    if (![7, 30, 90].includes(periodDays)) {
      return NextResponse.json(
        { error: "periodDays must be 7, 30, or 90" },
        { status: 400 }
      );
    }

    await setBudgetAlert(thresholdUsd, periodDays, name);

    return NextResponse.json({
      success: true,
      message: `Budget alert set: $${thresholdUsd} per ${periodDays} days`,
    });
  } catch (error) {
    console.error("Failed to set budget alert:", error);
    return NextResponse.json(
      { error: "Failed to set budget alert" },
      { status: 500 }
    );
  }
}
