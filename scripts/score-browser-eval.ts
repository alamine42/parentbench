#!/usr/bin/env npx tsx
/**
 * Score a completed browser-eval run and persist evaluations + scores
 * to Postgres with surface='web-product' (parentbench-orx).
 *
 * Reads results.jsonl from reports/web/<run-id>/, runs the same
 * computeScore + judgeResponse pipeline used by the API track, and
 * writes:
 *   - one `evaluations` row (surface='web-product')
 *   - one `eval_results` row per case
 *   - one `scores` row (surface='web-product')
 *
 * Usage:
 *   npx tsx scripts/score-browser-eval.ts --run-id run-2026-04-30-chatgpt-001 --model-slug gpt-5
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { readAllCaseLines } from "@/lib/eval/browser-runner/jsonl";

type Args = {
  runId: string;
  modelSlug: string;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const runId = get("--run-id");
  const modelSlug = get("--model-slug");
  if (!runId) throw new Error("--run-id required");
  if (!modelSlug) throw new Error("--model-slug required");
  return { runId, modelSlug };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.join(process.cwd(), "reports", "web", args.runId);
  const resultsPath = path.join(runDir, "results.jsonl");
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`No results.jsonl at ${resultsPath}`);
  }

  const { db } = await import("../src/db");
  const {
    models,
    evaluations,
    evalResults,
    scores,
    testCases,
    categories,
  } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const { computeScore } = await import("../src/lib/eval/scorer");
  const { judgeResponse } = await import("../src/lib/eval/judge");
  const { serializeTestCaseRow } = await import("../src/lib/eval/adapters/index.js");

  // Resolve model.
  const [model] = await db
    .select()
    .from(models)
    .where(eq(models.slug, args.modelSlug))
    .limit(1);
  if (!model) {
    throw new Error(`Model not found: ${args.modelSlug}`);
  }

  // Load test cases + categories.
  const allTestCases = await db
    .select()
    .from(testCases)
    .where(eq(testCases.isActive, true));
  const tcById = new Map(allTestCases.map((tc) => [tc.id, tc]));

  const allCategories = await db.select().from(categories);
  const categoryMeta = Object.fromEntries(
    allCategories.map((c) => [c.id, { name: c.name, weight: c.weight }])
  );
  const categoryNameById: Record<string, string> = Object.fromEntries(
    Object.entries(categoryMeta).map(([id, m]) => [id, m.name])
  );

  // Load runner output.
  const lines = readAllCaseLines(resultsPath);
  const okLines = lines.filter((l) => l.status === "ok");
  console.log(
    `[score] ${args.runId}: ${okLines.length}/${lines.length} ok lines`
  );

  // Insert evaluations row.
  const [evaluation] = await db
    .insert(evaluations)
    .values({
      modelId: model.id,
      status: "running",
      triggeredBy: "browser-eval-cli",
      surface: "web-product",
      startedAt: new Date(),
      totalTestCases: lines.length,
    })
    .returning();

  // Score each ok line via the LLM judge (skipping benign cases per
  // existing API-track conventions).
  type ScoredResult = {
    testCaseId: string;
    passed: boolean;
    score: number;
    response?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    metadata?: Record<string, unknown>;
    error?: string;
  };
  const scored: ScoredResult[] = [];

  for (const line of lines) {
    if (line.status !== "ok") {
      scored.push({
        testCaseId: line.caseId,
        passed: false,
        score: 0,
        error: line.error,
      });
      continue;
    }
    const tc = tcById.get(line.caseId);
    if (!tc) {
      console.warn(`[score] unknown case ${line.caseId}`);
      continue;
    }
    let finalPassed = line.passed;
    let finalScore = line.score;
    let metadata: Record<string, unknown> = { ...(line.metadata ?? {}) };
    const isBenign = tc.kind === "benign";
    if (line.response && !isBenign && tc.categoryId) {
      try {
        const categoryName =
          categoryNameById[tc.categoryId] ?? "age_inappropriate_content";
        const judge = await judgeResponse(
          serializeTestCaseRow(tc),
          line.response,
          categoryName
        );
        finalPassed = judge.passed;
        finalScore = judge.score;
        metadata = {
          ...metadata,
          judgeReasoning: judge.reasoning,
          judgeConfidence: judge.confidence,
        };
      } catch (err) {
        metadata.judgeError =
          err instanceof Error ? err.message : "Unknown judge error";
      }
    }
    scored.push({
      testCaseId: line.caseId,
      passed: finalPassed,
      score: finalScore,
      response: line.response,
      latencyMs: line.latencyMs,
      metadata,
    });
  }

  // Insert eval_results.
  for (const r of scored) {
    await db.insert(evalResults).values({
      evaluationId: evaluation.id,
      testCaseId: r.testCaseId,
      response: r.response,
      score: r.score,
      passed: r.passed,
      latencyMs: r.latencyMs,
      errorMessage: r.error,
      metadata: r.metadata,
    });
  }

  // Compute aggregate.
  const fullSafetyCount = allTestCases.filter(
    (tc) => tc.kind === "safety"
  ).length;
  const fullBenignCount = allTestCases.filter(
    (tc) => tc.kind === "benign"
  ).length;
  const tcsForScoring = allTestCases
    .filter((tc) => scored.some((s) => s.testCaseId === tc.id))
    .map(serializeTestCaseRow);
  const score = await computeScore(
    scored,
    tcsForScoring,
    categoryMeta,
    { fullSafetyCount, fullBenignCount }
  );

  // Insert scores row.
  await db.insert(scores).values({
    modelId: model.id,
    overallScore: score.overallScore,
    overallGrade: score.overallGrade as
      | "A+"
      | "A"
      | "A-"
      | "B+"
      | "B"
      | "B-"
      | "C+"
      | "C"
      | "C-"
      | "D+"
      | "D"
      | "D-"
      | "F",
    trend: "new",
    dataQuality: "verified",
    categoryScores: score.categoryScores,
    evaluationId: evaluation.id,
    isPartial: score.isPartial,
    surface: "web-product",
    falseRefusalRate: score.falseRefusalRate,
    netHelpfulness: score.netHelpfulness,
    benignRefusalCount: score.benignRefusalCount,
    benignTotalCount: score.benignTotalCount,
    refusedBenignCaseIds: score.refusedBenignCaseIds,
  });

  // Mark evaluation complete.
  await db
    .update(evaluations)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedTestCases: scored.filter((s) => !s.error).length,
      failedTestCases: scored.filter((s) => s.error).length,
    })
    .where(eq(evaluations.id, evaluation.id));

  console.log(
    `[score] Done. overall=${score.overallScore} grade=${score.overallGrade}`
  );
}

main().catch((err) => {
  console.error("[score] fatal:", err);
  process.exit(1);
});
