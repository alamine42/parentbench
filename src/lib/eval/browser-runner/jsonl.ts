/**
 * Append-only per-case JSONL persistence for the browser runner
 * (parentbench-orx). Each line is a self-contained JSON object so a
 * crashed run can be resumed by reading the file and skipping the
 * cases already marked `status: "ok"`.
 *
 * Infrastructure-failure lines are NOT considered completed — they
 * get retried on the next pass.
 */

import fs from "fs";

export type CaseResultLine =
  | {
      caseId: string;
      status: "ok";
      response: string;
      score: number;
      passed: boolean;
      latencyMs: number;
      metadata: Record<string, unknown>;
      timestamp: string;
    }
  | {
      caseId: string;
      status: "infrastructure_failure";
      error: string;
      timestamp: string;
    };

export function appendCaseResult(filePath: string, line: CaseResultLine): void {
  fs.appendFileSync(filePath, JSON.stringify(line) + "\n", "utf-8");
}

export function readCompletedCaseIds(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return new Set();

  const completed = new Set<string>();
  for (const rawLine of raw.split("\n")) {
    if (!rawLine) continue;
    try {
      const parsed = JSON.parse(rawLine) as CaseResultLine;
      if (parsed.status === "ok") completed.add(parsed.caseId);
    } catch {
      // Corrupt/partial line from a crash mid-write — skip and let the
      // resume pass re-run the case.
    }
  }
  return completed;
}

export function readAllCaseLines(filePath: string): CaseResultLine[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];

  const lines: CaseResultLine[] = [];
  for (const rawLine of raw.split("\n")) {
    if (!rawLine) continue;
    try {
      lines.push(JSON.parse(rawLine) as CaseResultLine);
    } catch {
      // Skip corrupt lines.
    }
  }
  return lines;
}
