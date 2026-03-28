#!/usr/bin/env npx tsx
/**
 * Assign Evaluation Tiers to Models
 *
 * Based on the strategy in docs/EVALUATION_STRATEGY.md:
 * - active: Weekly (3 runs) - Flagship models, recently updated
 * - standard: Bi-weekly (3 runs) - Mid-tier models, stable but relevant
 * - maintenance: Monthly (3 runs) - Legacy models, open-source
 * - paused: Manual only (1 run) - Deprecated, testing
 *
 * Usage:
 *   npx tsx scripts/assign-eval-tiers.ts [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Tier assignments based on documented strategy
// Using EXACT slugs from the database (use --verbose to see actual slugs)
const TIER_ASSIGNMENTS: Record<string, string[]> = {
  // Active Tier (Weekly) - Flagship models, recently updated
  active: [
    // Claude flagship
    "claude-opus-4-5",
    "claude-opus-4-6",
    "claude-sonnet-4-5",
    "claude-sonnet-4-6",
    // GPT flagship (exact slugs)
    "gpt-5",
    "gpt-5-4",
    "gpt-5-4-pro",
    // Reasoning models
    "o3",
    "o3-pro",
    "o4-mini",
    // Gemini flagship
    "gemini-2-5-pro",
  ],

  // Standard Tier (Bi-weekly) - Mid-tier models
  standard: [
    // Claude mid-tier
    "claude-haiku-4-5",
    "claude-opus-4",
    "claude-opus-4-1",
    "claude-sonnet-4",
    // GPT mid-tier (exact slugs)
    "gpt-4-1",
    "gpt-4-1-mini",
    "gpt-5-mini",
    "gpt-5-4-mini",
    // Gemini mid-tier
    "gemini-2-5-flash",
    "gemini-2-5-flash-lite",
    // xAI
    "grok-2",
  ],

  // Maintenance Tier (Monthly) - Legacy/stable models
  maintenance: [
    // GPT legacy (exact slugs)
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5-nano",
    "gpt-5-4-nano",
    // Gemini legacy
    "gemini-2-0-flash",
    "gemini-2-0-flash-lite",
    "gemini-1-5-pro",
    "gemini-1-5-flash",
    // Open source
    "llama-3-1-405b",
    "mistral-large-2",
    "command-r-plus",
    "deepseek-v3",
  ],
};

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models } = await import("../src/db/schema.js");
  const { eq, sql } = await import("drizzle-orm");

  const isDryRun = process.argv.includes("--dry-run");

  console.log("🔄 Assigning evaluation tiers to models...");
  if (isDryRun) {
    console.log("📋 DRY RUN - no changes will be made\n");
  }

  // Get all models
  const allModels = await db.select().from(models);
  console.log(`Found ${allModels.length} models in database\n`);

  let updated = 0;
  const tierCounts: Record<string, number> = {
    active: 0,
    standard: 0,
    maintenance: 0,
    paused: 0,
  };

  // First pass: print all models and their slugs for debugging
  if (process.argv.includes("--verbose")) {
    console.log("All models:");
    for (const model of allModels) {
      console.log(`  ${model.slug} (${model.name}) - isActive: ${model.isActive}`);
    }
    console.log("");
  }

  for (const model of allModels) {
    let assignedTier = "standard"; // Default tier
    let matchedPattern = "";

    // Check each tier for an EXACT match
    for (const [tier, slugPatterns] of Object.entries(TIER_ASSIGNMENTS)) {
      for (const pattern of slugPatterns) {
        // Exact match only (slugs should be identical)
        if (model.slug === pattern) {
          assignedTier = tier;
          matchedPattern = pattern;
          break;
        }
      }
      if (matchedPattern) break;
    }

    // Special rules for inactive models - override to paused
    if (!model.isActive) {
      assignedTier = "paused";
    }

    tierCounts[assignedTier]++;

    // Only update if tier changed
    if (model.evalTier !== assignedTier) {
      const reason = !model.isActive
        ? "(inactive)"
        : matchedPattern
          ? `(matched: ${matchedPattern})`
          : "(default)";
      console.log(
        `  ${model.name} [${model.slug}]: ${model.evalTier || "standard"} → ${assignedTier} ${reason}`
      );

      if (!isDryRun) {
        await db
          .update(models)
          .set({ evalTier: assignedTier as "active" | "standard" | "maintenance" | "paused" })
          .where(eq(models.id, model.id));
      }
      updated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Models updated: ${updated}`);
  console.log(`\n📈 Tier Distribution:`);
  console.log(`   Active (weekly):      ${tierCounts.active} models`);
  console.log(`   Standard (bi-weekly): ${tierCounts.standard} models`);
  console.log(`   Maintenance (monthly): ${tierCounts.maintenance} models`);
  console.log(`   Paused (manual):      ${tierCounts.paused} models`);

  // Estimate monthly evaluation counts and costs
  const monthlyEvals =
    tierCounts.active * 12 + // 4 weeks × 3 runs
    tierCounts.standard * 6 + // 2 bi-weekly × 3 runs
    tierCounts.maintenance * 3; // 1 monthly × 3 runs

  console.log(`\n💰 Estimated Monthly Load:`);
  console.log(`   Total evaluations: ~${monthlyEvals}`);
  console.log(`   Estimated cost: $${(monthlyEvals * 0.15).toFixed(2)} - $${(monthlyEvals * 0.25).toFixed(2)}`);

  if (isDryRun) {
    console.log("\n📋 Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ Tier assignment complete!");
  }
}

main().catch(console.error);
