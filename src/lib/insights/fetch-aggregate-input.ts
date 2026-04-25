/**
 * Loads the rows required by `buildAggregate` from the DB (parentbench-ov1.1).
 *
 * Kept in a separate file so `buildAggregate` stays a pure function and is
 * trivially unit-testable with synthetic fixtures.
 */

import { db } from "@/db";
import { models, providers, scores, evaluations } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AggregatorInput } from "./build-aggregate";

export async function fetchAggregateInput(asOf: Date, windowDays = 30): Promise<AggregatorInput> {
  const cutoff = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Active models with their provider name
  const activeRows = await db
    .select({
      modelId: models.id,
      slug: models.slug,
      name: models.name,
      provider: providers.name,
      evalTier: models.evalTier,
      isActive: models.isActive,
      createdAt: models.createdAt,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.isActive, true), eq(models.evalTier, "active")));

  const activeModels = activeRows.map((r) => ({
    modelId: r.modelId,
    slug: r.slug,
    name: r.name,
    provider: r.provider,
    evalTier: r.evalTier as AggregatorInput["activeModels"][number]["evalTier"],
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));

  // Latest score per active model (correlated subquery via window function)
  const latestRows = activeModels.length
    ? await db.execute(sql`
        SELECT DISTINCT ON ("model_id")
          "model_id" AS "modelId",
          "overall_score" AS "overallScore",
          "computed_at" AS "computedAt",
          "category_scores" AS "categoryScores"
        FROM "scores"
        WHERE "model_id" IN (${sql.join(
          activeModels.map((m) => sql`${m.modelId}`),
          sql`, `
        )})
        ORDER BY "model_id", "computed_at" DESC
      `)
    : { rows: [] as Array<{ modelId: string; overallScore: number; computedAt: Date; categoryScores: unknown }> };

  const latestScores = (latestRows.rows as Array<{
    modelId: string;
    overallScore: number;
    computedAt: Date;
    categoryScores: AggregatorInput["latestScores"][number]["categoryScores"];
  }>).map((r) => ({
    modelId: r.modelId,
    overallScore: Number(r.overallScore),
    computedAt: r.computedAt,
    categoryScores: r.categoryScores ?? [],
  }));

  // Previous score per active model (the row immediately before the latest)
  const previousScores: AggregatorInput["previousScores"] = [];
  for (const m of activeModels) {
    const rows = await db
      .select({ overallScore: scores.overallScore })
      .from(scores)
      .where(eq(scores.modelId, m.modelId))
      .orderBy(desc(scores.computedAt))
      .limit(2);
    if (rows.length === 2) {
      previousScores.push({ modelId: m.modelId, overallScore: Number(rows[1].overallScore) });
    }
  }

  // Eval count in window — across all models, not just active
  const evalCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(evaluations)
    .where(and(eq(evaluations.status, "completed"), gte(evaluations.completedAt, cutoff)));
  const evalsLast30d = evalCountRows[0]?.count ?? 0;

  return {
    asOf,
    windowDays,
    activeModels,
    latestScores,
    previousScores,
    evalsLast30d,
  };
}
