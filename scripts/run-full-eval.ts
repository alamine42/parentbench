#!/usr/bin/env npx tsx
/**
 * Run full evaluation for a model
 * Usage: npx tsx scripts/run-full-eval.ts <model-slug>
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models, testCases, evaluations, evalResults, scores, categories } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const { runModelAdapter } = await import("../src/lib/eval/adapters/index.js");
  const { computeScore } = await import("../src/lib/eval/scorer.js");

  const allCategories = await db.select().from(categories);
  const categoryMeta = Object.fromEntries(
    allCategories.map((c) => [c.id, { name: c.name, weight: c.weight }])
  ) as Record<string, { name: string; weight: number }>;

  const modelSlug = process.argv[2] || "claude-opus-4-6";
  console.log(`\n🚀 Running FULL evaluation for: ${modelSlug}\n`);

  // Get model
  const [model] = await db
    .select()
    .from(models)
    .where(eq(models.slug, modelSlug))
    .limit(1);

  if (!model) {
    console.error(`❌ Model not found: ${modelSlug}`);
    process.exit(1);
  }

  console.log(`Model: ${model.name} (ID: ${model.id})`);

  // Create evaluation record
  const [evaluation] = await db
    .insert(evaluations)
    .values({
      modelId: model.id,
      status: "running",
      triggeredBy: "manual-script",
      startedAt: new Date(),
    })
    .returning();

  console.log(`Created evaluation: ${evaluation.id}`);

  // Get all active test cases
  const allTestCases = await db
    .select()
    .from(testCases)
    .where(eq(testCases.isActive, true));

  console.log(`Running ${allTestCases.length} test cases...\n`);

  // Update total count
  await db
    .update(evaluations)
    .set({ totalTestCases: allTestCases.length })
    .where(eq(evaluations.id, evaluation.id));

  const results: Array<{
    testCaseId: string;
    passed: boolean;
    score: number;
    response?: string;
    error?: string;
  }> = [];

  let completed = 0;
  let passed = 0;
  let failed = 0;

  for (const tc of allTestCases) {
    process.stdout.write(`[${completed + 1}/${allTestCases.length}] ${tc.id}: `);

    try {
      const result = await runModelAdapter(modelSlug, {
        ...tc,
        createdAt: tc.createdAt.toISOString(),
        updatedAt: tc.updatedAt.toISOString(),
      });

      // Store result
      await db.insert(evalResults).values({
        evaluationId: evaluation.id,
        testCaseId: tc.id,
        response: result.response,
        score: result.score,
        passed: result.passed,
      });

      results.push({
        testCaseId: tc.id,
        passed: result.passed,
        score: result.score,
        response: result.response,
      });

      if (result.passed) {
        console.log(`✅ PASSED (${result.score})`);
        passed++;
      } else {
        console.log(`❌ FAILED (${result.score})`);
        failed++;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.log(`⚠️ ERROR: ${errMsg}`);

      results.push({
        testCaseId: tc.id,
        passed: false,
        score: 0,
        error: errMsg,
      });
      failed++;
    }

    completed++;

    // Update progress every 10 tests
    if (completed % 10 === 0) {
      await db
        .update(evaluations)
        .set({ completedTestCases: completed })
        .where(eq(evaluations.id, evaluation.id));
    }
  }

  // Compute final score
  console.log("\n📊 Computing final score...");
  const serializedTestCases = allTestCases.map(tc => ({
    ...tc,
    createdAt: tc.createdAt.toISOString(),
    updatedAt: tc.updatedAt.toISOString(),
  }));
  const fullSafetyCount = serializedTestCases.filter((tc) => tc.kind === "safety").length;
  const fullBenignCount = serializedTestCases.filter((tc) => tc.kind === "benign").length;
  const finalScore = await computeScore(results, serializedTestCases, categoryMeta, {
    fullSafetyCount,
    fullBenignCount,
  });

  // Get previous score for trend
  const [previousScore] = await db
    .select()
    .from(scores)
    .where(eq(scores.modelId, model.id))
    .orderBy(scores.computedAt)
    .limit(1);

  const trend = previousScore
    ? finalScore.overallScore > previousScore.overallScore
      ? "up"
      : finalScore.overallScore < previousScore.overallScore
      ? "down"
      : "stable"
    : "new";

  // Store the score
  await db.insert(scores).values({
    modelId: model.id,
    overallScore: finalScore.overallScore,
    overallGrade: finalScore.overallGrade as any,
    trend: trend as any,
    dataQuality: "verified",
    categoryScores: finalScore.categoryScores,
    evaluationId: evaluation.id,
    isPartial: finalScore.isPartial,
    falseRefusalRate: finalScore.falseRefusalRate,
    netHelpfulness: finalScore.netHelpfulness,
    benignRefusalCount: finalScore.benignRefusalCount,
    benignTotalCount: finalScore.benignTotalCount,
    refusedBenignCaseIds: finalScore.refusedBenignCaseIds,
  });

  // Mark evaluation complete
  await db
    .update(evaluations)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedTestCases: completed,
      failedTestCases: failed,
    })
    .where(eq(evaluations.id, evaluation.id));

  console.log("\n" + "═".repeat(50));
  console.log(`EVALUATION COMPLETE: ${model.name}`);
  console.log("═".repeat(50));
  console.log(`Tests: ${passed} passed, ${failed} failed (${allTestCases.length} total)`);
  console.log(`Overall Score: ${finalScore.overallScore}`);
  console.log(`Overall Grade: ${finalScore.overallGrade}`);
  console.log(`Trend: ${trend}`);
  console.log("\nCategory Scores:");
  for (const cs of finalScore.categoryScores) {
    console.log(`  ${cs.category}: ${cs.score} (${cs.grade}) - ${cs.passRate}% pass rate`);
  }
  console.log("═".repeat(50));

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
