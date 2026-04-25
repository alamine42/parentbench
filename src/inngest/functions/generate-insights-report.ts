/**
 * Insights report generator (parentbench-ov1.3).
 *
 * Listens for `insights/regenerate-requested` events and produces a
 * fully-validated, auto-published insights report.
 *
 * Pipeline (per design §4.5):
 *   1. build-aggregate     — fetch DB rows + buildAggregate
 *   2. snapshot-aggregate  — insert draft row (narrative=NULL)
 *   3. call-writer-model   — single LLM call to a non-leaderboard model
 *   4. validate-narrative  — numeric guard + length floor
 *   5. persist-narrative   — update row with narrative + costs
 *   6. auto-publish        — status: draft → published
 *   7. revalidate-paths    — /, /insights, /insights/archive, /insights/[slug]
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/db";
import { insightsReports } from "@/db/schema";
import { fetchAggregateInput } from "@/lib/insights/fetch-aggregate-input";
import { buildAggregate, type InsightsAggregate } from "@/lib/insights/build-aggregate";
import { callWriterModel } from "@/lib/insights/writer-model";
import { validateNarrativeAgainstAggregate } from "@/lib/insights/numeric-guard";
import { calculateCost } from "@/lib/costs";

export type RegenerateRequestedEvent = {
  triggerReason: "score_delta" | "new_model" | "active_tier_promoted" | "manual" | "scheduled_recheck";
  triggeringEvent?: Record<string, unknown>;
};

export const generateInsightsReport = inngest.createFunction(
  {
    id: "generate-insights-report",
    retries: 2,
    concurrency: { limit: 1 },
    triggers: [{ event: "insights/regenerate-requested" }],
  },
  async ({ event, step }) => {
    const { triggerReason, triggeringEvent } = event.data as RegenerateRequestedEvent;

    // Step 1: build aggregate
    const aggregate = await step.run("build-aggregate", async () => {
      const input = await fetchAggregateInput(new Date());
      return buildAggregate(input);
    });

    // Step 2: snapshot the draft row
    const generatorModel = process.env.INSIGHTS_GENERATOR_MODEL || "claude-haiku-4-5";
    const slug = await step.run("compute-slug", async () => deriveAvailableSlug(new Date()));

    const draftId = await step.run("snapshot-aggregate", async () => {
      const [row] = await db
        .insert(insightsReports)
        .values({
          slug,
          dataThrough: new Date(aggregate.dataThrough),
          aggregates: aggregate as unknown as Record<string, unknown>,
          narrative: null,
          generatorModel,
          triggerReason,
          triggeringEvent: triggeringEvent ?? null,
          status: "draft",
        })
        .returning({ id: insightsReports.id });
      return row.id;
    });

    // Step 3: call writer
    let writerResult;
    try {
      writerResult = await step.run("call-writer-model", async () => {
        return callWriterModel(aggregate);
      });
    } catch (error) {
      await markFailed(draftId, `Writer call failed: ${describeError(error)}`);
      throw error; // let Inngest retry
    }

    // Step 4: validate
    const validation = await step.run("validate-narrative", async () => {
      return validateNarrativeAgainstAggregate(writerResult.narrative, aggregate);
    });

    if (!validation.valid) {
      await markFailed(draftId, validation.failureReason);
      return {
        slug,
        status: "generation_failed",
        failureReason: validation.failureReason,
      };
    }

    // Step 5: persist narrative + cost
    const totalCostUsd = calculateCost(generatorModel, writerResult.inputTokens, writerResult.outputTokens);
    await step.run("persist-narrative", async () => {
      await db
        .update(insightsReports)
        .set({
          narrative: writerResult.narrative as unknown as Record<string, unknown>,
          generatorTokensIn: writerResult.inputTokens,
          generatorTokensOut: writerResult.outputTokens,
          generatorCostUsd: totalCostUsd,
        })
        .where(eq(insightsReports.id, draftId));
    });

    // Step 6: publish
    await step.run("auto-publish", async () => {
      await db
        .update(insightsReports)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(insightsReports.id, draftId));
    });

    // Step 7: revalidate
    await step.run("revalidate-paths", async () => {
      revalidatePath("/");
      revalidatePath("/insights");
      revalidatePath("/insights/archive");
      revalidatePath(`/insights/${slug}`);
    });

    return { slug, status: "published", costUsd: totalCostUsd };
  }
);

// ============================================================================
// HELPERS
// ============================================================================

async function markFailed(draftId: string, reason: string) {
  await db
    .update(insightsReports)
    .set({ status: "generation_failed", failureReason: reason })
    .where(eq(insightsReports.id, draftId));
}

/**
 * Pick a slug for today: `YYYY-MM-DD`, or `YYYY-MM-DD-2`, `-3`, ...
 * Avoids clobbering archive entries on same-day regens.
 */
async function deriveAvailableSlug(now: Date): Promise<string> {
  const dateStr = now.toISOString().slice(0, 10);
  const existing = await db
    .select({ slug: insightsReports.slug })
    .from(insightsReports);
  const existingSet = new Set(existing.map((r) => r.slug));

  if (!existingSet.has(dateStr)) return dateStr;
  for (let n = 2; n < 100; n++) {
    const candidate = `${dateStr}-${n}`;
    if (!existingSet.has(candidate)) return candidate;
  }
  // Fall through — unreachable in practice
  return `${dateStr}-${Date.now()}`;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Export the slug helper for ov1.4 reuse
export { deriveAvailableSlug };
