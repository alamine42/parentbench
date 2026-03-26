import { inngest } from "../client";
import { db } from "@/db";
import { evaluations, testCases, evalResults, scores, models, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { runModelAdapter } from "@/lib/eval/adapters";
import { computeScore } from "@/lib/eval/scorer";
import { judgeResponse, JUDGE_MODEL } from "@/lib/eval/judge";

// Feature flag to enable LLM-as-judge (defaults to true)
const USE_LLM_JUDGE = process.env.USE_LLM_JUDGE !== "false";

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
      // Mark evaluation as failed when all retries are exhausted
      const { modelId } = event.data.event.data;

      try {
        // Find the most recent running evaluation for this model
        const [runningEval] = await db
          .select()
          .from(evaluations)
          .where(eq(evaluations.modelId, modelId))
          .orderBy(desc(evaluations.createdAt))
          .limit(1);

        if (runningEval && runningEval.status === "running") {
          await db
            .update(evaluations)
            .set({
              status: "failed",
              errorMessage: error.message || "Evaluation failed after all retries",
              completedAt: new Date(),
            })
            .where(eq(evaluations.id, runningEval.id));

          console.error(`Marked evaluation ${runningEval.id} as failed: ${error.message}`);
        }
      } catch (dbError) {
        console.error("Failed to mark evaluation as failed:", dbError);
      }
    },
    triggers: [{ event: "eval/requested" }],
  },
  async ({ event, step, runId }) => {
    const { modelId, modelSlug, triggeredBy } = event.data;

    // Step 0: Preflight check - validate judge model is available
    if (USE_LLM_JUDGE) {
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

    // Prefetch all categories for efficient lookup
    const categoryMap = await step.run("get-categories", async () => {
      const allCategories = await db.select().from(categories);
      return Object.fromEntries(
        allCategories.map((c) => [c.id, c.name])
      ) as Record<string, string>;
    });

    // Update total test case count
    await step.run("update-total-count", async () => {
      await db
        .update(evaluations)
        .set({ totalTestCases: activeTestCases.length })
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
      metadata?: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < activeTestCases.length; i += batchSize) {
      const batch = activeTestCases.slice(i, i + batchSize);

      const batchResults = await step.run(
        `run-batch-${Math.floor(i / batchSize)}`,
        async () => {
          const batchResults = [];

          for (const testCase of batch) {
            try {
              const startTime = Date.now();
              const result = await runModelAdapter(modelSlug, testCase);
              const latencyMs = Date.now() - startTime;

              // Use LLM-as-judge if enabled
              let finalPassed = result.passed;
              let finalScore = result.score;
              let metadata: Record<string, unknown> = { ...(result.metadata ?? {}) };

              if (USE_LLM_JUDGE && result.response) {
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
                  // Fall back to heuristic if judge fails
                  console.error("Judge evaluation failed, using heuristic:", judgeError);
                  metadata.judgeError = judgeError instanceof Error ? judgeError.message : "Unknown judge error";
                }
              }

              batchResults.push({
                testCaseId: testCase.id,
                passed: finalPassed,
                score: finalScore,
                response: result.response,
                latencyMs,
                metadata,
              });
            } catch (error) {
              batchResults.push({
                testCaseId: testCase.id,
                passed: false,
                score: 0,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return batchResults;
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

    // Step 5: Compute and store score
    const finalScore = await step.run("compute-score", async () => {
      const score = await computeScore(results, activeTestCases);

      // Get previous score for trend
      const [previousScore] = await db
        .select()
        .from(scores)
        .where(eq(scores.modelId, modelId))
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
        })
        .returning();

      return { newScore, previousScore, trend };
    });

    // Step 6: Mark evaluation as complete
    await step.run("complete-evaluation", async () => {
      await db
        .update(evaluations)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(evaluations.id, evaluation.id));
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
    };
  }
);
