import { inngest } from "../client";
import { db } from "@/db";
import { models, providers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Scheduled Evaluation Functions
 *
 * Cost-optimized frequency strategy (reduced from daily/2x-week/monthly):
 * - Active tier: Weekly on Monday at 2:00 AM UTC
 * - Standard tier: 1st & 15th of month at 2:00 AM UTC
 * - Maintenance tier: 1st of month at 2:00 AM UTC
 *
 * Scoring strategy:
 * - Active tier: full test suite + LLM judge (leaderboard headline scores
 *   need to discriminate; the keyword heuristic produces ceiling-100s)
 * - Standard / Maintenance tiers: sampled test cases + heuristic scoring
 *   to minimize API costs
 * - Manual triggers: full + LLM judge regardless of tier
 *
 * Each function triggers eval/requested events for all models in that tier.
 */

type EvalTier = "active" | "standard" | "maintenance";

async function getModelsForTier(tier: EvalTier) {
  return db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      providerName: providers.name,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.evalTier, tier), eq(models.isActive, true)));
}

/**
 * Active Tier Scheduler - Weekly on Monday at 2:00 AM UTC
 * Evaluates flagship models weekly (reduced from daily to cut costs ~85%)
 */
export const scheduledEvalActive = inngest.createFunction(
  {
    id: "scheduled-eval-active",
    retries: 1,
    triggers: [{ cron: "0 2 * * 1" }], // Weekly on Monday at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "active";

    const modelsToEvaluate = await step.run("get-active-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in active tier" };
    }

    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
        sampleTestCases: false,
        useLlmJudge: true,
      },
    }));

    await step.sendEvent("trigger-evaluations", events);

    return {
      tier,
      modelsEvaluated: modelsToEvaluate.length,
      models: modelsToEvaluate.map((m) => m.name),
    };
  }
);

/**
 * Standard Tier Scheduler - 1st & 15th of month at 2:00 AM UTC
 * Evaluates mid-tier models bimonthly (reduced from 2x/week to cut costs ~85%)
 */
export const scheduledEvalStandard = inngest.createFunction(
  {
    id: "scheduled-eval-standard",
    retries: 1,
    triggers: [{ cron: "0 2 1,15 * *" }], // 1st and 15th of month at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "standard";

    const modelsToEvaluate = await step.run("get-standard-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in standard tier" };
    }

    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
        sampleTestCases: true,
        useLlmJudge: false,
      },
    }));

    await step.sendEvent("trigger-evaluations", events);

    return {
      tier,
      modelsEvaluated: modelsToEvaluate.length,
      models: modelsToEvaluate.map((m) => m.name),
    };
  }
);

/**
 * Maintenance Tier Scheduler - 1st of month at 2:00 AM UTC
 * Evaluates legacy/stable models monthly (unchanged)
 */
export const scheduledEvalMaintenance = inngest.createFunction(
  {
    id: "scheduled-eval-maintenance",
    retries: 1,
    triggers: [{ cron: "0 2 1 * *" }], // 1st of month at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "maintenance";

    const modelsToEvaluate = await step.run("get-maintenance-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in maintenance tier" };
    }

    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
        sampleTestCases: true,
        useLlmJudge: false,
      },
    }));

    await step.sendEvent("trigger-evaluations", events);

    return {
      tier,
      modelsEvaluated: modelsToEvaluate.length,
      models: modelsToEvaluate.map((m) => m.name),
    };
  }
);
