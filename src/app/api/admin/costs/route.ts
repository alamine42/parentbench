import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../auth/route";
import {
  getCostSummary,
  getCostsByModel,
  getCostTimeSeries,
  getBudgetStatus,
  getBudgetAlertHistory,
} from "@/lib/costs";

/**
 * GET /api/admin/costs
 * Fetch cost analytics data
 *
 * Query params:
 * - period: 7, 30, or 90 (days)
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
    const periodParam = searchParams.get("period");
    const periodDays = periodParam ? parseInt(periodParam, 10) : 30;

    // Validate period
    if (![7, 30, 90].includes(periodDays)) {
      return NextResponse.json(
        { error: "Invalid period. Must be 7, 30, or 90" },
        { status: 400 }
      );
    }

    // Fetch all cost data in parallel
    const [summary, byModel, timeSeries, budgetStatus, alertHistory] = await Promise.all([
      getCostSummary(periodDays),
      getCostsByModel(periodDays),
      getCostTimeSeries(periodDays),
      getBudgetStatus(),
      getBudgetAlertHistory(10),
    ]);

    return NextResponse.json({
      summary,
      byModel,
      timeSeries,
      budget: budgetStatus,
      alertHistory,
    });
  } catch (error) {
    console.error("Failed to fetch cost data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}
