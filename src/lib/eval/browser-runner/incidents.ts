/**
 * Incident logger for the browser runner (parentbench-orx). Captures
 * challenge pauses, retry events, and any other operational signal the
 * operator wants to review later for cadence analysis.
 */

import fs from "fs";

export type IncidentLine = {
  timestamp: string;
  kind: "challenge" | "retry" | "selector_rot" | "auth_expired";
  provider: string;
  caseId?: string;
  message: string;
  durationMs?: number;
};

export function appendIncident(
  filePath: string,
  incident: IncidentLine
): void {
  fs.appendFileSync(filePath, JSON.stringify(incident) + "\n", "utf-8");
}
