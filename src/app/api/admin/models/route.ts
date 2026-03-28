import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { models, providers, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { validateSession } from "../auth/route";

const VALID_EVAL_TIERS = ["active", "standard", "maintenance", "paused"] as const;
type EvalTier = (typeof VALID_EVAL_TIERS)[number];

/**
 * GET /api/admin/models
 * List all models with their evaluation status
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
    // Get all models with providers
    const allModels = await db
      .select({
        id: models.id,
        name: models.name,
        slug: models.slug,
        isActive: models.isActive,
        provider: providers.name,
      })
      .from(models)
      .innerJoin(providers, eq(models.providerId, providers.id))
      .where(eq(models.isActive, true))
      .orderBy(models.name);

    // Check which models have scores and get latest eval info
    const modelsWithStatus = await Promise.all(
      allModels.map(async (model) => {
        const [latestScore] = await db
          .select({
            id: scores.id,
            overallScore: scores.overallScore,
            overallGrade: scores.overallGrade,
            computedAt: scores.computedAt,
          })
          .from(scores)
          .where(eq(scores.modelId, model.id))
          .orderBy(desc(scores.computedAt))
          .limit(1);

        return {
          ...model,
          hasScore: !!latestScore,
          latestScore: latestScore?.overallScore ?? null,
          latestGrade: latestScore?.overallGrade ?? null,
          latestEvalDate: latestScore?.computedAt?.toISOString() ?? null,
        };
      })
    );

    // Sort: unevaluated first, then oldest evaluated first
    modelsWithStatus.sort((a, b) => {
      // Unevaluated models come first
      if (!a.latestEvalDate && b.latestEvalDate) return -1;
      if (a.latestEvalDate && !b.latestEvalDate) return 1;
      // Both unevaluated: sort by name
      if (!a.latestEvalDate && !b.latestEvalDate) {
        return a.name.localeCompare(b.name);
      }
      // Both evaluated: oldest first
      return new Date(a.latestEvalDate!).getTime() - new Date(b.latestEvalDate!).getTime();
    });

    return NextResponse.json({ models: modelsWithStatus });
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/models
 * Update model properties (e.g., evalTier)
 */
export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const { id, evalTier } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      );
    }

    // Validate evalTier if provided
    if (evalTier !== undefined) {
      if (!VALID_EVAL_TIERS.includes(evalTier)) {
        return NextResponse.json(
          { error: `Invalid evalTier. Must be one of: ${VALID_EVAL_TIERS.join(", ")}` },
          { status: 400 }
        );
      }

      await db
        .update(models)
        .set({ evalTier: evalTier as EvalTier, updatedAt: new Date() })
        .where(eq(models.id, id));

      return NextResponse.json({ success: true, evalTier });
    }

    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to update model:", error);
    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 }
    );
  }
}
