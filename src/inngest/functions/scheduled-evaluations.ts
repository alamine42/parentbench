import { inngest } from "../client";
import { db } from "@/db";
import { models, providers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Scheduled Evaluation Functions
 *
 * Based on the evaluation frequency strategy:
 * - Active tier: Daily at 2:00 AM UTC
 * - Standard tier: Monday & Thursday at 2:00 AM UTC
 * - Maintenance tier: 1st of month at 2:00 AM UTC
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
 * Active Tier Scheduler - Daily at 2:00 AM UTC
 * Evaluates flagship models that need the most frequent monitoring
 */
export const scheduledEvalActive = inngest.createFunction(
  {
    id: "scheduled-eval-active",
    retries: 1,
    triggers: [{ cron: "0 2 * * *" }], // Daily at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "active";

    // Get all active models in this tier
    const modelsToEvaluate = await step.run("get-active-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in active tier" };
    }

    // Trigger evaluation for each model
    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
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
 * Standard Tier Scheduler - Monday & Thursday at 2:00 AM UTC
 * Evaluates mid-tier models bi-weekly
 */
export const scheduledEvalStandard = inngest.createFunction(
  {
    id: "scheduled-eval-standard",
    retries: 1,
    triggers: [{ cron: "0 2 * * 1,4" }], // Monday and Thursday at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "standard";

    // Get all active models in this tier
    const modelsToEvaluate = await step.run("get-standard-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in standard tier" };
    }

    // Trigger evaluation for each model
    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
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
 * Evaluates legacy/stable models monthly
 */
export const scheduledEvalMaintenance = inngest.createFunction(
  {
    id: "scheduled-eval-maintenance",
    retries: 1,
    triggers: [{ cron: "0 2 1 * *" }], // 1st of month at 2:00 AM UTC
  },
  async ({ step }) => {
    const tier: EvalTier = "maintenance";

    // Get all active models in this tier
    const modelsToEvaluate = await step.run("get-maintenance-models", async () => {
      return getModelsForTier(tier);
    });

    if (modelsToEvaluate.length === 0) {
      return { tier, modelsEvaluated: 0, message: "No models in maintenance tier" };
    }

    // Trigger evaluation for each model
    const events = modelsToEvaluate.map((model) => ({
      name: "eval/requested" as const,
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: `scheduled-${tier}`,
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
