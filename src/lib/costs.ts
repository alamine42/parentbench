/**
 * Cost Tracking Service
 *
 * Calculates and aggregates costs for evaluation runs.
 */

import { db } from "@/db";
import { evaluations, providerPricing, models, providers, budgetAlerts, budgetAlertHistory } from "@/db/schema";
import { eq, desc, gte, and, sql, sum } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface CostSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  evaluationCount: number;
  periodDays: number;
}

export interface CostByModel {
  modelId: string;
  modelName: string;
  providerName: string;
  totalCostUsd: number;
  evaluationCount: number;
}

export interface CostTimeSeries {
  date: string;
  costUsd: number;
  evaluationCount: number;
}

export interface CostEstimate {
  estimatedCostUsd: number;
  basedOnEvaluations: number;
  confidence: "high" | "medium" | "low" | "none";
  pricePerEval: number | null;
}

export interface BudgetStatus {
  thresholdUsd: number;
  currentSpendUsd: number;
  percentUsed: number;
  isOverBudget: boolean;
  periodDays: number;
}

// ============================================================================
// DEFAULT PRICING (fallback when no DB pricing exists)
// ============================================================================

// Prices per 1M tokens (USD) - updated March 2026
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-5": { input: 5.00, output: 15.00 },
  "gpt-5-mini": { input: 1.00, output: 4.00 },
  "gpt-5-nano": { input: 0.25, output: 1.00 },
  "gpt-5.4": { input: 5.00, output: 15.00 },
  "gpt-5.4-pro": { input: 10.00, output: 30.00 },
  "gpt-5.4-mini": { input: 1.00, output: 4.00 },
  "gpt-5.4-nano": { input: 0.25, output: 1.00 },
  "o3": { input: 10.00, output: 40.00 },
  "o3-pro": { input: 20.00, output: 80.00 },
  "o4-mini": { input: 1.10, output: 4.40 },

  // Anthropic
  "claude-opus-4-7": { input: 5.00, output: 25.00 },
  "claude-opus-4-6": { input: 15.00, output: 75.00 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "claude-opus-4-5": { input: 15.00, output: 75.00 },
  "claude-opus-4-1": { input: 15.00, output: 75.00 },
  "claude-sonnet-4-0": { input: 3.00, output: 15.00 },
  "claude-opus-4-0": { input: 15.00, output: 75.00 },

  // Google
  "gemini-2.5-pro-preview-05-06": { input: 1.25, output: 5.00 },
  "gemini-2.5-flash-preview-05-20": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite-preview-06-17": { input: 0.02, output: 0.08 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite": { input: 0.02, output: 0.08 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },

  // Together AI (Meta, Mistral, etc.)
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": { input: 3.50, output: 3.50 },
  "mistralai/Mistral-Large-Instruct-2407": { input: 2.00, output: 6.00 },
  "CohereForAI/c4ai-command-r-plus": { input: 2.50, output: 10.00 },
  "deepseek-ai/DeepSeek-V3": { input: 0.27, output: 1.10 },
};

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate cost for a single API call
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = DEFAULT_PRICING[modelId];

  if (!pricing) {
    // Fallback: use average pricing if model not found
    const avgInput = 2.0; // $2 per 1M input tokens
    const avgOutput = 8.0; // $8 per 1M output tokens
    return (inputTokens * avgInput + outputTokens * avgOutput) / 1_000_000;
  }

  return (
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  );
}

/**
 * Get pricing for a model (for display purposes)
 */
export function getModelPricing(modelId: string): { input: number; output: number } | null {
  return DEFAULT_PRICING[modelId] || null;
}

// ============================================================================
// COST AGGREGATION
// ============================================================================

/**
 * Get cost summary for a time period
 */
