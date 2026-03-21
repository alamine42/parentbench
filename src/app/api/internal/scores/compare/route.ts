import { NextResponse } from "next/server";
import { getModelsForComparison } from "@/db/queries/models";
import type { ParentBenchCategory } from "@/types/parentbench";

/**
 * GET /api/internal/scores/compare
 *
 * Compare multiple models' safety scores.
 *
 * Query params:
 * - models: comma-separated list of model slugs (2-4 models)
 *
 * Example: /api/internal/scores/compare?models=gpt-4o,claude-3-5-sonnet,gemini-pro
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const modelsParam = url.searchParams.get("models");

    if (!modelsParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing 'models' query parameter",
        },
        { status: 400 }
      );
    }

    const modelSlugs = modelsParam.split(",").map((s) => s.trim()).filter(Boolean);

    if (modelSlugs.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "At least 2 models required for comparison",
        },
        { status: 400 }
      );
    }

    if (modelSlugs.length > 4) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum 4 models allowed for comparison",
        },
        { status: 400 }
      );
    }

    // Fetch all models with scores
    const models = await getModelsForComparison(modelSlugs);

    if (models.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not find enough valid models for comparison",
          foundModels: models.map((m) => m.slug),
        },
        { status: 404 }
      );
    }

    // Build category comparison data
    const categories: ParentBenchCategory[] = [
      "age_inappropriate_content",
      "manipulation_resistance",
      "data_privacy_minors",
      "parental_controls_respect",
    ];

    const categoryComparison: Record<
      string,
      Array<{
        modelSlug: string;
        score: number;
        grade: string;
        passRate: number;
        isBest: boolean;
      }>
    > = {};

    for (const category of categories) {
      const categoryData = models.map((model) => {
        const categoryScore = model.latestScore?.categoryScores.find(
          (cs) => cs.category === category
        );
        return {
          modelSlug: model.slug,
          score: categoryScore?.score ?? 0,
          grade: categoryScore?.grade ?? "F",
          passRate: categoryScore?.passRate ?? 0,
          isBest: false, // Will be set below
        };
      });

      // Find best score for this category
      const maxScore = Math.max(...categoryData.map((d) => d.score));
      categoryData.forEach((d) => {
        // Mark as best if within 1 point of max (allow ties)
        d.isBest = d.score >= maxScore - 1 && d.score > 0;
      });

      categoryComparison[category] = categoryData;
    }

    // Determine overall best model
    const overallScores = models.map((m) => ({
      slug: m.slug,
      score: m.latestScore?.overallScore ?? 0,
    }));
    const maxOverallScore = Math.max(...overallScores.map((s) => s.score));
    const overallBest = overallScores.filter((s) => s.score >= maxOverallScore - 1);

    return NextResponse.json({
      success: true,
      data: {
        models: models.map((model) => ({
          id: model.id,
          slug: model.slug,
          name: model.name,
          provider: model.provider,
          latestScore: model.latestScore
            ? {
                overallScore: model.latestScore.overallScore,
                overallGrade: model.latestScore.overallGrade,
                trend: model.latestScore.trend,
                dataQuality: model.latestScore.dataQuality,
                computedAt: model.latestScore.computedAt.toISOString(),
                categoryScores: model.latestScore.categoryScores,
              }
            : null,
          isOverallBest: overallBest.some((b) => b.slug === model.slug),
        })),
        categoryComparison,
        comparisonDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error comparing models:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to compare models",
      },
      { status: 500 }
    );
  }
}
