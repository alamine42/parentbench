import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models, providers, evaluations } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export type EvalTier = "active" | "standard" | "maintenance" | "paused";

export type ScheduledModel = {
  id: string;
  name: string;
  slug: string;
  providerName: string;
  providerLogo: string | null;
  evalTier: EvalTier;
  isActive: boolean;
  lastEvalDate: string | null;
};

export type SchedulingData = {
  tiers: {
    active: ScheduledModel[];
    standard: ScheduledModel[];
    maintenance: ScheduledModel[];
    paused: ScheduledModel[];
  };
  nextRuns: {
    active: string;
    standard: string;
    maintenance: string;
  };
};

/**
 * Calculate the next run time for each tier based on cron schedules
 */
function calculateNextRuns(): SchedulingData["nextRuns"] {
  const now = new Date();

  // Active tier: Weekly on Monday at 2:00 AM UTC
  const nextActive = new Date(now);
  nextActive.setUTCHours(2, 0, 0, 0);
  const activeDay = nextActive.getUTCDay();
  const daysUntilMonday = activeDay === 1 && nextActive > now
    ? 0
    : ((1 - activeDay + 7) % 7) || 7;
  nextActive.setUTCDate(nextActive.getUTCDate() + (activeDay === 1 && nextActive > now ? 0 : daysUntilMonday));

  // Standard tier: 1st & 15th of month at 2:00 AM UTC
  const nextStandard = new Date(now);
  nextStandard.setUTCHours(2, 0, 0, 0);
  const currentDate = nextStandard.getUTCDate();
  if (currentDate < 1 || (currentDate === 1 && nextStandard > now)) {
    nextStandard.setUTCDate(1);
  } else if (currentDate < 15 || (currentDate === 15 && nextStandard > now)) {
    nextStandard.setUTCDate(15);
  } else {
    // Next 1st of following month
    nextStandard.setUTCMonth(nextStandard.getUTCMonth() + 1);
    nextStandard.setUTCDate(1);
  }

  // Maintenance tier: 1st of month at 2:00 AM UTC
  const nextMaintenance = new Date(now);
  nextMaintenance.setUTCHours(2, 0, 0, 0);
  nextMaintenance.setUTCDate(1);
  if (nextMaintenance <= now) {
    nextMaintenance.setUTCMonth(nextMaintenance.getUTCMonth() + 1);
  }

  return {
    active: nextActive.toISOString(),
    standard: nextStandard.toISOString(),
    maintenance: nextMaintenance.toISOString(),
  };
}

/**
 * GET /api/admin/scheduling
 * Fetch all models grouped by their evaluation tier
 */
export async function GET() {
  try {
    // Get all models with their providers and last evaluation
    const allModels = await db
      .select({
        id: models.id,
        name: models.name,
        slug: models.slug,
        evalTier: models.evalTier,
        isActive: models.isActive,
        providerName: providers.name,
        providerLogo: providers.logoUrl,
      })
      .from(models)
      .innerJoin(providers, eq(models.providerId, providers.id))
      .orderBy(models.name);

    // Get last evaluation date for each model
    const modelIds = allModels.map((m) => m.id);
    const lastEvals = await db
      .select({
        modelId: evaluations.modelId,
        completedAt: evaluations.completedAt,
      })
      .from(evaluations)
      .where(
        and(
          inArray(evaluations.modelId, modelIds),
          eq(evaluations.status, "completed")
        )
      )
      .orderBy(desc(evaluations.completedAt));

    // Build map of model -> last eval date
    const lastEvalMap = new Map<string, string | null>();
    for (const eval_ of lastEvals) {
      if (!lastEvalMap.has(eval_.modelId)) {
        lastEvalMap.set(
          eval_.modelId,
          eval_.completedAt?.toISOString().split("T")[0] ?? null
        );
      }
    }

    // Group models by tier
    const tiers: SchedulingData["tiers"] = {
      active: [],
      standard: [],
      maintenance: [],
      paused: [],
    };

    for (const model of allModels) {
      const scheduledModel: ScheduledModel = {
        id: model.id,
        name: model.name,
        slug: model.slug,
        providerName: model.providerName,
        providerLogo: model.providerLogo,
        evalTier: model.evalTier as EvalTier,
        isActive: model.isActive,
        lastEvalDate: lastEvalMap.get(model.id) ?? null,
      };

      tiers[model.evalTier as EvalTier].push(scheduledModel);
    }

    const data: SchedulingData = {
      tiers,
      nextRuns: calculateNextRuns(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch scheduling data:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduling data" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/scheduling
 * Update a model's evaluation tier
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, evalTier } = body;

    if (!modelId || !evalTier) {
      return NextResponse.json(
        { error: "modelId and evalTier are required" },
        { status: 400 }
      );
    }

    const validTiers: EvalTier[] = ["active", "standard", "maintenance", "paused"];
    if (!validTiers.includes(evalTier)) {
      return NextResponse.json(
        { error: "Invalid evalTier. Must be one of: active, standard, maintenance, paused" },
        { status: 400 }
      );
    }

    await db
      .update(models)
      .set({
        evalTier,
        updatedAt: new Date(),
      })
      .where(eq(models.id, modelId));

    return NextResponse.json({ success: true, modelId, evalTier });
  } catch (error) {
    console.error("Failed to update model tier:", error);
    return NextResponse.json(
      { error: "Failed to update model tier" },
      { status: 500 }
    );
  }
}
