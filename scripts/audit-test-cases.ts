#!/usr/bin/env npx tsx
/**
 * Per-case quality audit (parentbench-rg2.2).
 *
 * For each test case in the DB:
 *   - Compute pass rate, mean score, stddev across active-tier evals
 *   - Embed prompt+description via OpenAI text-embedding-3-small
 *   - Find nearest-neighbor by cosine similarity
 *   - Classify: keep / tweak / merge / drop
 *
 * Outputs a markdown report to reports/test-case-audit-<ISO>.md.
 *
 * Usage:
 *   npx tsx scripts/audit-test-cases.ts
 *   OPENAI_API_KEY=sk-... npx tsx scripts/audit-test-cases.ts --no-embeddings   # skip the embedding step
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync, existsSync } from "fs";

const EMBEDDING_MODEL = "text-embedding-3-small";

async function main() {
  const skipEmbeddings = process.argv.includes("--no-embeddings");

  const { db } = await import("../src/db/index.js");
  const { testCases, categories, evalResults, evaluations, models } = await import("../src/db/schema.js");
  const { eq, and, inArray } = await import("drizzle-orm");
  const { classifyTestCase, cosineSimilarity } = await import("../src/lib/audit/test-case-rules.js");

  // ---- Load active test cases + categories ----
  const allTestCases = await db.select().from(testCases).where(eq(testCases.isActive, true));
  const categoryRows = await db.select().from(categories);
  const categoryNameById = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));

  console.log(`Loaded ${allTestCases.length} active test cases.\n`);

  // ---- Load eval_results for all of them ----
  // Restrict to results from completed active-tier evaluations to avoid
  // pulling in failed/sampled noise.
  const activeModelRows = await db.select({ id: models.id }).from(models).where(
    and(eq(models.isActive, true), eq(models.evalTier, "active"))
  );
  const activeModelIds = activeModelRows.map((r) => r.id);

  const completedEvals = await db
    .select({ id: evaluations.id, modelId: evaluations.modelId })
    .from(evaluations)
    .where(and(eq(evaluations.status, "completed"), inArray(evaluations.modelId, activeModelIds)));
  const completedEvalIds = completedEvals.map((e) => e.id);

  console.log(`Found ${completedEvalIds.length} completed active-tier evaluations.\n`);

  const allResults = completedEvalIds.length
    ? await db
        .select({
          testCaseId: evalResults.testCaseId,
          score: evalResults.score,
          passed: evalResults.passed,
        })
        .from(evalResults)
        .where(inArray(evalResults.evaluationId, completedEvalIds))
    : [];

  // ---- Aggregate per case ----
  const byCase = new Map<string, { scores: number[]; passes: number; total: number }>();
  for (const r of allResults) {
    const acc = byCase.get(r.testCaseId) ?? { scores: [], passes: 0, total: 0 };
    if (r.score !== null) acc.scores.push(r.score);
    if (r.passed) acc.passes++;
    acc.total++;
    byCase.set(r.testCaseId, acc);
  }

  // ---- Embeddings (optional) ----
  let embeddings: Map<string, number[]> = new Map();
  if (!skipEmbeddings) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY not set. Run with --no-embeddings to skip the similarity step.");
      process.exit(1);
    }
    embeddings = await fetchEmbeddings(allTestCases, apiKey);
    console.log(`Got ${embeddings.size} embeddings.\n`);
  }

  // ---- Build CaseStats ----
  const stats = allTestCases.map((tc) => {
    const agg = byCase.get(tc.id) ?? { scores: [], passes: 0, total: 0 };
    const meanScore = agg.scores.length ? mean(agg.scores) : 0;
    const stdDev = agg.scores.length > 1 ? stddev(agg.scores) : 0;
    const passRate = agg.total > 0 ? agg.passes / agg.total : 0;

    let nearestId: string | null = null;
    let nearestSim = 0;
    if (embeddings.size > 0) {
      const myVec = embeddings.get(tc.id);
      if (myVec) {
        for (const other of allTestCases) {
          if (other.id === tc.id) continue;
          const otherVec = embeddings.get(other.id);
          if (!otherVec) continue;
          const sim = cosineSimilarity(myVec, otherVec);
          if (sim > nearestSim) {
            nearestSim = sim;
            nearestId = other.id;
          }
        }
      }
    }

    return {
      tc,
      stats: {
        testCaseId: tc.id,
        evalCount: agg.total,
        passRate: round2(passRate),
        meanScore: round2(meanScore),
        stdDev: round2(stdDev),
        nearestNeighborId: nearestId,
        nearestNeighborSimilarity: round3(nearestSim),
      },
    };
  });

  // ---- Classify ----
  const classified = stats.map((s) => ({ ...s, classification: classifyTestCase(s.stats) }));

  // ---- Report ----
  if (!existsSync("reports")) mkdirSync("reports");
  const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const reportPath = `reports/test-case-audit-${dateStr}.md`;

  const counts = {
    keep: classified.filter((c) => c.classification.action === "keep").length,
    tweak: classified.filter((c) => c.classification.action === "tweak").length,
    merge: classified.filter((c) => c.classification.action === "merge").length,
    drop: classified.filter((c) => c.classification.action === "drop").length,
  };

  const sortOrder = { drop: 0, merge: 1, tweak: 2, keep: 3 } as const;
  const sorted = [...classified].sort((a, b) =>
    sortOrder[a.classification.action] - sortOrder[b.classification.action]
  );

  const lines: string[] = [];
  lines.push(`# Test-case audit — ${new Date().toISOString().slice(0, 10)}`);
  lines.push(``);
  lines.push(`Generated by \`scripts/audit-test-cases.ts\` (parentbench-rg2.2).`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Action | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| keep  | ${counts.keep} |`);
  lines.push(`| tweak | ${counts.tweak} |`);
  lines.push(`| merge | ${counts.merge} |`);
  lines.push(`| drop  | ${counts.drop} |`);
  lines.push(`| **total** | **${classified.length}** |`);
  lines.push(``);
  lines.push(`## Per-case findings (action priority)`);
  lines.push(``);
  lines.push(`| Action | ID | Category | Pass% | μ score | σ | n | Nearest (sim) | Reasons |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const c of sorted) {
    const cat = categoryNameById[c.tc.categoryId] ?? c.tc.categoryId;
    const nearest = c.stats.nearestNeighborId ? `${c.stats.nearestNeighborId.slice(0, 8)} (${c.stats.nearestNeighborSimilarity.toFixed(2)})` : "—";
    const reasons = c.classification.reasons.join(", ") || "—";
    lines.push(
      `| ${c.classification.action} | ${c.tc.id.slice(0, 8)} | ${cat.slice(0, 22)} | ${(c.stats.passRate * 100).toFixed(0)}% | ${c.stats.meanScore} | ${c.stats.stdDev} | ${c.stats.evalCount} | ${nearest} | ${reasons} |`
    );
  }
  lines.push(``);
  lines.push(`## Drop / merge actions (proposed)`);
  lines.push(``);
  for (const c of sorted) {
    if (c.classification.action === "keep") continue;
    lines.push(`### ${c.classification.action.toUpperCase()} — \`${c.tc.id}\``);
    lines.push(`- Category: ${categoryNameById[c.tc.categoryId]}`);
    lines.push(`- Prompt: "${c.tc.prompt.slice(0, 140)}${c.tc.prompt.length > 140 ? "…" : ""}"`);
    lines.push(`- Pass rate: ${(c.stats.passRate * 100).toFixed(1)}%, mean=${c.stats.meanScore}, σ=${c.stats.stdDev}, n=${c.stats.evalCount}`);
    if (c.stats.nearestNeighborId) {
      const neighbor = allTestCases.find((t) => t.id === c.stats.nearestNeighborId);
      lines.push(`- Nearest neighbor: \`${c.stats.nearestNeighborId}\` (cosine ${c.stats.nearestNeighborSimilarity.toFixed(3)})`);
      if (neighbor) {
        lines.push(`  - "${neighbor.prompt.slice(0, 140)}${neighbor.prompt.length > 140 ? "…" : ""}"`);
      }
    }
    lines.push(`- Reasons: ${c.classification.reasons.join(", ")}`);
    lines.push(``);
  }

  writeFileSync(reportPath, lines.join("\n"));
  console.log(`Report written: ${reportPath}\n`);
  console.log(`Counts: keep=${counts.keep}  tweak=${counts.tweak}  merge=${counts.merge}  drop=${counts.drop}`);

  // ---- Also emit a slim JSON for downstream rg2.3 ----
  const jsonPath = reportPath.replace(/\.md$/, ".json");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      classified.map((c) => ({
        id: c.tc.id,
        category: categoryNameById[c.tc.categoryId],
        action: c.classification.action,
        reasons: c.classification.reasons,
        stats: c.stats,
      })),
      null,
      2
    )
  );
  console.log(`Machine-readable: ${jsonPath}`);
  process.exit(0);
}

// ============================================================================
// EMBEDDING FETCH (chunked)
// ============================================================================

async function fetchEmbeddings(
  cases: Array<{ id: string; prompt: string; description: string }>,
  apiKey: string
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const BATCH = 16;
  for (let i = 0; i < cases.length; i += BATCH) {
    const slice = cases.slice(i, i + BATCH);
    const inputs = slice.map((c) => `${c.prompt}\n\n${c.description}`);

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
    });
    if (!res.ok) throw new Error(`Embedding API failed: ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
    for (const d of data.data) {
      out.set(slice[d.index].id, d.embedding);
    }
  }
  return out;
}

// ============================================================================
// STATS HELPERS
// ============================================================================

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
