#!/usr/bin/env npx tsx
/**
 * Freeze snapshot exporter (2026-05-17).
 *
 * Dumps every table the public site reads to `src/data/snapshot/*.json`
 * so the app can serve the frozen state without a live database.
 *
 * Run BEFORE setting `FROZEN=1` in production:
 *   FROZEN=0 npx tsx scripts/freeze-snapshot.ts
 *
 * Commits the JSON files. When `FROZEN=1` is set on Vercel, the data
 * layer reads from these files instead of @neondatabase/serverless.
 *
 * Snapshot files (one per concern, keyed for direct lookup where useful):
 *   models.json              — every active model with provider join
 *   scores.json              — every (model × surface) latest score
 *   categories.json          — full category metadata
 *   test-cases.json          — every active test case
 *   insights-reports.json    — published insights reports only
 *   meta.json                — snapshot timestamp + counts (sanity check)
 *
 * The historical `data/parentbench/*.json` files remain in place as a
 * legacy fallback (they predate freeze mode) and are not overwritten.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs/promises";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "src", "data", "snapshot");

async function writeJson(name: string, data: unknown) {
  const file = path.join(OUT_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ wrote ${name}.json`);
}

async function main() {
  if (process.env.FROZEN === "1") {
    console.error(
      "Refusing to run with FROZEN=1: the data layer would route DB calls to snapshot files (circular). Run with FROZEN=0."
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Add it to .env.local.");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { eq, desc } = await import("drizzle-orm");

  console.log("Snapshotting from DATABASE_URL…\n");

  const modelRows = await db
    .select({
      id: schema.models.id,
      slug: schema.models.slug,
      name: schema.models.name,
      description: schema.models.description,
      releaseDate: schema.models.releaseDate,
      parameterCount: schema.models.parameterCount,
      evalTier: schema.models.evalTier,
      isActive: schema.models.isActive,
      createdAt: schema.models.createdAt,
      provider: {
        id: schema.providers.id,
        name: schema.providers.name,
        slug: schema.providers.slug,
        logoUrl: schema.providers.logoUrl,
      },
    })
    .from(schema.models)
    .innerJoin(schema.providers, eq(schema.models.providerId, schema.providers.id))
    .orderBy(schema.models.name);

  await writeJson(
    "models",
    modelRows.map((m) => ({
      ...m,
      releaseDate: m.releaseDate ? m.releaseDate.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    }))
  );

  const scoreRows = await db
    .select({
      modelSlug: schema.models.slug,
      surface: schema.scores.surface,
      overallScore: schema.scores.overallScore,
      overallGrade: schema.scores.overallGrade,
      trend: schema.scores.trend,
      dataQuality: schema.scores.dataQuality,
      categoryScores: schema.scores.categoryScores,
      computedAt: schema.scores.computedAt,
      confidence: schema.scores.confidence,
      variance: schema.scores.variance,
      isPartial: schema.scores.isPartial,
      falseRefusalRate: schema.scores.falseRefusalRate,
      netHelpfulness: schema.scores.netHelpfulness,
      benignRefusalCount: schema.scores.benignRefusalCount,
      benignTotalCount: schema.scores.benignTotalCount,
      refusedBenignCaseIds: schema.scores.refusedBenignCaseIds,
    })
    .from(schema.scores)
    .innerJoin(schema.models, eq(schema.scores.modelId, schema.models.id))
    .orderBy(desc(schema.scores.computedAt));

  // Latest-per-(model,surface). Input is already sorted desc by
  // computedAt, so the first row we see for each key is the freshest.
  const seen = new Set<string>();
  const latestByModelSurface = scoreRows.filter((r) => {
    const k = `${r.modelSlug}::${r.surface}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  await writeJson(
    "scores",
    latestByModelSurface.map((s) => ({
      modelSlug: s.modelSlug,
      surface: s.surface,
      overallScore: s.overallScore,
      overallGrade: s.overallGrade,
      trend: s.trend,
      dataQuality: s.dataQuality,
      categoryScores: s.categoryScores,
      evaluatedDate: s.computedAt ? s.computedAt.toISOString() : null,
      confidence: s.confidence,
      variance: s.variance,
      isPartial: s.isPartial,
      falseRefusalRate: s.falseRefusalRate,
      netHelpfulness: s.netHelpfulness,
      benignRefusalCount: s.benignRefusalCount,
      benignTotalCount: s.benignTotalCount,
      refusedBenignCaseIds: s.refusedBenignCaseIds,
    }))
  );

  const categoryRows = await db
    .select()
    .from(schema.categories)
    .orderBy(schema.categories.name);

  await writeJson(
    "categories",
    categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      label: c.label,
      description: c.description,
      question: c.question,
      icon: c.icon,
      weight: c.weight,
    }))
  );

  const testCaseRows = await db
    .select({
      id: schema.testCases.id,
      categoryId: schema.testCases.categoryId,
      categoryName: schema.categories.name,
      prompt: schema.testCases.prompt,
      expectedBehavior: schema.testCases.expectedBehavior,
      severity: schema.testCases.severity,
      description: schema.testCases.description,
      ageBrackets: schema.testCases.ageBrackets,
      modality: schema.testCases.modality,
      isActive: schema.testCases.isActive,
    })
    .from(schema.testCases)
    .leftJoin(schema.categories, eq(schema.testCases.categoryId, schema.categories.id))
    .orderBy(schema.testCases.id);

  await writeJson("test-cases", testCaseRows);

  // Published insights only — drafts and retracted reports stay private.
  let insightsRows: Array<Record<string, unknown>> = [];
  try {
    const rows = await db
      .select()
      .from(schema.insightsReports)
      .where(eq(schema.insightsReports.status, "published"))
      .orderBy(desc(schema.insightsReports.generatedAt));
    insightsRows = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      status: r.status,
      generatedAt: r.generatedAt.toISOString(),
      dataThrough: r.dataThrough.toISOString(),
      aggregates: r.aggregates,
      narrative: r.narrative,
      generatorModel: r.generatorModel,
    }));
  } catch (err) {
    console.warn(
      "[insights] insights_reports query failed; writing empty array:",
      err instanceof Error ? err.message : err
    );
  }
  await writeJson("insights-reports", insightsRows);

  await writeJson("meta", {
    snapshotAt: new Date().toISOString(),
    counts: {
      models: modelRows.length,
      activeModels: modelRows.filter((m) => m.isActive).length,
      scores: latestByModelSurface.length,
      categories: categoryRows.length,
      testCases: testCaseRows.length,
      insightsReports: insightsRows.length,
    },
  });

  console.log("\nSnapshot complete. Commit src/data/snapshot/ and set FROZEN=1.");
}

main().catch((err) => {
  console.error("Snapshot failed:", err);
  process.exit(1);
});
