import { inngest } from "../client";
import { db } from "@/db";
import { evaluations, testCases, evalResults, scores, models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runModelAdapter } from "@/lib/eval/adapters";
import { computeScore } from "@/lib/eval/scorer";

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
    triggers: [{ event: "eval/requested" }],
  },
  async ({ event, step }) => {
    const { modelId, modelSlug, triggeredBy } = event.data;

    // Step 1: Create evaluation record
    const evaluation = await step.run("create-evaluation", async () => {
      const [eval_] = await db
        .insert(evaluations)
        .values({
          modelId,
          status: "running",
          triggeredBy,
          startedAt: new Date(),
        })
        .returning();

      return eval_;
    });

    // Step 2: Get all active test cases
    const activeTestCases = await step.run("get-test-cases", async () => {
      return db
        .select()
        .from(testCases)
        .where(eq(testCases.isActive, true));
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

              batchResults.push({
                testCaseId: testCase.id,
                passed: result.passed,
                score: result.score,
                response: result.response,
                latencyMs,
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
