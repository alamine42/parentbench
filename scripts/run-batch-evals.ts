#!/usr/bin/env npx tsx
/**
 * Run evaluations on all remaining models (batch)
 * Skips: o3, o3-pro (expensive reasoning models)
 * Skips: already evaluated models
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const ALREADY_EVALUATED = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "gpt-5-4",
  "gemini-2-5-pro",
];

const SKIP_MODELS = [
  // OpenAI reasoning models (expensive)
  "o3",
  "o3-pro",
  // Together AI models (no API key configured)
  "llama-3-1-405b",
  "mistral-large-2",
  "command-r-plus",
  "deepseek-v3",
];

const ALL_MODELS = [
  // OpenAI
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-1",
  "gpt-4-1-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5-4",
  "gpt-5-4-pro",
  "gpt-5-4-mini",
  "gpt-5-4-nano",
  "o3",
  "o3-pro",
  // Anthropic
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-opus-4-1",
  "claude-sonnet-4",
  "claude-opus-4",
  // Google (verified to exist)
  "gemini-2-5-pro",
  "gemini-2-5-flash",
  "gemini-2-0-flash",
  "gemini-2-0-flash-lite",
  "gemini-1-5-pro",
  "gemini-1-5-flash",
  // Together AI models excluded - no TOGETHER_API_KEY configured
  // "llama-3-1-405b",
  // "mistral-large-2",
  // "command-r-plus",
  // "deepseek-v3",
];

async function runEvaluation(modelSlug: string): Promise<{ success: boolean; score?: number; error?: string }> {
  const { db } = await import("../src/db/index.js");
  const { models, testCases, evaluations, evalResults, scores, categories } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const { runModelAdapter } = await import("../src/lib/eval/adapters/index.js");
  const { computeScore } = await import("../src/lib/eval/scorer.js");

  // Load category meta once — passed into every computeScore call below
  const allCategories = await db.select().from(categories);
  const categoryMeta = Object.fromEntries(
    allCategories.map((c) => [c.id, { name: c.name, weight: c.weight }])
  ) as Record<string, { name: string; weight: number }>;

  try {
    // Get model
    const [model] = await db.select().from(models).where(eq(models.slug, modelSlug)).limit(1);
    if (!model) {
      return { success: false, error: `Model not found: ${modelSlug}` };
    }

    // Get all active test cases
    const allTestCases = await db.select().from(testCases).where(eq(testCases.isActive, true));
    if (allTestCases.length === 0) {
      return { success: false, error: "No active test cases" };
    }

    // Create evaluation record
    const [evaluation] = await db.insert(evaluations).values({
      modelId: model.id,
      status: "running",
      triggeredBy: "batch-script",
    }).returning();

    console.log(`  Running ${allTestCases.length} test cases...`);

    // Run all test cases
    const results: Array<{
      testCaseId: string;
      passed: boolean;
      score: number;
      response?: string;
      latencyMs: number;
      error?: string;
    }> = [];

    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];
      const start = Date.now();

      try {
        const serializedTc = {
          ...tc,
          createdAt: tc.createdAt.toISOString(),
          updatedAt: tc.updatedAt.toISOString(),
        };

        const result = await runModelAdapter(modelSlug, serializedTc);
        const latencyMs = Date.now() - start;

        results.push({
          testCaseId: tc.id,
          passed: result.passed,
          score: result.score,
          response: result.response,
          latencyMs,
        });

        process.stdout.write(`\r  Progress: ${i + 1}/${allTestCases.length} (${results.filter(r => r.passed).length} passed)`);
      } catch (err) {
        const latencyMs = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          testCaseId: tc.id,
          passed: false,
          score: 0,
          error: errorMsg,
          latencyMs,
        });
      }
    }

    console.log(); // newline after progress

    // Store results
    for (const result of results) {
      await db.insert(evalResults).values({
        evaluationId: evaluation.id,
        testCaseId: result.testCaseId,
        response: result.response,
        passed: result.passed,
        score: result.score,
        latencyMs: result.latencyMs,
        errorMessage: result.error,
      });
    }

    // Compute final score
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

    // Update evaluation
    await db.update(evaluations)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(evaluations.id, evaluation.id));

    // Store score
    await db.insert(scores).values({
      modelId: model.id,
      evaluationId: evaluation.id,
      overallScore: finalScore.overallScore,
      overallGrade: finalScore.overallGrade as "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F",
      categoryScores: finalScore.categoryScores,
      isPartial: finalScore.isPartial,
      falseRefusalRate: finalScore.falseRefusalRate,
      netHelpfulness: finalScore.netHelpfulness,
      benignRefusalCount: finalScore.benignRefusalCount,
      benignTotalCount: finalScore.benignTotalCount,
      refusedBenignCaseIds: finalScore.refusedBenignCaseIds,
    });

    return { success: true, score: finalScore.overallScore };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const modelsToRun = ALL_MODELS.filter(
    m => !ALREADY_EVALUATED.includes(m) && !SKIP_MODELS.includes(m)
  );

  console.log("=".repeat(60));
  console.log("BATCH EVALUATION");
  console.log("=".repeat(60));
  console.log(`Models to evaluate: ${modelsToRun.length}`);
  console.log(`Skipping (already done): ${ALREADY_EVALUATED.join(", ")}`);
  console.log(`Skipping (expensive): ${SKIP_MODELS.join(", ")}`);
  console.log("=".repeat(60));
  console.log();

  const results: Array<{ model: string; success: boolean; score?: number; error?: string }> = [];

  for (let i = 0; i < modelsToRun.length; i++) {
    const model = modelsToRun[i];
    console.log(`[${i + 1}/${modelsToRun.length}] Evaluating: ${model}`);

    const result = await runEvaluation(model);
    results.push({ model, ...result });

    if (result.success) {
      console.log(`  ✓ Score: ${result.score?.toFixed(2)}`);
    } else {
      console.log(`  ✗ Error: ${result.error}`);
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Successful: ${successful.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log("\nScores:");
    for (const r of successful.sort((a, b) => (b.score || 0) - (a.score || 0))) {
      console.log(`  ${r.model}: ${r.score?.toFixed(2)}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed models:");
    for (const r of failed) {
      console.log(`  ${r.model}: ${r.error}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Run 'npx tsx scripts/export-scores.ts' to update JSON");
  console.log("=".repeat(60));

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(console.error);
