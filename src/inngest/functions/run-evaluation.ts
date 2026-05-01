import { inngest } from "../client";
import { db } from "@/db";
import { evaluations, testCases, evalResults, scores, models, categories } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { runModelAdapter } from "@/lib/eval/adapters";
import { computeScore } from "@/lib/eval/scorer";
import { judgeResponse, JUDGE_MODEL } from "@/lib/eval/judge";
import { calculateCost, checkBudgetAlerts } from "@/lib/costs";

// Global feature flag to enable LLM-as-judge (defaults to true)
// Can be overridden per-trigger via event.data.useLlmJudge
const USE_LLM_JUDGE_DEFAULT = process.env.USE_LLM_JUDGE !== "false";

// Number of test cases to sample per category for scheduled runs
// Set to 0 or negative to disable sampling (run all)
const SAMPLE_SIZE_PER_CATEGORY = 5;

/**
 * Fan-out/fan-in evaluation job
 *
 * When an evaluation is requested:
 * 1. Create evaluation record
 * 2. Fan-out: run each test case as a parallel step
 * 3. Fan-in: aggregate results and compute score
 * 4. Send completion event
 */
export const runEvaluation = inngest.createFunction(
  {
    id: "run-evaluation",
    retries: 3,
    concurrency: {
      limit: 5, // Max 5 concurrent evaluations
    },
    onFailure: async ({ event, error }) => {
      // Mark evaluation as failed when all retries are exhausted.
      // Match by inngestRunId (stored on the row at create time) — far more
      // reliable than "most recent running for this model", which mis-targets
      // when concurrent runs exist.
      const failedRunId = event.data.run_id;
      const { modelId } = event.data.event.data;

      try {
        let target: { id: string; status: string } | undefined;

        if (failedRunId) {
          const [byRunId] = await db
            .select({ id: evaluations.id, status: evaluations.status })
            .from(evaluations)
            .where(eq(evaluations.inngestRunId, failedRunId))
            .limit(1);
          target = byRunId;
        }

        // Fallback: most recent running for this model (legacy path)
        if (!target && modelId) {
          const [byModel] = await db
            .select({ id: evaluations.id, status: evaluations.status })
            .from(evaluations)
            .where(eq(evaluations.modelId, modelId))
            .orderBy(desc(evaluations.createdAt))
            .limit(1);
          target = byModel;
        }

        if (target && target.status === "running") {
          await db
            .update(evaluations)
            .set({
              status: "failed",
              errorMessage: error.message || "Evaluation failed after all retries",
              completedAt: new Date(),
            })
            .where(eq(evaluations.id, target.id));

          console.error(`Marked evaluation ${target.id} as failed: ${error.message}`);
        }
      } catch (dbError) {
        console.error("Failed to mark evaluation as failed:", dbError);
      }
    },
    triggers: [{ event: "eval/requested" }],
  },
  async ({ event, step, runId }) => {
    const { modelId, modelSlug, triggeredBy } = event.data;

    // Per-trigger overrides (scheduled runs disable judge and enable sampling)
    const useLlmJudge = event.data.useLlmJudge ?? USE_LLM_JUDGE_DEFAULT;
    const sampleTestCases = event.data.sampleTestCases ?? false;

    // Step 0: Preflight check - validate judge model is available
    if (useLlmJudge) {
      await step.run("preflight-check-judge", async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error("ANTHROPIC_API_KEY not configured - required for LLM judge");
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: JUDGE_MODEL,
            max_tokens: 1,
            messages: [{ role: "user", content: "test" }],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.error?.type === "not_found_error") {
            throw new Error(`Judge model "${JUDGE_MODEL}" not found. Please update JUDGE_MODEL in run-evaluation.ts`);
          }
          // Other errors (rate limit, etc.) are OK - model exists
        }

        return { judgeModel: JUDGE_MODEL, status: "available" };
      });
    }

    // Step 1: Create evaluation record
    const evaluation = await step.run("create-evaluation", async () => {
      const [eval_] = await db
        .insert(evaluations)
        .values({
          modelId,
          status: "running",
          triggeredBy,
          inngestRunId: runId,
          startedAt: new Date(),
          // API track always writes api-default explicitly.
          surface: "api-default",
        })
        .returning();

      return eval_;
    });

    // Step 2: Get all active test cases and categories (avoid N+1 queries)
    const activeTestCases = await step.run("get-test-cases", async () => {
      return db
        .select()
        .from(testCases)
        .where(eq(testCases.isActive, true));
    });

    // Prefetch all categories for efficient lookup. We need both the
    // (id → name) map (judge prompt lookup) and the full meta with
    // weights (scorer aggregation).
    const categoryMeta = await step.run("get-categories", async () => {
      const allCategories = await db.select().from(categories);
      return Object.fromEntries(
        allCategories.map((c) => [c.id, { name: c.name, weight: c.weight }])
      ) as Record<string, { name: string; weight: number }>;
    });
    const categoryMap = Object.fromEntries(
      Object.entries(categoryMeta).map(([id, m]) => [id, m.name])
    ) as Record<string, string>;

    // Step 2b: Sample test cases if requested (stratified by category)
    const testCasesToRun = await step.run("select-test-cases", async () => {
      if (!sampleTestCases || SAMPLE_SIZE_PER_CATEGORY <= 0) {
        return activeTestCases;
      }

      // Group by category. Benign cases (kind='benign', categoryId=null)
      // bypass per-category sampling — they're a small set, take them all.
      const byCategory = new Map<string, typeof activeTestCases>();
      const benignAll: typeof activeTestCases = [];
      for (const tc of activeTestCases) {
        if (tc.kind === "benign" || tc.categoryId === null) {
          benignAll.push(tc);
          continue;
        }
        const group = byCategory.get(tc.categoryId) ?? [];
        group.push(tc);
        byCategory.set(tc.categoryId, group);
      }

      // Sample N from each safety category using Fisher-Yates partial shuffle
      const sampled: typeof activeTestCases = [...benignAll];
      for (const [, cases] of byCategory) {
        const n = Math.min(SAMPLE_SIZE_PER_CATEGORY, cases.length);
        // Shuffle first n elements
        for (let i = 0; i < n; i++) {
          const j = i + Math.floor(Math.random() * (cases.length - i));
          [cases[i], cases[j]] = [cases[j], cases[i]];
        }
        sampled.push(...cases.slice(0, n));
      }

      return sampled;
    });

    // Update total test case count
    await step.run("update-total-count", async () => {
      await db
        .update(evaluations)
        .set({ totalTestCases: testCasesToRun.length })
        .where(eq(evaluations.id, evaluation.id));
    });

    // Step 3: Fan-out - run test cases in parallel batches
    const batchSize = 10;
    const results: Array<{
      testCaseId: string;
      passed: boolean;
      score: number;
      response?: string;
      error?: string;
      latencyMs?: number;
      inputTokens?: number;
      outputTokens?: number;
      metadata?: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < testCasesToRun.length; i += batchSize) {
      const batch = testCasesToRun.slice(i, i + batchSize);

      const batchResults = await step.run(
        `run-batch-${Math.floor(i / batchSize)}`,
        async () => {
          // Parallelize within the batch: GPT-5 family
          // latencies of 20-40s × 10 sequential calls × +judge call put a
          // single batch over the Vercel function timeout (~300s on Pro).
          // Promise.all collapses wall-clock per step from sum-of-N to
          // max-of-N; one slow call no longer blocks the rest.
          return Promise.all(
            batch.map(async (testCase) => {
              try {
                const startTime = Date.now();
                const result = await runModelAdapter(modelSlug, testCase);
                const latencyMs = Date.now() - startTime;

                let finalPassed = result.passed;
                let finalScore = result.score;
                let metadata: Record<string, unknown> = { ...(result.metadata ?? {}) };

                // Skip the LLM judge for benign cases:
                // benign scoring is "did the model refuse?" — the refusal-detection
                // heuristic is the load-bearing signal; a category-rubric judge
                // would mis-grade them. Plus benign cases have no categoryId.
                const isBenign = testCase.kind === "benign";
                if (useLlmJudge && result.response && !isBenign && testCase.categoryId) {
                  try {
                    const categoryName = categoryMap[testCase.categoryId] || "age_inappropriate_content";
                    const judgeResult = await judgeResponse(testCase, result.response, categoryName);

                    finalPassed = judgeResult.passed;
                    finalScore = judgeResult.score;
                    metadata = {
                      ...metadata,
                      judgeReasoning: judgeResult.reasoning,
                      judgeConfidence: judgeResult.confidence,
                      heuristicPassed: result.passed,
                      heuristicScore: result.score,
                    };
                  } catch (judgeError) {
                    console.error("Judge evaluation failed, using heuristic:", judgeError);
                    metadata.judgeError = judgeError instanceof Error ? judgeError.message : "Unknown judge error";
                  }
                }

                return {
                  testCaseId: testCase.id,
                  passed: finalPassed,
                  score: finalScore,
                  response: result.response,
                  latencyMs,
                  inputTokens: result.usage.inputTokens,
                  outputTokens: result.usage.outputTokens,
                  metadata,
                };
              } catch (error) {
                return {
                  testCaseId: testCase.id,
                  passed: false,
                  score: 0,
                  error: error instanceof Error ? error.message : "Unknown error",
                };
              }
            })
          );
        }
      );

      results.push(...batchResults);

      // Update progress
      await step.run(`update-progress-${Math.floor(i / batchSize)}`, async () => {
        const completedCount = results.filter((r) => !r.error).length;
        const failedCount = results.filter((r) => r.error).length;

        await db
          .update(evaluations)
          .set({
            completedTestCases: completedCount,
            failedTestCases: failedCount,
          })
          .where(eq(evaluations.id, evaluation.id));
      });
    }

    // Step 4: Store results
    await step.run("store-results", async () => {
      for (const result of results) {
        await db.insert(evalResults).values({
          evaluationId: evaluation.id,
          testCaseId: result.testCaseId,
          response: result.response,
          score: result.score,
          passed: result.passed,
          latencyMs: result.latencyMs,
          errorMessage: result.error,
          metadata: result.metadata,
        });
      }
    });

    const fullSafetyCount = activeTestCases.filter((tc) => tc.kind === "safety").length;
    const fullBenignCount = activeTestCases.filter((tc) => tc.kind === "benign").length;

    const finalScore = await step.run("compute-score", async () => {
      const score = await computeScore(results, testCasesToRun, categoryMeta, {
        fullSafetyCount,
        fullBenignCount,
      });

      // Get previous score for trend. This is the API track — filter
      // to api-default so a fresh consumer-track row doesn't masquerade
      // as the prior API score.
      const [previousScore] = await db
        .select()
        .from(scores)
        .where(
          and(
            eq(scores.modelId, modelId),
            eq(scores.surface, "api-default")
          )
        )
        .orderBy(scores.computedAt)
        .limit(1);

      const trend = previousScore
        ? score.overallScore > previousScore.overallScore
          ? "up"
          : score.overallScore < previousScore.overallScore
          ? "down"
          : "stable"
        : "new";

      // Store the score
      const [newScore] = await db
        .insert(scores)
        .values({
          modelId,
          overallScore: score.overallScore,
          overallGrade: score.overallGrade as "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F",
          trend: trend as "up" | "down" | "stable" | "new",
          dataQuality: "verified",
          categoryScores: score.categoryScores,
          evaluationId: evaluation.id,
          isPartial: score.isPartial,
          // API track always writes api-default explicitly. The column's
          // DEFAULT covers historical rows; new writes are intentional.
          surface: "api-default",
          // parentbench-rg3.2 over-alignment fields (nullable)
          falseRefusalRate: score.falseRefusalRate,
          netHelpfulness: score.netHelpfulness,
          benignRefusalCount: score.benignRefusalCount,
          benignTotalCount: score.benignTotalCount,
          refusedBenignCaseIds: score.refusedBenignCaseIds,
        })
        .returning();

      return { newScore, previousScore, trend };
    });

    // Step 6: Calculate costs and mark evaluation as complete
    const costData = await step.run("complete-evaluation", async () => {
      // Sum up token usage from all results
      const totalInputTokens = results.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
      const totalOutputTokens = results.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);

      // Calculate total cost
      const totalCostUsd = calculateCost(modelSlug, totalInputTokens, totalOutputTokens);

      await db
        .update(evaluations)
        .set({
          status: "completed",
          completedAt: new Date(),
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalCostUsd,
        })
        .where(eq(evaluations.id, evaluation.id));

      return { totalInputTokens, totalOutputTokens, totalCostUsd };
    });

    // Step 6b: Check budget alerts
    await step.run("check-budget-alerts", async () => {
      try {
        await checkBudgetAlerts();
      } catch (error) {
        // Don't fail the evaluation if budget check fails
        console.error("Budget alert check failed:", error);
      }
    });

    // Step 7: Send completion event
    await step.sendEvent("send-completion-event", {
      name: "eval/completed",
      data: {
        evaluationId: evaluation.id,
        modelId,
        modelSlug,
        overallScore: finalScore.newScore.overallScore,
        success: true,
      },
    });

    // Step 8: Check if score changed significantly and send alert
    if (finalScore.previousScore) {
      const changeAmount =
        finalScore.newScore.overallScore - finalScore.previousScore.overallScore;

      if (Math.abs(changeAmount) >= 5) {
        const [model] = await db
          .select()
          .from(models)
          .where(eq(models.id, modelId));

        await step.sendEvent("send-score-alert", {
          name: "alert/score-changed",
          data: {
            modelId,
            modelSlug,
            modelName: model?.name || modelSlug,
            previousScore: finalScore.previousScore.overallScore,
            newScore: finalScore.newScore.overallScore,
            changeAmount,
          },
        });
      }
    }

    return {
      evaluationId: evaluation.id,
      overallScore: finalScore.newScore.overallScore,
      testCasesRun: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      cost: costData,
    };
  }
);
