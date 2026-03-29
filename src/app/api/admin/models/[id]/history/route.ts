import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { models, providers, evaluations, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { validateSession } from "../../../auth/route";

/**
 * GET /api/admin/models/[id]/history
 * Get historical scores and evaluations for a model
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    // Get model info
    const [model] = await db
      .select({
        id: models.id,
        name: models.name,
        slug: models.slug,
        description: models.description,
        isActive: models.isActive,
        evalTier: models.evalTier,
        provider: {
          id: providers.id,
          name: providers.name,
          slug: providers.slug,
        },
      })
      .from(models)
      .innerJoin(providers, eq(models.providerId, providers.id))
      .where(eq(models.id, id))
      .limit(1);

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Get all scores for this model (historical trend)
    const allScores = await db
      .select({
        id: scores.id,
        overallScore: scores.overallScore,
        overallGrade: scores.overallGrade,
        trend: scores.trend,
        dataQuality: scores.dataQuality,
        categoryScores: scores.categoryScores,
        computedAt: scores.computedAt,
        evaluationId: scores.evaluationId,
      })
      .from(scores)
      .where(eq(scores.modelId, id))
      .orderBy(desc(scores.computedAt));

    // Get all evaluations for this model
    const allEvaluations = await db
      .select({
        id: evaluations.id,
        status: evaluations.status,
        triggeredBy: evaluations.triggeredBy,
        inngestRunId: evaluations.inngestRunId,
        startedAt: evaluations.startedAt,
        completedAt: evaluations.completedAt,
        totalTestCases: evaluations.totalTestCases,
        completedTestCases: evaluations.completedTestCases,
        failedTestCases: evaluations.failedTestCases,
        errorMessage: evaluations.errorMessage,
        inputTokens: evaluations.inputTokens,
        outputTokens: evaluations.outputTokens,
        totalCostUsd: evaluations.totalCostUsd,
        createdAt: evaluations.createdAt,
      })
      .from(evaluations)
      .where(eq(evaluations.modelId, id))
      .orderBy(desc(evaluations.createdAt));

    // Compute statistics
    const completedEvals = allEvaluations.filter(e => e.status === "completed");
    const failedEvals = allEvaluations.filter(e => e.status === "failed");
    const totalCost = allEvaluations.reduce((sum, e) => sum + (e.totalCostUsd || 0), 0);

    // Score trend data for charting
    const scoreTrend = allScores.map(s => ({
      date: s.computedAt?.toISOString().split("T")[0] ?? "",
      score: s.overallScore,
      grade: s.overallGrade,
    })).reverse(); // Oldest first for charting

    return NextResponse.json({
      model,
      scores: allScores,
      evaluations: allEvaluations,
      stats: {
        totalEvaluations: allEvaluations.length,
        completedEvaluations: completedEvals.length,
        failedEvaluations: failedEvals.length,
        totalCostUsd: totalCost,
        latestScore: allScores[0] ?? null,
        scoreRange: allScores.length > 0
          ? {
              min: Math.min(...allScores.map(s => s.overallScore)),
              max: Math.max(...allScores.map(s => s.overallScore)),
              avg: allScores.reduce((sum, s) => sum + s.overallScore, 0) / allScores.length,
            }
          : null,
      },
      scoreTrend,
    });
  } catch (error) {
    console.error("Failed to fetch model history:", error);
    return NextResponse.json(
      { error: "Failed to fetch model history" },
      { status: 500 }
    );
  }
}
