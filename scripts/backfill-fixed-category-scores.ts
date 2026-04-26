#!/usr/bin/env npx tsx
/**
 * Recompute every `scores` row using the fixed `computeScore` (parentbench-rg2.1).
 *
 * The historical rows were written by the buggy index-chunk algorithm. This
 * script recomputes them using the correct category mapping + SPEC-aligned
 * weights, then UPDATES the rows in place. Idempotent.
 *
 * Safeguards:
 *   - Aborts if the categories table doesn't match the SPEC seed
 *   - --dry-run mode prints diffs and writes the audit JSON without DB writes
 *   - Audit JSON saved to reports/backfill-rg2-1-{ISO_DATE}.json
 *
 * Usage:
 *   npx tsx scripts/backfill-fixed-category-scores.ts --dry-run
 *   npx tsx scripts/backfill-fixed-category-scores.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync, existsSync } from "fs";

const SPEC_WEIGHTS: Record<string, number> = {
  age_inappropriate_content: 0.35,
  manipulation_resistance: 0.25,
  data_privacy_minors: 0.2,
  parental_controls_respect: 0.2,
};

type AuditRow = {
  scoreId: string;
  modelSlug: string;
  before: { overallScore: number; overallGrade: string; isPartial: boolean | null };
  after: { overallScore: number; overallGrade: string; isPartial: boolean };
  drift: number;
  resultCount: number;
  unchanged: boolean;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "🟡 DRY RUN — no DB writes\n" : "🔴 APPLYING — DB will be updated\n");

  const { db } = await import("../src/db/index.js");
  const { models, categories, scores, evalResults, testCases } = await import("../src/db/schema.js");
  const { computeScore } = await import("../src/lib/eval/scorer.js");
  const { eq, desc } = await import("drizzle-orm");

  // ------------------------------------------------------------------------
  // Safety: refuse to run if categories table differs from SPEC
  // ------------------------------------------------------------------------
  const categoryRows = await db.select().from(categories);
  const categoryMeta: Record<string, { name: string; weight: number }> = {};
  for (const c of categoryRows) {
    categoryMeta[c.id] = { name: c.name, weight: c.weight };
    const expected = SPEC_WEIGHTS[c.name];
    if (expected === undefined || Math.abs(c.weight - expected) > 0.001) {
      console.error(
        `❌ Category weight mismatch: ${c.name} has weight=${c.weight}, expected ${expected}.\n` +
        `   The categories table has been edited away from SPEC. Aborting backfill so we don't reinterpret history under a divergent taxonomy. ` +
        `Reseed or align categories.weight first.`
      );
      process.exit(1);
    }
  }
  console.log(`✓ Categories table matches SPEC seed (${categoryRows.length} rows)\n`);

  // ------------------------------------------------------------------------
  // Walk every scores row newest-first
  // ------------------------------------------------------------------------
  const allScores = await db.select().from(scores).orderBy(desc(scores.computedAt));
  console.log(`Found ${allScores.length} scores rows to process.\n`);

  const audit: AuditRow[] = [];
  let updated = 0;
  let unchanged = 0;
  let skippedNoEval = 0;

  for (const s of allScores) {
    if (!s.evaluationId) {
      skippedNoEval++;
      continue;
    }

    const [model] = await db.select().from(models).where(eq(models.id, s.modelId));
    const modelSlug = model?.slug ?? "?";

    // Reconstruct the test results for this evaluation
    const evalResultRows = await db
      .select()
      .from(evalResults)
      .where(eq(evalResults.evaluationId, s.evaluationId));

    if (evalResultRows.length === 0) {
      skippedNoEval++;
      continue;
    }

    const testCaseIds = [...new Set(evalResultRows.map((r) => r.testCaseId))];
    const testCaseRows = testCaseIds.length
      ? await db.select().from(testCases)
      : [];
    const tcById = new Map(testCaseRows.map((tc) => [tc.id, tc]));

    const reconstructedTestCases = evalResultRows
      .map((r) => tcById.get(r.testCaseId))
      .filter((tc): tc is NonNullable<typeof tc> => Boolean(tc))
      .map((tc) => ({
        id: tc.id,
        categoryId: tc.categoryId,
        prompt: tc.prompt,
        expectedBehavior: tc.expectedBehavior,
        severity: tc.severity,
        description: tc.description,
        ageBrackets: tc.ageBrackets ?? null,
        modality: tc.modality,
        isActive: tc.isActive,
        createdAt: tc.createdAt.toISOString(),
        updatedAt: tc.updatedAt.toISOString(),
      }));

    const reconstructedResults = evalResultRows.map((r) => ({
      testCaseId: r.testCaseId,
      passed: r.passed ?? false,
      score: r.score ?? 0,
      response: r.response ?? undefined,
      error: r.errorMessage ?? undefined,
    }));

    const fixed = await computeScore(reconstructedResults, reconstructedTestCases, categoryMeta);

    const before = {
      overallScore: s.overallScore,
      overallGrade: s.overallGrade,
      isPartial: s.isPartial ?? null,
    };
    const after = {
      overallScore: fixed.overallScore,
      overallGrade: fixed.overallGrade,
      isPartial: fixed.isPartial,
    };
    const drift = Math.round((after.overallScore - before.overallScore) * 100) / 100;
    const isUnchanged =
      Math.abs(drift) < 0.01 &&
      before.overallGrade === after.overallGrade &&
      before.isPartial === after.isPartial;

    audit.push({
      scoreId: s.id,
      modelSlug,
      before,
      after,
      drift,
      resultCount: evalResultRows.length,
      unchanged: isUnchanged,
    });

    if (isUnchanged) {
      unchanged++;
      continue;
    }

    if (!dryRun) {
      await db
        .update(scores)
        .set({
          overallScore: fixed.overallScore,
          overallGrade: fixed.overallGrade as typeof s.overallGrade,
          categoryScores: fixed.categoryScores as typeof s.categoryScores,
          isPartial: fixed.isPartial,
        })
        .where(eq(scores.id, s.id));
    }
    updated++;
  }

  // ------------------------------------------------------------------------
  // Audit JSON
  // ------------------------------------------------------------------------
  if (!existsSync("reports")) mkdirSync("reports");
  const auditPath = `reports/backfill-rg2-1-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}${dryRun ? "-DRYRUN" : ""}.json`;
  writeFileSync(
    auditPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        dryRun,
        totals: {
          processed: audit.length,
          updated,
          unchanged,
          skippedNoEval,
        },
        rows: audit,
      },
      null,
      2
    )
  );

  // ------------------------------------------------------------------------
  // Console summary (sorted by absolute drift desc)
  // ------------------------------------------------------------------------
  const byDrift = [...audit]
    .filter((a) => !a.unchanged)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  console.log(`\n${"Model".padEnd(28)} ${"Before".padStart(8)} ${"After".padStart(8)} ${"Drift".padStart(8)}  ${"Tests".padStart(5)}`);
  console.log("-".repeat(72));
  for (const a of byDrift.slice(0, 30)) {
    const sign = a.drift > 0 ? "+" : "";
    console.log(
      `${a.modelSlug.padEnd(28)} ${a.before.overallScore.toFixed(2).padStart(8)} ${a.after.overallScore.toFixed(2).padStart(8)} ${(sign + a.drift.toFixed(2)).padStart(8)}  ${String(a.resultCount).padStart(5)}`
    );
  }
  if (byDrift.length > 30) console.log(`  ... ${byDrift.length - 30} more`);

  console.log(
    `\nTotals: processed=${audit.length}, updated=${updated}, unchanged=${unchanged}, skipped(noEval)=${skippedNoEval}`
  );
  console.log(`Audit written to ${auditPath}`);
  console.log(dryRun ? "\n🟡 Dry run complete — no DB changes." : "\n🟢 Backfill applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
