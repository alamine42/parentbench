#!/usr/bin/env npx tsx
/**
 * Export live scores from database to scores.json
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs/promises";
import path from "path";

async function main() {
  const { db } = await import("../src/db/index.js");
  const { scores, models } = await import("../src/db/schema.js");
  const { eq, isNotNull, desc } = await import("drizzle-orm");

  console.log("Exporting live scores from database...\n");

  // Get all scores that have an evaluationId (live scores)
  const liveScores = await db
    .select({
      score: scores,
      modelSlug: models.slug,
    })
    .from(scores)
    .innerJoin(models, eq(scores.modelId, models.id))
    .where(isNotNull(scores.evaluationId))
    .orderBy(desc(scores.overallScore));

  console.log(`Found ${liveScores.length} live scores`);

  // Multi-surface export: emit `surface` per row so
  // downstream consumers can group by (model, surface). Pre-migration
  // rows fall back to 'api-default'.
  const results = liveScores.map(({ score, modelSlug }) => ({
    modelSlug,
    surface: (score as { surface?: string }).surface ?? "api-default",
    overallScore: score.overallScore,
    overallGrade: score.overallGrade,
    trend: score.trend,
    categoryScores: score.categoryScores,
    evaluatedDate: score.computedAt.toISOString().split("T")[0],
    dataQuality: score.dataQuality,
    methodologyVersion: "1.0.0",
  }));

  const output = {
    lastUpdated: new Date().toISOString().split("T")[0],
    results,
  };

  const outputPath = path.join(process.cwd(), "data", "parentbench", "scores.json");
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nExported to ${outputPath}`);
  console.log("\nScores:");
  for (const r of results) {
    console.log(`  - ${r.modelSlug}: ${r.overallScore} (${r.overallGrade})`);
  }

  process.exit(0);
}

main().catch(console.error);
