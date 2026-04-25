/**
 * Trigger-decision logic (parentbench-ov1.4).
 *
 * Pure function over an `eval/completed` event payload. Returns whether
 * the insights pipeline should regenerate as a result.
 *
 * Other trigger sources (model/created, eval/active-tier-promoted,
 * manual) bypass this decision — they always fire (subject to debounce
 * for organic events; bypass-debounce for manual).
 */

const SIGNIFICANT_DELTA = 5; // matches alert/score-changed threshold
                             // (run-evaluation.ts:373)

export type EvalCompletedPayload = {
  modelTier: "active" | "standard" | "maintenance" | "paused";
  newScore: number;
  previousScore: number | null;
};

export function shouldTriggerRegen(payload: EvalCompletedPayload): boolean {
  if (payload.modelTier !== "active") return false;
  if (payload.previousScore === null) return false;
  const delta = Math.abs(payload.newScore - payload.previousScore);
  return delta >= SIGNIFICANT_DELTA;
}
