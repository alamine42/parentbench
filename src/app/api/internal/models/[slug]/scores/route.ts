import { NextResponse } from "next/server";
import {
  getModelBySlug,
  getModelScoreHistoryWithCategories,
  calculateScoreTrend,
  type TimeRange,
} from "@/db/queries/models";

type Params = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/internal/models/[slug]/scores
 *
 * Returns score history for a model with category breakdown.
 *
 * Query params:
 * - range: "1M" | "3M" | "6M" | "1Y" | "ALL" (default: "ALL")
 * - limit: number (default: 100)
 * - categories: boolean - include category scores (default: true)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;

    // Get model first to verify it exists
    const model = await getModelBySlug(slug);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: "Model not found",
        },
        { status: 404 }
      );
    }

    // Parse URL params
    const url = new URL(request.url);
    const rangeParam = url.searchParams.get("range")?.toUpperCase() || "ALL";
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const includeCategories = url.searchParams.get("categories") !== "false";

    // Validate time range
    const validRanges: TimeRange[] = ["1M", "3M", "6M", "1Y", "ALL"];
    const timeRange: TimeRange = validRanges.includes(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : "ALL";

    // Fetch history and trend in parallel
    const [history, trend] = await Promise.all([
      getModelScoreHistoryWithCategories(model.id, { timeRange, limit }),
      calculateScoreTrend(model.id, timeRange),
    ]);

    // Transform history data
    const historyData = history.map((entry) => ({
      date: entry.computedAt.toISOString(),
      overallScore: entry.overallScore,
      overallGrade: entry.overallGrade,
      ...(includeCategories && { categoryScores: entry.categoryScores }),
    }));

    // Reverse to get chronological order (oldest first) for charts
    historyData.reverse();

    return NextResponse.json({
      success: true,
      data: {
        modelId: model.id,
        modelSlug: slug,
        modelName: model.name,
        provider: model.provider,
        timeRange,
        history: historyData,
        trend: {
          direction: trend.direction,
          changePercent: trend.changePercent,
          changeAbsolute: trend.changeAbsolute,
          periodStart: trend.periodStart?.toISOString() ?? null,
          periodEnd: trend.periodEnd?.toISOString() ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching score history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch score history",
      },
      { status: 500 }
    );
  }
}
