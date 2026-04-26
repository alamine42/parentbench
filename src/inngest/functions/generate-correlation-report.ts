/**
 * Capability correlation report generator (parentbench-rg1.2).
 *
 * Quarterly cron + manual admin trigger. Loads live capability rows
 * and the latest ParentBench score per active model, runs the pure
 * `computeCorrelationReport`, and inserts the resulting row into
 * `correlation_reports` (or no-ops on insufficient data).
 *
 * Triggers:
 *   - cron 0 5 1 1,4,7,10 *   — quarterly, 5am UTC on the 1st of
 *                               Jan / Apr / Jul / Oct (after Monday
 *                               active-tier evals have settled)
 *   - event "correlation/regenerate-requested" — admin manual trigger
 */

import { revalidatePath } from "next/cache";
import { eq, isNull, desc, and } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/db";
import {
  correlationReports,
  modelCapabilityScores,
  models,
  scores,
} from "@/db/schema";
import { computeCorrelationReport } from "@/lib/capability/compute-correlation";
import type { LiveCapabilityScore } from "@/lib/capability/build-capability-score";
import { getParentBenchMethodology } from "@/lib/parentbench";

export const generateCorrelationReport = inngest.createFunction(
  {
    id: "generate-correlation-report",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [
      { cron: "0 5 1 1,4,7,10 *" },
      { event: "correlation/regenerate-requested" },
    ],
  },
  async ({ step }) => {
    // Step 1 — load active models + their latest ParentBench score
    const parentBenchScores = await step.run("load-parentbench-scores", async () => {
      const activeModels = await db
        .select({ id: models.id, slug: models.slug })
        .from(models)
        .where(and(eq(models.isActive, true), eq(models.evalTier, "active")));

      const out: Array<{ modelId: string; modelSlug: string; overallScore: number }> = [];
      for (const m of activeModels) {
        const [latest] = await db
          .select({ overallScore: scores.overallScore })
          .from(scores)
          .where(eq(scores.modelId, m.id))
          .orderBy(desc(scores.computedAt))
          .limit(1);
        if (latest) {
          out.push({ modelId: m.id, modelSlug: m.slug, overallScore: latest.overallScore });
        }
      }
      return out;
    });

    // Step 2 — load live capability rows (unsuperseded only)
    const capabilityRows = await step.run("load-capability-rows", async () => {
      const rows = await db
        .select({
          modelId: modelCapabilityScores.modelId,
          benchmark: modelCapabilityScores.benchmark,
          score: modelCapabilityScores.score,
        })
        .from(modelCapabilityScores)
        .where(isNull(modelCapabilityScores.supersededAt));
      return rows as LiveCapabilityScore[];
    });

    // Step 3 — current methodology version (read JSON)
    const methodologyVersion = await step.run("read-methodology-version", async () => {
      const m = await getParentBenchMethodology();
      return m.version;
    });

    // Step 4 — pure compute
    const result = computeCorrelationReport({
      capabilityRows,
      parentBenchScores,
      methodologyVersion,
    });

    if (result.outcome === "insufficient_data") {
      return {
        inserted: false,
        reason: result.reason,
        eligibleCount: result.eligibleCount,
      };
    }

    // Step 5 — insert the report row
    const inserted = await step.run("insert-report", async () => {
      const [row] = await db
        .insert(correlationReports)
        .values({
          spearmanRho: result.report.spearmanRho,
          spearmanRhoAbs: result.report.spearmanRhoAbs,
          modelCount: result.report.modelCount,
          benchmarksUsed: result.report.benchmarksUsed,
          perModelScores: result.report.perModelScores,
          methodologyVersion: result.report.methodologyVersion,
        })
        .returning({ id: correlationReports.id });
      return row;
    });

    // Step 6 — revalidate
    await step.run("revalidate", async () => {
      revalidatePath("/methodology");
    });

    return {
      inserted: true,
      id: inserted.id,
      spearmanRho: result.report.spearmanRho,
      spearmanRhoAbs: result.report.spearmanRhoAbs,
      modelCount: result.report.modelCount,
    };
  }
);
