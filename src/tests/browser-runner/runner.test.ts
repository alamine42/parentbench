/**
 * Browser-runner orchestration tests for parentbench-orx.
 *
 * Tests the resume-from-crash behavior, challenge-pause loop,
 * screenshot-on-error, and paired-API-rerun trigger using fully
 * mocked adapters and persistence. No live browser, no real DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runBrowserEval } from "@/lib/eval/browser-runner/runner";
import type { RunnerDeps } from "@/lib/eval/browser-runner/runner";
import { ChallengeError } from "@/lib/eval/browser-adapters/_dom";
import type { SerializedTestCase } from "@/lib/eval/adapters";

const testCases: SerializedTestCase[] = [
  buildCase("tc-001"),
  buildCase("tc-002"),
  buildCase("tc-003"),
  buildCase("tc-004"),
  buildCase("tc-005"),
];

function buildCase(id: string): SerializedTestCase {
  return {
    id,
    categoryId: "cat-aic",
    kind: "safety",
    prompt: `prompt-${id}`,
    expectedBehavior: "refuse",
    severity: "critical",
    description: "",
    ageBrackets: ["10-12"],
    modality: "text",
    isActive: true,
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
  };
}

let workDir: string;

beforeEach(() => {
  workDir = path.join(
    os.tmpdir(),
    `runner-test-${process.pid}-${Date.now()}-${Math.random()}`
  );
  fs.mkdirSync(workDir, { recursive: true });
});

function buildDeps(overrides: Partial<RunnerDeps> = {}): RunnerDeps {
  return {
    adapter: {
      provider: "chatgpt",
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      newConversation: vi.fn().mockResolvedValue(undefined),
      run: vi
        .fn()
        .mockImplementation(async (_, tc: SerializedTestCase) => ({
          passed: true,
          score: 100,
          response: `response-${tc.id}`,
          usage: { inputTokens: 0, outputTokens: 0 },
          metadata: {},
        })),
    },
    pageFactory: vi.fn().mockResolvedValue({
      // Minimal Page-like stub — the runner only forwards to adapter.run.
      // The stub Page suffices because the test mock's `adapter.run` never
       // touches it — the runner just forwards. Cast keeps strict typing.
       page: {} as unknown as import("playwright").Page,
      close: vi.fn().mockResolvedValue(undefined),
    }),
    captureScreenshot: vi.fn().mockResolvedValue(undefined),
    operatorPause: vi.fn().mockResolvedValue(undefined),
    triggerApiRerun: vi.fn().mockResolvedValue(undefined),
    runDir: workDir,
    runId: "run-test",
    provider: "chatgpt",
    account: "adult",
    modelSlug: "gpt-5",
    ...overrides,
  };
}

describe("runBrowserEval — happy path", () => {
  it("should_invoke_adapter_run_for_every_test_case", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    await runBrowserEval(testCases, deps);

    // Assert
    expect(deps.adapter.run).toHaveBeenCalledTimes(testCases.length);
  });

  it("should_call_new_conversation_between_each_case", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    await runBrowserEval(testCases, deps);

    // Assert — once per test case (5).
    expect(deps.adapter.newConversation).toHaveBeenCalledTimes(
      testCases.length
    );
  });

  it("should_persist_one_jsonl_line_per_case", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    await runBrowserEval(testCases, deps);

    // Assert
    const jsonlPath = path.join(workDir, "results.jsonl");
    const lines = fs
      .readFileSync(jsonlPath, "utf-8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(testCases.length);
  });

  it("should_trigger_paired_api_rerun_after_finalizing", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    await runBrowserEval(testCases, deps);

    // Assert — exactly once, with the model slug.
    expect(deps.triggerApiRerun).toHaveBeenCalledTimes(1);
    expect(deps.triggerApiRerun).toHaveBeenCalledWith(
      expect.objectContaining({ modelSlug: "gpt-5" })
    );
  });
});

describe("runBrowserEval — resume", () => {
  it("should_skip_cases_already_present_in_jsonl_when_resuming", async () => {
    // Arrange — pre-seed the JSONL with two completed lines.
    const jsonlPath = path.join(workDir, "results.jsonl");
    fs.writeFileSync(
      jsonlPath,
      [
        JSON.stringify({
          caseId: "tc-001",
          status: "ok",
          response: "x",
          score: 100,
          passed: true,
          latencyMs: 100,
          metadata: {},
          timestamp: new Date().toISOString(),
        }),
        JSON.stringify({
          caseId: "tc-002",
          status: "ok",
          response: "x",
          score: 100,
          passed: true,
          latencyMs: 100,
          metadata: {},
          timestamp: new Date().toISOString(),
        }),
      ].join("\n") + "\n"
    );

    const deps = buildDeps();

    // Act
    await runBrowserEval(testCases, deps);

    // Assert — only the remaining 3 cases hit the adapter.
    expect(deps.adapter.run).toHaveBeenCalledTimes(3);
    const calledIds = (deps.adapter.run as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => (c[1] as SerializedTestCase).id)
      .sort();
    expect(calledIds).toEqual(["tc-003", "tc-004", "tc-005"]);
  });

  it("should_re_run_a_case_previously_marked_infrastructure_failure", async () => {
    // Arrange
    const jsonlPath = path.join(workDir, "results.jsonl");
    fs.writeFileSync(
      jsonlPath,
      JSON.stringify({
        caseId: "tc-001",
        status: "infrastructure_failure",
        error: "challenge-mid-stream",
        timestamp: new Date().toISOString(),
      }) + "\n"
    );

    const deps = buildDeps();

    // Act
    await runBrowserEval([testCases[0]], deps);

    // Assert
    expect(deps.adapter.run).toHaveBeenCalledTimes(1);
  });
});

describe("runBrowserEval — challenge pause", () => {
  it("should_call_operator_pause_when_adapter_throws_a_challenge_error", async () => {
    // Arrange — first call throws a challenge error, second call succeeds.
    let attempt = 0;
    const adapter = {
      provider: "chatgpt" as const,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      newConversation: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new ChallengeError("chatgpt", "during response wait");
        }
        return {
          passed: true,
          score: 100,
          response: "ok",
          usage: { inputTokens: 0, outputTokens: 0 },
          metadata: {},
        };
      }),
    };
    const operatorPause = vi.fn().mockResolvedValue(undefined);
    const deps = buildDeps({ adapter, operatorPause });

    // Act
    await runBrowserEval([testCases[0]], deps);

    // Assert — pause was invoked, then the case re-ran successfully.
    expect(operatorPause).toHaveBeenCalledTimes(1);
    expect(adapter.run).toHaveBeenCalledTimes(2);
  });

  it("should_log_an_incident_line_when_a_pause_occurs", async () => {
    // Arrange
    let attempt = 0;
    const adapter = {
      provider: "chatgpt" as const,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      newConversation: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) throw new ChallengeError("chatgpt", "during response wait");
        return {
          passed: true,
          score: 100,
          response: "ok",
          usage: { inputTokens: 0, outputTokens: 0 },
          metadata: {},
        };
      }),
    };
    const deps = buildDeps({ adapter });

    // Act
    await runBrowserEval([testCases[0]], deps);

    // Assert
    const incidentsPath = path.join(workDir, "incidents.jsonl");
    expect(fs.existsSync(incidentsPath)).toBe(true);
    const line = JSON.parse(
      fs.readFileSync(incidentsPath, "utf-8").trim().split("\n")[0]
    );
    expect(line.kind).toBe("challenge");
    expect(line.provider).toBe("chatgpt");
  });
});

describe("runBrowserEval — error handling", () => {
  it("should_capture_a_screenshot_on_non_challenge_adapter_error", async () => {
    // Arrange
    const adapter = {
      provider: "chatgpt" as const,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      newConversation: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockRejectedValue(new Error("selector not found")),
    };
    const captureScreenshot = vi.fn().mockResolvedValue(undefined);
    const deps = buildDeps({ adapter, captureScreenshot });

    // Act
    await runBrowserEval([testCases[0]], deps);

    // Assert
    expect(captureScreenshot).toHaveBeenCalledTimes(1);
    expect(captureScreenshot.mock.calls[0][0]).toMatchObject({
      caseId: "tc-001",
    });
  });

  it("should_record_failed_cases_as_infrastructure_failure_and_continue", async () => {
    // Arrange
    const adapter = {
      provider: "chatgpt" as const,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      newConversation: vi.fn().mockResolvedValue(undefined),
      run: vi
        .fn()
        // tc-001 fails, tc-002 + tc-003 succeed.
        .mockRejectedValueOnce(new Error("selector not found"))
        .mockResolvedValue({
          passed: true,
          score: 100,
          response: "ok",
          usage: { inputTokens: 0, outputTokens: 0 },
          metadata: {},
        }),
    };
    const deps = buildDeps({ adapter });

    // Act
    await runBrowserEval(testCases.slice(0, 3), deps);

    // Assert — all three cases recorded; the run kept going past the failure.
    const lines = fs
      .readFileSync(path.join(workDir, "results.jsonl"), "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      caseId: "tc-001",
      status: "infrastructure_failure",
    });
    expect(lines[1]).toMatchObject({ caseId: "tc-002", status: "ok" });
  });
});
