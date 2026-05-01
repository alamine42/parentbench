/**
 * Paired API re-run handler (parentbench-orx).
 *
 * Listens for `eval/paired-api-rerun-requested` (sent by the browser
 * runner after a consumer-track publication finalizes). Idempotent:
 * if a recent api-default score for this model exists within the
 * recency window, no-op. Otherwise enqueues a fresh API evaluation.
 */

import { inngest } from "../client";
import { db } from "@/db";
import { evaluations, models, scores } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

const RECENT_API_RUN_DAYS = 14;

export const pairedApiRerun = inngest.createFunction(
  {
    id: "paired-api-rerun",
    retries: 2,
    triggers: [{ event: "eval/paired-api-rerun-requested" }],
  },
  async ({ event, step }) => {
    const { modelSlug, consumerRunId } = event.data as {
      modelSlug: string;
      consumerRunId: string;
      reason: string;
    };

    // Resolve model.
    const [model] = await db
      .select({ id: models.id, slug: models.slug })
      .from(models)
      .where(eq(models.slug, modelSlug))
      .limit(1);
    if (!model) {
      return {
        skipped: true,
        reason: `model-not-found:${modelSlug}`,
        consumerRunId,
      };
    }

    // Recent api-default score?
    const cutoff = new Date(Date.now() - RECENT_API_RUN_DAYS * 86400_000);
    const [recent] = await db
      .select({ computedAt: scores.computedAt })
      .from(scores)
      .where(
        and(
          eq(scores.modelId, model.id),
          eq(scores.surface, "api-default")
        )
      )
      .orderBy(desc(scores.computedAt))
      .limit(1);

    if (recent && recent.computedAt && recent.computedAt > cutoff) {
      return {
        skipped: true,
        reason: "recent-api-run-exists",
        recentAt: recent.computedAt.toISOString(),
        consumerRunId,
      };
    }

    // Avoid stacking multiple in-flight runs for the same model.
    const [running] = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.modelId, model.id),
          eq(evaluations.surface, "api-default"),
          eq(evaluations.status, "running")
        )
      )
      .orderBy(desc(evaluations.createdAt))
      .limit(1);
    if (running) {
      return {
        skipped: true,
        reason: "api-run-already-in-flight",
        evaluationId: running.id,
        consumerRunId,
      };
    }

    await step.sendEvent("trigger-api-eval", {
      name: "eval/requested",
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `paired-with-${consumerRunId}`,
        useLlmJudge: true,
        sampleTestCases: false,
      },
    });

    return {
      skipped: false,
      modelSlug,
      consumerRunId,
    };
  }
);
