#!/usr/bin/env npx tsx
/**
 * Assign Evaluation Tiers to Models
 *
 * Cost-optimized tier strategy:
 * - active: Weekly (Monday) - cheap/mid-price flagship models only
 * - standard: Bimonthly (1st & 15th) - mid-tier models
 * - maintenance: Monthly (1st) - expensive models + legacy + open-source
 * - paused: Manual only - deprecated/testing
 *
 * Key cost principle: expensive models (>$5/1M output tokens) go to
 * maintenance tier. Their scores rarely change, so monthly checks suffice.
 * Cheaper models that may get frequent updates go to active/standard.
 *
 * Usage:
 *   npx tsx scripts/assign-eval-tiers.ts [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Tier assignments optimized for cost
// Using EXACT slugs from the database (use --verbose to see actual slugs)
const TIER_ASSIGNMENTS: Record<string, string[]> = {
  // Active Tier (Weekly) - cheap-to-mid flagship models only
  active: [
    // Affordable Claude models
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    // Affordable GPT models
    "gpt-5-mini",
    "gpt-5-4-mini",
    "o4-mini",
    // Gemini (very cheap)
    "gemini-3-1-pro",
    "gemini-2-5-pro",
    "gemini-2-5-flash",
  ],

  // Standard Tier (Bimonthly) - mid-tier and mid-price models
  standard: [
    // Claude
    "claude-sonnet-4-5",
    "claude-sonnet-4",
    // GPT
    "gpt-4-1",
    "gpt-4-1-mini",
    "gpt-5",
    "gpt-5-4",
    // Gemini
    "gemini-3-flash",
    "gemini-2-5-flash-lite",
    // xAI
    "grok-2",
  ],

  // Maintenance Tier (Monthly) - expensive models + legacy + open-source
  maintenance: [
    // Expensive Opus models (output: $75/1M tokens)
    "claude-opus-4-6",
    "claude-opus-4-5",
    "claude-opus-4-1",
    "claude-opus-4",
    // Expensive reasoning models
    "o3",       // output: $40/1M
    "o3-pro",   // output: $80/1M
    // Expensive GPT
    "gpt-5-4-pro",  // output: $30/1M
    // GPT legacy
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
  console.log(`   Active (weekly Mon):    ${tierCounts.active} models`);
  console.log(`   Standard (1st & 15th):  ${tierCounts.standard} models`);
  console.log(`   Maintenance (monthly):  ${tierCounts.maintenance} models`);
  console.log(`   Paused (manual):        ${tierCounts.paused} models`);

  // Estimate monthly evaluation counts
  // All tiers use sampled test cases (~20 instead of 51) and no LLM judge
  const monthlyEvals =
    tierCounts.active * 4 +    // 4 weeks × 1 run
    tierCounts.standard * 2 +  // 2 runs per month
    tierCounts.maintenance * 1; // 1 run per month

  console.log(`\n💰 Estimated Monthly Load (sampled ~20 test cases, no judge):`);
  console.log(`   Total evaluations: ~${monthlyEvals}`);
  console.log(`   Estimated cost: $${(monthlyEvals * 0.02).toFixed(2)} - $${(monthlyEvals * 0.10).toFixed(2)}`);

  if (isDryRun) {
    console.log("\n📋 Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ Tier assignment complete!");
  }
}

main().catch(console.error);
