/**
 * Debounce decision (parentbench-ov1.4).
 *
 * Pure function over the time of the last *published* report and the
 * current time. Returns whether a regeneration should be suppressed.
 *
 * Failed/retracted reports are never passed in (the caller filters
 * status='published' first). The carry-forward "pending triggers"
 * concept is dropped — Inngest's event log is the audit trail
 * (Codex WARNING #1 fix).
 */

export const DEBOUNCE_WINDOW_HOURS = 12;

const HOUR = 60 * 60 * 1000;

export function shouldDebounce(input: {
  lastPublishedAt: Date | null;
  now: Date;
}): boolean {
  if (input.lastPublishedAt === null) return false;
  const elapsed = input.now.getTime() - input.lastPublishedAt.getTime();
  // Exact boundary is allowed — only suppress STRICTLY inside the window
  return elapsed < DEBOUNCE_WINDOW_HOURS * HOUR;
}
