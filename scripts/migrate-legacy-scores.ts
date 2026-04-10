#!/usr/bin/env npx tsx
/**
 * Migrate Legacy Scores to Statistical Robustness Schema
 *
 * This script:
 * 1. Marks all existing scores without batch (single-run) as 'legacy'
 * 2. Sets variance to null for legacy scores (ensures clean state)
 * 3. Sets isPartial to false for legacy scores (single-run = complete)
 *
 * IMPORTANT: Only marks scores that have NO scoreBatchId (true legacy scores).
 * Scores with a batch reference are part of the multi-run system and should
 * NOT be marked as legacy, even if their confidence is currently null.
 *
 * The schema changes (new columns, tables) should be applied first via:
 *   npm run db:push
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy-scores.ts [--dry-run]
 *
 * This script is idempotent - safe to run multiple times.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { scores } = await import("../src/db/schema.js");
  const { isNull, and, sql } = await import("drizzle-orm");

  const isDryRun = process.argv.includes("--dry-run");

  console.log("🔄 Migrating legacy scores to statistical robustness schema...");
  if (isDryRun) {
    console.log("📋 DRY RUN - no changes will be made\n");
  }

  // Step 1: Count true legacy scores (no confidence AND no batch)
  // This excludes scores that are part of active/pending batches
  const legacyScoresCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(scores)
    .where(
      and(
        isNull(scores.confidence),
        isNull(scores.scoreBatchId)
      )
    );

  const count = Number(legacyScoresCount[0]?.count ?? 0);
  console.log(`Found ${count} true legacy scores (no confidence AND no batch)\n`);

  if (count === 0) {
    console.log("✅ No legacy scores to migrate");
    return;
  }

  // Step 2: Update legacy scores (only those without a batch)
  if (!isDryRun) {
    console.log("Updating legacy scores...");

    const result = await db
      .update(scores)
      .set({
        confidence: "legacy",
        variance: null,
        isPartial: false,
      })
      .where(
        and(
          isNull(scores.confidence),
          isNull(scores.scoreBatchId)
        )
      )
      .returning({ id: scores.id });

    const actualCount = result.length;

    if (actualCount !== count) {
      console.warn(`⚠️  Warning: Expected to update ${count} rows but updated ${actualCount}`);
      console.warn("   This may indicate concurrent modifications. Verify results.");
    }

    console.log(`\n✅ Updated ${actualCount} scores with confidence='legacy'`);
  } else {
    console.log(`Would update ${count} scores with:`);
    console.log("  - confidence = 'legacy'");
    console.log("  - variance = null");
    console.log("  - isPartial = false");
  }

  // Step 3: Verify the update
  if (!isDryRun) {
    const verification = await db
      .select({
        total: sql<number>`count(*)`,
        legacy: sql<number>`count(*) filter (where confidence = 'legacy')`,
        high: sql<number>`count(*) filter (where confidence = 'high')`,
        medium: sql<number>`count(*) filter (where confidence = 'medium')`,
        low: sql<number>`count(*) filter (where confidence = 'low')`,
        unset: sql<number>`count(*) filter (where confidence is null)`,
      })
      .from(scores);

    const stats = verification[0];
    console.log("\n📊 Score Confidence Distribution:");
    console.log(`   Total scores:  ${stats?.total ?? 0}`);
    console.log(`   Legacy:        ${stats?.legacy ?? 0}`);
    console.log(`   High:          ${stats?.high ?? 0}`);
    console.log(`   Medium:        ${stats?.medium ?? 0}`);
    console.log(`   Low:           ${stats?.low ?? 0}`);
    console.log(`   Unset (null):  ${stats?.unset ?? 0}`);
  }

  console.log("\n✅ Migration complete!");

  if (isDryRun) {
    console.log("\n📋 Run without --dry-run to apply changes");
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