export async function getCostSummary(periodDays: number): Promise<CostSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const result = await db
    .select({
      totalCostUsd: sql<number>`COALESCE(SUM(${evaluations.totalCostUsd}), 0)`,
      totalInputTokens: sql<number>`COALESCE(SUM(${evaluations.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${evaluations.outputTokens}), 0)`,
      evaluationCount: sql<number>`COUNT(*)`,
    })
    .from(evaluations)
    .where(
      and(
        gte(evaluations.createdAt, startDate),
        eq(evaluations.status, "completed")
      )
    );

  return {
    totalCostUsd: Number(result[0]?.totalCostUsd ?? 0),
    totalInputTokens: Number(result[0]?.totalInputTokens ?? 0),
    totalOutputTokens: Number(result[0]?.totalOutputTokens ?? 0),
    evaluationCount: Number(result[0]?.evaluationCount ?? 0),
    periodDays,
  };
}

/**
 * Get costs grouped by model
 */
export async function getCostsByModel(periodDays: number): Promise<CostByModel[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const results = await db
    .select({
      modelId: models.id,
      modelName: models.name,
      providerName: providers.name,
      totalCostUsd: sql<number>`COALESCE(SUM(${evaluations.totalCostUsd}), 0)`,
      evaluationCount: sql<number>`COUNT(*)`,
    })
    .from(evaluations)
    .innerJoin(models, eq(evaluations.modelId, models.id))
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        gte(evaluations.createdAt, startDate),
        eq(evaluations.status, "completed")
      )
    )
    .groupBy(models.id, models.name, providers.name)
    .orderBy(desc(sql`SUM(${evaluations.totalCostUsd})`));

  return results.map((r) => ({
    modelId: r.modelId,
    modelName: r.modelName,
    providerName: r.providerName,
    totalCostUsd: Number(r.totalCostUsd),
    evaluationCount: Number(r.evaluationCount),
  }));
}

/**
 * Get cost time series for charting
 */
export async function getCostTimeSeries(periodDays: number): Promise<CostTimeSeries[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const results = await db
    .select({
      date: sql<string>`DATE(${evaluations.createdAt})`,
      costUsd: sql<number>`COALESCE(SUM(${evaluations.totalCostUsd}), 0)`,
      evaluationCount: sql<number>`COUNT(*)`,
    })
    .from(evaluations)
    .where(
      and(
        gte(evaluations.createdAt, startDate),
        eq(evaluations.status, "completed")
      )
    )
    .groupBy(sql`DATE(${evaluations.createdAt})`)
    .orderBy(sql`DATE(${evaluations.createdAt})`);

  return results.map((r) => ({
    date: r.date,
    costUsd: Number(r.costUsd),
    evaluationCount: Number(r.evaluationCount),
  }));
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Estimate cost for running an evaluation on a model
 * Based on historical average cost for that model
 */
export async function estimateCost(modelId: string): Promise<CostEstimate> {
  // Get historical evaluations for this model
  const historicalEvals = await db
    .select({
      totalCostUsd: evaluations.totalCostUsd,
    })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.modelId, modelId),
        eq(evaluations.status, "completed"),
        sql`${evaluations.totalCostUsd} > 0`
      )
    )
    .orderBy(desc(evaluations.createdAt))
    .limit(10);

  if (historicalEvals.length === 0) {
    // No historical data - provide rough estimate based on test case count
    // Assume ~500 input tokens and ~200 output tokens per test case on average
    const testCaseCount = 51; // Current test case count
    const avgInputTokensPerTest = 500;
    const avgOutputTokensPerTest = 200;

    // Get model info to determine pricing
    const modelInfo = await db
      .select({ slug: models.slug })
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (modelInfo.length === 0) {
      return {
        estimatedCostUsd: 0,
        basedOnEvaluations: 0,
        confidence: "none",
        pricePerEval: null,
      };
    }

    // Rough estimate
    const estimatedCost = calculateCost(
      modelInfo[0].slug,
      testCaseCount * avgInputTokensPerTest,
      testCaseCount * avgOutputTokensPerTest
    );

    return {
      estimatedCostUsd: estimatedCost,
      basedOnEvaluations: 0,
      confidence: "low",
      pricePerEval: estimatedCost,
    };
  }

  // Calculate average cost from historical data
  const totalCost = historicalEvals.reduce((sum, e) => sum + e.totalCostUsd, 0);
  const avgCost = totalCost / historicalEvals.length;

  // Determine confidence based on sample size
  let confidence: CostEstimate["confidence"];
  if (historicalEvals.length >= 5) {
    confidence = "high";
  } else if (historicalEvals.length >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    estimatedCostUsd: avgCost,
    basedOnEvaluations: historicalEvals.length,
    confidence,
    pricePerEval: avgCost,
  };
}

