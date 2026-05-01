/**
 * Browser-eval orchestrator (parentbench-orx).
 *
 * Pure orchestration: takes an adapter + a page factory + a few side-
 * effect hooks (screenshot, operator pause, paired-API rerun trigger),
 * runs each test case, and persists results as it goes.
 *
 * Persistence is append-only JSONL. Resume reads the JSONL and skips
 * cases marked `status: "ok"`. Infrastructure failures (timeouts,
 * challenge intercepts) are recorded but not counted as completed —
 * they get retried on the next pass.
 *
 * The runner deliberately does NOT call into Playwright or Postgres
 * directly. Those wires are injected via `RunnerDeps` so unit tests
 * can drive the orchestrator without a browser or DB.
 */

import path from "path";
import type { Page } from "playwright";
import type { BrowserAdapter, BrowserProvider } from "@/lib/eval/browser-adapters";
import { ChallengeError } from "@/lib/eval/browser-adapters/_dom";
import type {
  AdapterResult,
  SerializedTestCase,
} from "@/lib/eval/adapters";
import {
  appendCaseResult,
  readCompletedCaseIds,
  type CaseResultLine,
} from "./jsonl";
import { appendIncident } from "./incidents";

// ============================================================================
// TYPES
// ============================================================================

export interface PageHandle {
  page: Page;
  close: () => Promise<void>;
}

export interface ScreenshotContext {
  page: Page;
  caseId: string;
  outDir: string;
}

export interface ApiRerunPayload {
  modelSlug: string;
  reason: "paired-with-consumer-run";
  consumerRunId: string;
}

export interface RunnerDeps {
  adapter: BrowserAdapter;
  pageFactory: () => Promise<PageHandle>;
  captureScreenshot: (ctx: ScreenshotContext) => Promise<void>;
  /** Pause for the operator (typically: prompt on stdin). Resolves when ready. */
  operatorPause: (message: string) => Promise<void>;
  /** Fire the paired API re-run for the same model. Idempotent on the receiver side. */
  triggerApiRerun: (payload: ApiRerunPayload) => Promise<void>;
  runDir: string;
  runId: string;
  provider: BrowserProvider;
  account: string;
  modelSlug: string;
  /** Optional: cap retries after a challenge pause (default 1). */
  maxRetriesPerCase?: number;
}

export interface RunnerSummary {
  runId: string;
  total: number;
  completed: number;
  infrastructureFailures: number;
  durationMs: number;
}

// ============================================================================
// MAIN
// ============================================================================

function isChallengeError(err: unknown): err is ChallengeError {
  return err instanceof ChallengeError;
}

export async function runBrowserEval(
  testCases: SerializedTestCase[],
  deps: RunnerDeps
): Promise<RunnerSummary> {
  const start = Date.now();
  const resultsPath = path.join(deps.runDir, "results.jsonl");
  const incidentsPath = path.join(deps.runDir, "incidents.jsonl");
  const failuresDir = path.join(deps.runDir, "failures");

  const completedIds = readCompletedCaseIds(resultsPath);
  const remaining = testCases.filter((tc) => !completedIds.has(tc.id));

  const handle = await deps.pageFactory();
  const page = handle.page;
  const maxRetries = deps.maxRetriesPerCase ?? 1;

  let infrastructureFailures = 0;

  try {
    await deps.adapter.ensureAuthenticated(page);

    for (const testCase of remaining) {
      const lineForCase = await runOneCase(testCase, page, deps, {
        incidentsPath,
        failuresDir,
        maxRetries,
      });
      appendCaseResult(resultsPath, lineForCase);
      if (lineForCase.status === "infrastructure_failure") {
        infrastructureFailures += 1;
      }
    }
  } finally {
    await handle.close();
  }

  // Paired API re-run: every consumer publication queues a fresh API run
  // for the same model so the comparison panel always has comparable
  // pair (parentbench-d95 §2b recency guardrail).
  await deps.triggerApiRerun({
    modelSlug: deps.modelSlug,
    reason: "paired-with-consumer-run",
    consumerRunId: deps.runId,
  });

  const completed =
    readCompletedCaseIds(resultsPath).size; // includes any earlier resume rows
  return {
    runId: deps.runId,
    total: testCases.length,
    completed,
    infrastructureFailures,
    durationMs: Date.now() - start,
  };
}

async function runOneCase(
  testCase: SerializedTestCase,
  page: Page,
  deps: RunnerDeps,
  io: { incidentsPath: string; failuresDir: string; maxRetries: number }
): Promise<CaseResultLine> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= io.maxRetries) {
    attempt += 1;
    try {
      await deps.adapter.newConversation(page);
      const result: AdapterResult = await deps.adapter.run(page, testCase);
      return {
        caseId: testCase.id,
        status: "ok",
        response: result.response,
        score: result.score,
        passed: result.passed,
        latencyMs:
          typeof result.metadata?.latencyMs === "number"
            ? (result.metadata.latencyMs as number)
            : 0,
        metadata: result.metadata ?? {},
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      lastErr = err;
      if (isChallengeError(err) && attempt <= io.maxRetries) {
        // Challenge — log incident, ask operator to solve, retry.
        const pauseStart = Date.now();
        appendIncident(io.incidentsPath, {
          timestamp: new Date().toISOString(),
          kind: "challenge",
          provider: deps.provider,
          caseId: testCase.id,
          message:
            err instanceof Error ? err.message : String(err),
        });
        await deps.operatorPause(
          `[${deps.provider}] case ${testCase.id} hit a challenge. Solve in the browser, then press Enter to retry.`
        );
        appendIncident(io.incidentsPath, {
          timestamp: new Date().toISOString(),
          kind: "retry",
          provider: deps.provider,
          caseId: testCase.id,
          message: "operator-resumed",
          durationMs: Date.now() - pauseStart,
        });
        continue;
      }

      // Non-challenge or retries exhausted: capture a screenshot, then
      // record the failure and move on.
      try {
        await deps.captureScreenshot({
          page,
          caseId: testCase.id,
          outDir: io.failuresDir,
        });
      } catch {
        // Screenshot is best-effort — don't let it bury the original error.
      }
      break;
    }
  }

  return {
    caseId: testCase.id,
    status: "infrastructure_failure",
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    timestamp: new Date().toISOString(),
  };
}
