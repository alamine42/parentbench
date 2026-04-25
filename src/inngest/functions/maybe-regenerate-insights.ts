/**
 * Trigger / debounce orchestrator for insights regeneration (parentbench-ov1.4).
 *
 * Listens to organic events and the safety-net cron. Decides whether to
 * fan out an `insights/regenerate-requested` event to the actual
 * generator (`generate-insights-report`).
 *
 * Manual admin "Regenerate now" calls bypass these functions and send
 * `insights/regenerate-requested` directly.
 */

import { eq, and, desc } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/db";
import { insightsReports, models, scores } from "@/db/schema";
import { shouldDebounce } from "@/lib/insights/debounce";
import { shouldTriggerRegen, type EvalCompletedPayload } from "@/lib/insights/trigger-decision";

type TriggerReason = "score_delta" | "new_model" | "active_tier_promoted" | "scheduled_recheck";

// ============================================================================
// EVAL COMPLETED — only fire on active-tier ≥5pt delta
// ============================================================================

export const onEvalCompletedMaybeRegen = inngest.createFunction(
  {
    id: "insights-on-eval-completed",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ event: "eval/completed" }],
  },
  async ({ event, step }) => {
    const data = event.data as { modelId: string; modelSlug: string; overallScore?: number };

    const decision = await step.run("check-trigger", async () => {
      const [model] = await db.select().from(models).where(eq(models.id, data.modelId)).limit(1);
      if (!model) return { fire: false } as const;

      const recent = await db
        .select({ overallScore: scores.overallScore })
        .from(scores)
        .where(eq(scores.modelId, data.modelId))
        .orderBy(desc(scores.computedAt))
        .limit(2);

      const newScore = recent[0]?.overallScore ?? data.overallScore ?? null;
      const previousScore = recent[1]?.overallScore ?? null;
      if (newScore === null) return { fire: false } as const;

      const payload: EvalCompletedPayload = {
        modelTier: model.evalTier,
        newScore,
        previousScore,
      };
      return { fire: shouldTriggerRegen(payload) } as const;
    });

    if (!decision.fire) return { triggered: false };

    if (await isDebouncedNow(step)) return { triggered: false, reason: "debounced" };

    await step.sendEvent("fan-out-regenerate", {
      name: "insights/regenerate-requested",
      data: { triggerReason: "score_delta" satisfies TriggerReason, triggeringEvent: { eventId: event.id, modelId: data.modelId } },
    });
    return { triggered: true };
  }
);

// ============================================================================
// MODEL CREATED — always fire (subject to debounce)
// ============================================================================

export const onModelCreatedMaybeRegen = inngest.createFunction(
  {
    id: "insights-on-model-created",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ event: "model/created" }],
  },
  async ({ event, step }) => {
    if (await isDebouncedNow(step)) return { triggered: false, reason: "debounced" };
    await step.sendEvent("fan-out-regenerate", {
      name: "insights/regenerate-requested",
      data: { triggerReason: "new_model" satisfies TriggerReason, triggeringEvent: event.data ?? null },
    });
    return { triggered: true };
  }
);

// ============================================================================
// MODEL PROMOTED TO ACTIVE TIER — always fire (subject to debounce)
// ============================================================================

export const onActiveTierPromotedMaybeRegen = inngest.createFunction(
  {
    id: "insights-on-active-tier-promoted",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ event: "eval/active-tier-promoted" }],
  },
  async ({ event, step }) => {
    if (await isDebouncedNow(step)) return { triggered: false, reason: "debounced" };
    await step.sendEvent("fan-out-regenerate", {
      name: "insights/regenerate-requested",
      data: { triggerReason: "active_tier_promoted" satisfies TriggerReason, triggeringEvent: event.data ?? null },
    });
    return { triggered: true };
  }
);

// ============================================================================
// SAFETY-NET CRON — Monday 3am UTC, one hour after active-tier evals
// ============================================================================

export const insightsScheduledRecheck = inngest.createFunction(
  {
    id: "insights-scheduled-recheck",
    retries: 1,
    triggers: [{ cron: "0 3 * * 1" }],
  },
  async ({ step }) => {
    if (await isDebouncedNow(step)) return { triggered: false, reason: "debounced" };
    await step.sendEvent("fan-out-regenerate", {
      name: "insights/regenerate-requested",
      data: { triggerReason: "scheduled_recheck" satisfies TriggerReason, triggeringEvent: { source: "monday-cron" } },
    });
    return { triggered: true };
  }
);

// ============================================================================
// SHARED HELPER — debounce check
// ============================================================================

/**
 * Inngest's step type is parametric and difficult to name from outside its
 * generated factory context, so we accept it as `unknown` and cast inside.
 * This keeps the helper reusable across all four caller sites without
 * fighting the SDK's generics.
 */
async function isDebouncedNow(step: unknown): Promise<boolean> {
  const s = step as { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> };
  return s.run("check-debounce", async () => {
    const [latest] = await db
      .select({ publishedAt: insightsReports.publishedAt })
      .from(insightsReports)
      .where(and(eq(insightsReports.status, "published")))
      .orderBy(desc(insightsReports.publishedAt))
      .limit(1);
    return shouldDebounce({
      lastPublishedAt: latest?.publishedAt ?? null,
      now: new Date(),
    });
  });
}
