/**
 * Chaos Testing: Inngest Failures
 *
 * Tests graceful degradation when Inngest background jobs encounter:
 * - Job failures and retries
 * - Timeouts
 * - Step failures
 * - Concurrency limits
 * - Event delivery failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Inngest
vi.mock("inngest", () => {
  return {
    Inngest: vi.fn().mockImplementation(() => ({
      createFunction: vi.fn(),
      send: vi.fn(),
    })),
  };
});

describe("Inngest Chaos Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Job Retry Behavior", () => {
    it("should retry failed jobs up to max attempts", async () => {
      let attempts = 0;
      const maxRetries = 3;

      const jobHandler = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error("Temporary failure");
        }
        return { success: true };
      });

      // Simulate Inngest retry behavior
      let result;
      let lastError;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          result = await jobHandler();
          break;
        } catch (error) {
          lastError = error;
        }
      }

      expect(attempts).toBe(3);
      expect(result).toEqual({ success: true });
      expect(jobHandler).toHaveBeenCalledTimes(3);
    });

    it("should fail after exhausting all retries", async () => {
      const maxRetries = 3;
      let attempts = 0;

      const jobHandler = vi.fn().mockImplementation(async () => {
        attempts++;
        throw new Error("Persistent failure");
      });

      let finalError;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          await jobHandler();
        } catch (error) {
          finalError = error;
        }
      }

      expect(attempts).toBe(maxRetries + 1);
      expect(finalError).toBeInstanceOf(Error);
      expect((finalError as Error).message).toBe("Persistent failure");
    });

    it("should handle non-retryable errors immediately", async () => {
      let attempts = 0;

      // Some errors should not be retried
      class NonRetryableError extends Error {
        public readonly isRetryable = false;
      }

      const jobHandler = vi.fn().mockImplementation(async () => {
        attempts++;
        throw new NonRetryableError("Invalid configuration - do not retry");
      });

      const executeWithSmartRetry = async (handler: () => Promise<unknown>, maxRetries: number) => {
        for (let i = 0; i <= maxRetries; i++) {
          try {
            return await handler();
          } catch (error) {
            if (error instanceof NonRetryableError || (error as { isRetryable?: boolean }).isRetryable === false) {
              throw error;
            }
            if (i === maxRetries) throw error;
          }
        }
      };

      await expect(executeWithSmartRetry(jobHandler, 3)).rejects.toThrow(
        "Invalid configuration"
      );
      expect(attempts).toBe(1); // Should not retry
    });
  });

  describe("Step Failures", () => {
    it("should handle individual step failures in multi-step job", async () => {
      const stepResults: { step: string; status: "success" | "failed" }[] = [];

      const runStep = vi.fn().mockImplementation(async (stepName: string, handler: () => Promise<unknown>) => {
        try {
          const result = await handler();
          stepResults.push({ step: stepName, status: "success" });
          return result;
        } catch (error) {
          stepResults.push({ step: stepName, status: "failed" });
          throw error;
        }
      });

      const evaluationJob = async () => {
        await runStep("create-evaluation", async () => ({ id: "eval-1" }));
        await runStep("get-test-cases", async () => [{ id: "tc-1" }]);
        await runStep("run-tests", async () => {
          throw new Error("Model API unavailable");
        });
        await runStep("compute-score", async () => ({ score: 85 }));
      };

      await expect(evaluationJob()).rejects.toThrow("Model API unavailable");

      expect(stepResults).toEqual([
        { step: "create-evaluation", status: "success" },
        { step: "get-test-cases", status: "success" },
        { step: "run-tests", status: "failed" },
      ]);
      // compute-score should not have been called
      expect(stepResults.find((s) => s.step === "compute-score")).toBeUndefined();
    });

    it("should resume from last successful step on retry", async () => {
      const completedSteps = new Set<string>();
      let runAttempt = 0;

      const runStep = vi.fn().mockImplementation(
        async (stepName: string, handler: () => Promise<unknown>) => {
          // Skip already completed steps (Inngest step memoization)
          if (completedSteps.has(stepName)) {
            return { cached: true };
          }

          const result = await handler();
          completedSteps.add(stepName);
          return result;
        }
      );

      const evaluationJob = async () => {
        runAttempt++;
        await runStep("step-1", async () => "result-1");
        await runStep("step-2", async () => "result-2");

        // Fail on first attempt only
        if (runAttempt === 1) {
          throw new Error("Transient failure");
        }

        await runStep("step-3", async () => "result-3");
        return { success: true };
      };

      // First attempt fails
      try {
        await evaluationJob();
      } catch (e) {
        // Expected
      }

      expect(completedSteps.size).toBe(2);

      // Second attempt succeeds
      const result = await evaluationJob();
      expect(result).toEqual({ success: true });
      expect(completedSteps.size).toBe(3);
      expect(runAttempt).toBe(2);
    });
  });

  describe("Timeout Handling", () => {
    it("should handle job timeout gracefully", async () => {
      const timeoutMs = 100;

      const slowJob = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { completed: true };
      });

      const runWithTimeout = async <T>(
        handler: () => Promise<T>,
        timeout: number
      ): Promise<T> => {
        return Promise.race([
          handler(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Job timed out")), timeout)
          ),
        ]);
      };

      await expect(runWithTimeout(slowJob, timeoutMs)).rejects.toThrow("Job timed out");
    });

    it("should handle step timeout separately from job timeout", async () => {
      const stepTimeout = 50;

      const runStepWithTimeout = async (
        stepName: string,
        handler: () => Promise<unknown>,
        timeout: number
      ) => {
        return Promise.race([
          handler(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Step '${stepName}' timed out after ${timeout}ms`)),
              timeout
            )
          ),
        ]);
      };

      const slowStep = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      };

      await expect(
        runStepWithTimeout("slow-step", slowStep, stepTimeout)
      ).rejects.toThrow("Step 'slow-step' timed out");
    });

    it("should mark evaluation as failed on timeout", async () => {
      const mockUpdateEvaluation = vi.fn();

      const evaluationRunner = async (evaluationId: string) => {
        try {
          // Simulate slow operation
          await new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Job timed out")), 10)
          );
        } catch (error) {
          if ((error as Error).message.includes("timed out")) {
            await mockUpdateEvaluation(evaluationId, {
              status: "failed",
              errorMessage: "Evaluation timed out",
              completedAt: new Date(),
            });
          }
          throw error;
        }
      };

      await expect(evaluationRunner("eval-123")).rejects.toThrow("timed out");
      expect(mockUpdateEvaluation).toHaveBeenCalledWith(
        "eval-123",
        expect.objectContaining({
          status: "failed",
          errorMessage: "Evaluation timed out",
        })
      );
    });
  });

  describe("Concurrency Limit Handling", () => {
    it("should queue jobs when concurrency limit reached", async () => {
      const concurrencyLimit = 5;
      let runningJobs = 0;
      let maxConcurrent = 0;
      const jobQueue: Array<() => Promise<unknown>> = [];

      const runJob = vi.fn().mockImplementation(async (jobFn: () => Promise<unknown>) => {
        if (runningJobs >= concurrencyLimit) {
          // Queue the job
          return new Promise((resolve) => {
            jobQueue.push(async () => {
              const result = await jobFn();
              resolve(result);
            });
          });
        }

        runningJobs++;
        maxConcurrent = Math.max(maxConcurrent, runningJobs);

        try {
          return await jobFn();
        } finally {
          runningJobs--;
          // Process queued jobs
          if (jobQueue.length > 0) {
            const nextJob = jobQueue.shift()!;
            runJob(nextJob);
          }
        }
      });

      // Submit 10 jobs at once
      const jobs = Array.from({ length: 10 }, (_, i) =>
        runJob(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { jobId: i };
        })
      );

      await Promise.all(jobs);

      expect(maxConcurrent).toBeLessThanOrEqual(concurrencyLimit);
    });

    it("should prevent duplicate evaluation runs for same model", async () => {
      const activeEvaluations = new Set<string>();

      const startEvaluation = vi.fn().mockImplementation(async (modelId: string) => {
        if (activeEvaluations.has(modelId)) {
          throw new Error(`Evaluation already in progress for model ${modelId}`);
        }

        activeEvaluations.add(modelId);
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { modelId, completed: true };
        } finally {
          activeEvaluations.delete(modelId);
        }
      });

      // Start first evaluation
      const eval1 = startEvaluation("model-1");

      // Try to start second evaluation for same model
      await expect(startEvaluation("model-1")).rejects.toThrow(
        "Evaluation already in progress"
      );

      // First evaluation should complete successfully
      await expect(eval1).resolves.toEqual({ modelId: "model-1", completed: true });
    });
  });

  describe("Event Delivery Failures", () => {
    it("should handle event send failures", async () => {
      const mockSendEvent = vi.fn().mockRejectedValue(
        new Error("Failed to send event: network error")
      );

      const sendEventWithRetry = async (
        event: { name: string; data: unknown },
        maxRetries: number
      ) => {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockSendEvent(event);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      };

      await expect(
        sendEventWithRetry({ name: "eval/completed", data: {} }, 3)
      ).rejects.toThrow("network error");

      expect(mockSendEvent).toHaveBeenCalledTimes(3);
    });

    it("should handle event validation failures", async () => {
      const validateEvent = (event: { name: string; data: unknown }) => {
        if (!event.name) {
          throw new Error("Event name is required");
        }
        if (!event.data) {
          throw new Error("Event data is required");
        }
        if (typeof event.data !== "object") {
          throw new Error("Event data must be an object");
        }
        return true;
      };

      expect(() => validateEvent({ name: "", data: {} })).toThrow("Event name is required");
      expect(() => validateEvent({ name: "test", data: null as unknown as object })).toThrow(
        "Event data is required"
      );
      expect(validateEvent({ name: "test", data: { foo: "bar" } })).toBe(true);
    });

    it("should handle missing event handlers gracefully", async () => {
      const eventHandlers: Record<string, (data: unknown) => Promise<unknown>> = {
        "eval/completed": async (data) => ({ handled: true, data }),
      };

      const processEvent = async (event: { name: string; data: unknown }) => {
        const handler = eventHandlers[event.name];
        if (!handler) {
          console.warn(`No handler found for event: ${event.name}`);
          return { handled: false, reason: "no_handler" };
        }
        return handler(event.data);
      };

      const unknownEvent = await processEvent({
        name: "unknown/event",
        data: {},
      });
      expect(unknownEvent).toEqual({ handled: false, reason: "no_handler" });

      const knownEvent = await processEvent({
        name: "eval/completed",
        data: { id: "123" },
      });
      expect(knownEvent).toEqual({ handled: true, data: { id: "123" } });
    });
  });

  describe("OnFailure Handler", () => {
    it("should mark evaluation as failed when all retries exhausted", async () => {
      const mockDb = {
        evaluations: [] as Array<{ id: string; modelId: string; status: string; errorMessage?: string }>,
        update: vi.fn(),
      };

      // Simulate onFailure handler from run-evaluation.ts
      const onFailure = async ({ event, error }: { event: { data: { event: { data: { modelId: string } } } }; error: Error }) => {
        const { modelId } = event.data.event.data;

        // Find running evaluation for this model
        const runningEval = mockDb.evaluations.find(
          (e) => e.modelId === modelId && e.status === "running"
        );

        if (runningEval) {
          runningEval.status = "failed";
          runningEval.errorMessage = error.message || "Evaluation failed after all retries";
        }
      };

      // Setup: Create a running evaluation
      mockDb.evaluations.push({
        id: "eval-1",
        modelId: "model-1",
        status: "running",
      });

      // Trigger onFailure
      await onFailure({
        event: { data: { event: { data: { modelId: "model-1" } } } },
        error: new Error("API rate limit exceeded"),
      });

      expect(mockDb.evaluations[0].status).toBe("failed");
      expect(mockDb.evaluations[0].errorMessage).toBe("API rate limit exceeded");
    });

    it("should handle onFailure errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const onFailure = async () => {
        try {
          throw new Error("Database unavailable in onFailure");
        } catch (dbError) {
          console.error("Failed to mark evaluation as failed:", dbError);
        }
      };

      await onFailure();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to mark evaluation as failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Partial Success Handling", () => {
    it("should track partial progress when batch fails mid-execution", async () => {
      const results: Array<{ testCaseId: string; passed: boolean; error?: string }> = [];

      const runBatch = async (testCases: Array<{ id: string }>) => {
        for (let i = 0; i < testCases.length; i++) {
          if (i === 3) {
            throw new Error("API quota exceeded");
          }
          results.push({
            testCaseId: testCases[i].id,
            passed: true,
          });
        }
      };

      const testCases = Array.from({ length: 5 }, (_, i) => ({ id: `tc-${i}` }));

      try {
        await runBatch(testCases);
      } catch (e) {
        // Expected
      }

      // Should have partial results
      expect(results.length).toBe(3);
      expect(results.map((r) => r.testCaseId)).toEqual(["tc-0", "tc-1", "tc-2"]);
    });

    it("should save partial results before failing", async () => {
      const savedResults: Array<{ id: string; result: unknown }> = [];
      const mockSave = vi.fn().mockImplementation((result: { id: string; result: unknown }) => {
        savedResults.push(result);
      });

      const runEvaluationWithSave = async (testCases: Array<{ id: string }>) => {
        for (const tc of testCases) {
          try {
            if (tc.id === "tc-fail") {
              throw new Error("Test execution failed");
            }
            const result = { passed: true, score: 100 };
            mockSave({ id: tc.id, result });
          } catch (error) {
            mockSave({
              id: tc.id,
              result: { passed: false, error: (error as Error).message },
            });
            throw error;
          }
        }
      };

      const testCases = [{ id: "tc-1" }, { id: "tc-2" }, { id: "tc-fail" }, { id: "tc-3" }];

      try {
        await runEvaluationWithSave(testCases);
      } catch (e) {
        // Expected
      }

      expect(savedResults.length).toBe(3);
      expect(savedResults[2]).toEqual({
        id: "tc-fail",
        result: { passed: false, error: "Test execution failed" },
      });
    });

    it("should compute partial score from available results", async () => {
      const computePartialScore = (
        results: Array<{ passed: boolean; score: number }>,
        totalExpected: number
      ) => {
        if (results.length === 0) return null;

        const completedScore =
          results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const completionRate = results.length / totalExpected;

        return {
          score: completedScore,
          completionRate,
          isPartial: results.length < totalExpected,
          completedTests: results.length,
          totalTests: totalExpected,
        };
      };

      const results = [
        { passed: true, score: 100 },
        { passed: true, score: 80 },
        { passed: false, score: 0 },
      ];

      const partialScore = computePartialScore(results, 10);

      expect(partialScore).toEqual({
        score: 60,
        completionRate: 0.3,
        isPartial: true,
        completedTests: 3,
        totalTests: 10,
      });
    });
  });
});
