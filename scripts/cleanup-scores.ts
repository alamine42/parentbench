#!/usr/bin/env npx tsx
/**
 * Remove placeholder scores, keeping only live evaluation scores
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { scores } = await import("../src/db/schema.js");
  const { isNull } = await import("drizzle-orm");

  console.log("Cleaning up placeholder scores...\n");

  // Delete all scores that don't have an evaluationId (placeholder/illustrative scores)
  const deleted = await db
    .delete(scores)
    .where(isNull(scores.evaluationId))
    .returning({ id: scores.id, modelId: scores.modelId });

  console.log(`Deleted ${deleted.length} placeholder scores`);

  // Show remaining scores
  const remaining = await db.select().from(scores);
  console.log(`\nRemaining live scores: ${remaining.length}`);
  for (const score of remaining) {
    console.log(`  - Model ${score.modelId}: ${score.overallScore} (${score.overallGrade})`);
  }

  process.exit(0);
}

main().catch(console.error);
