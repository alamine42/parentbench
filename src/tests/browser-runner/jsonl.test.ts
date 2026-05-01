/**
 * Append-only JSONL persistence tests for parentbench-orx.
 *
 * Crash safety: each per-case result is appended immediately, so
 * --resume <run-id> can rebuild "what's done" from the file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  appendCaseResult,
  readCompletedCaseIds,
  type CaseResultLine,
} from "@/lib/eval/browser-runner/jsonl";

let tmpFile: string;

beforeEach(() => {
  tmpFile = path.join(
    os.tmpdir(),
    `runner-jsonl-test-${process.pid}-${Date.now()}.jsonl`
  );
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.rmSync(tmpFile);
});

function makeLine(
  overrides: Partial<CaseResultLine> = {}
): CaseResultLine {
  // CaseResultLine is a discriminated union on `status`. Build the "ok"
  // variant by default, then if an override flips status, pivot to the
  // failure variant — keeps test cases tidy without `as any`.
  const base = {
    caseId: "tc-001",
    timestamp: new Date("2026-04-30T12:00:00Z").toISOString(),
    ...overrides,
  };
  if (overrides.status === "infrastructure_failure") {
    return {
      caseId: base.caseId,
      status: "infrastructure_failure",
      error:
        ("error" in overrides && typeof overrides.error === "string"
          ? overrides.error
          : undefined) ?? "synthetic-failure",
      timestamp: base.timestamp,
    };
  }
  return {
    caseId: base.caseId,
    response: "Paris.",
    score: 100,
    passed: true,
    latencyMs: 1234,
    metadata: {},
    timestamp: base.timestamp,
    ...overrides,
    status: "ok",
  } as CaseResultLine;
}

describe("appendCaseResult", () => {
  it("should_append_a_single_line_terminated_with_newline", () => {
    // Arrange + Act
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001" }));

    // Assert
    const raw = fs.readFileSync(tmpFile, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("should_append_subsequent_lines_without_overwriting", () => {
    // Arrange + Act
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001" }));
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-002" }));
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-003" }));

    // Assert
    const lines = fs.readFileSync(tmpFile, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).caseId).toBe("tc-001");
    expect(JSON.parse(lines[2]).caseId).toBe("tc-003");
  });

  it("should_serialize_each_line_as_a_self_contained_json_object", () => {
    // Arrange + Act
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001", score: 42 }));

    // Assert
    const raw = fs.readFileSync(tmpFile, "utf-8").trim();
    const parsed = JSON.parse(raw);
    expect(parsed.caseId).toBe("tc-001");
    expect(parsed.score).toBe(42);
  });
});

describe("readCompletedCaseIds (resume support)", () => {
  it("should_return_empty_set_when_file_does_not_exist", () => {
    const result = readCompletedCaseIds(tmpFile);
    expect(result.size).toBe(0);
  });

  it("should_return_empty_set_when_file_is_empty", () => {
    fs.writeFileSync(tmpFile, "");
    const result = readCompletedCaseIds(tmpFile);
    expect(result.size).toBe(0);
  });

  it("should_collect_case_ids_from_every_ok_line", () => {
    // Arrange
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001" }));
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-002" }));
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-003" }));

    // Act
    const result = readCompletedCaseIds(tmpFile);

    // Assert
    expect(result).toEqual(new Set(["tc-001", "tc-002", "tc-003"]));
  });

  it("should_treat_infrastructure_failure_lines_as_NOT_completed", () => {
    // Infrastructure failures (timeout, challenge mid-stream) are skipped
    // for scoring — the resume path must re-run them.
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001", status: "ok" }));
    appendCaseResult(
      tmpFile,
      makeLine({
        caseId: "tc-002",
        status: "infrastructure_failure",
        error: "timeout",
      })
    );

    // Act
    const result = readCompletedCaseIds(tmpFile);

    // Assert
    expect(result).toEqual(new Set(["tc-001"]));
  });

  it("should_skip_corrupt_lines_without_crashing", () => {
    // Arrange — a partially-written line during a crash would be invalid.
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-001" }));
    fs.appendFileSync(tmpFile, "{not-json\n");
    appendCaseResult(tmpFile, makeLine({ caseId: "tc-003" }));

    // Act
    const result = readCompletedCaseIds(tmpFile);

    // Assert
    expect(result).toEqual(new Set(["tc-001", "tc-003"]));
  });
});
