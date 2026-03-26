#!/usr/bin/env npx tsx
/**
 * Backfill Cost Estimates for Existing Evaluations
 *
 * This script estimates costs for evaluations that were run before cost tracking was added.
 * It uses the model slug and completed test case count to calculate an estimate.
 *
 * Usage:
 *   npx tsx scripts/backfill-costs.ts [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Average tokens per test case (based on typical prompt + response lengths)
const AVG_INPUT_TOKENS_PER_TEST = 500;
const AVG_OUTPUT_TOKENS_PER_TEST = 200;

async function main() {
  const { db } = await import("../src/db/index.js");
  const { evaluations, models } = await import("../src/db/schema.js");
  const { eq, and } = await import("drizzle-orm");
  const { calculateCost } = await import("../src/lib/costs.js");

  const isDryRun = process.argv.includes("--dry-run");

  console.log("🔄 Backfilling cost estimates for existing evaluations...");
  if (isDryRun) {
    console.log("📋 DRY RUN - no changes will be made\n");
  }

  // Find evaluations without cost data
  const evalsToUpdate = await db
    .select({
      id: evaluations.id,
      modelId: evaluations.modelId,
      completedTestCases: evaluations.completedTestCases,
      totalCostUsd: evaluations.totalCostUsd,
      modelSlug: models.slug,
      modelName: models.name,
    })
    .from(evaluations)
    .innerJoin(models, eq(evaluations.modelId, models.id))
    .where(
      and(
        eq(evaluations.status, "completed"),
        eq(evaluations.totalCostUsd, 0)
      )
    );

  console.log(`Found ${evalsToUpdate.length} evaluations to backfill\n`);

  if (evalsToUpdate.length === 0) {
    console.log("✅ No evaluations need backfilling");
    return;
  }

  let updated = 0;
  let totalEstimatedCost = 0;

  for (const eval_ of evalsToUpdate) {
    // Estimate token usage based on test case count
    const estimatedInputTokens = eval_.completedTestCases * AVG_INPUT_TOKENS_PER_TEST;
    const estimatedOutputTokens = eval_.completedTestCases * AVG_OUTPUT_TOKENS_PER_TEST;

    // Calculate cost
    const estimatedCost = calculateCost(
      eval_.modelSlug,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    console.log(
      `  ${eval_.modelName} (${eval_.completedTestCases} tests): ` +
      `~${estimatedInputTokens.toLocaleString()} in + ${estimatedOutputTokens.toLocaleString()} out = ` +
      `$${estimatedCost.toFixed(4)}`
    );

    if (!isDryRun) {
      await db
        .update(evaluations)
        .set({
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          totalCostUsd: estimatedCost,
          costEstimated: true, // Mark as estimated, not actual
        })
        .where(eq(evaluations.id, eval_.id));
    }

    updated++;
    totalEstimatedCost += estimatedCost;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Evaluations updated: ${updated}`);
  console.log(`   Total estimated cost: $${totalEstimatedCost.toFixed(2)}`);
  console.log(`   Average per evaluation: $${(totalEstimatedCost / updated).toFixed(4)}`);

  if (isDryRun) {
    console.log("\n📋 Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ Backfill complete!");
  }
}

main().catch(console.error);