// ============================================================================
// BUDGET ALERTS
// ============================================================================

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<BudgetStatus | null> {
  // Get active budget alert
  const alert = await db
    .select()
    .from(budgetAlerts)
    .where(eq(budgetAlerts.isActive, true))
    .orderBy(desc(budgetAlerts.createdAt))
    .limit(1);

  if (alert.length === 0) {
    return null;
  }

  const { thresholdUsd, periodDays } = alert[0];

  // Get current spend for the period
  const summary = await getCostSummary(periodDays);

  return {
    thresholdUsd,
    currentSpendUsd: summary.totalCostUsd,
    percentUsed: thresholdUsd > 0 ? (summary.totalCostUsd / thresholdUsd) * 100 : 0,
    isOverBudget: summary.totalCostUsd >= thresholdUsd,
    periodDays,
  };
}

/**
 * Check and trigger budget alerts if needed
 */
export async function checkBudgetAlerts(): Promise<boolean> {
  const alerts = await db
    .select()
    .from(budgetAlerts)
    .where(eq(budgetAlerts.isActive, true));

  let anyTriggered = false;

  for (const alert of alerts) {
    const summary = await getCostSummary(alert.periodDays);

    if (summary.totalCostUsd >= alert.thresholdUsd) {
      // Check if already triggered recently (within last hour)
      if (alert.lastTriggeredAt) {
        const hourAgo = new Date();
        hourAgo.setHours(hourAgo.getHours() - 1);
        if (alert.lastTriggeredAt > hourAgo) {
          continue; // Already triggered recently
        }
      }

      // Record alert trigger
      await db.insert(budgetAlertHistory).values({
        alertId: alert.id,
        currentSpend: summary.totalCostUsd,
        thresholdUsd: alert.thresholdUsd,
        message: `Budget alert: Spend of $${summary.totalCostUsd.toFixed(2)} exceeds threshold of $${alert.thresholdUsd.toFixed(2)} for ${alert.periodDays}-day period`,
      });

      // Update last triggered time
      await db
        .update(budgetAlerts)
        .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
        .where(eq(budgetAlerts.id, alert.id));

      anyTriggered = true;
    }
  }

  return anyTriggered;
}

/**
 * Create or update budget alert threshold
 */
export async function setBudgetAlert(
  thresholdUsd: number,
  periodDays: number,
  name: string = "Default Budget Alert"
): Promise<void> {
  // Deactivate existing alerts
  await db
    .update(budgetAlerts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(budgetAlerts.isActive, true));

  // Create new alert
  await db.insert(budgetAlerts).values({
    name,
    thresholdUsd,
    periodDays,
    isActive: true,
  });
}

/**
 * Get budget alert history
 */
export async function getBudgetAlertHistory(limit: number = 20) {
  return db
    .select({
      id: budgetAlertHistory.id,
      alertName: budgetAlerts.name,
      triggeredAt: budgetAlertHistory.triggeredAt,
      currentSpend: budgetAlertHistory.currentSpend,
      thresholdUsd: budgetAlertHistory.thresholdUsd,
      message: budgetAlertHistory.message,
    })
    .from(budgetAlertHistory)
    .innerJoin(budgetAlerts, eq(budgetAlertHistory.alertId, budgetAlerts.id))
    .orderBy(desc(budgetAlertHistory.triggeredAt))
    .limit(limit);
}
