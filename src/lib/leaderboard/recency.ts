/**
 * Recency guardrail for the per-model surface comparison panel.
 * Returns the band that drives the panel UI:
 *   - "ok"     ≤ 14 days apart
 *   - "caveat" 14–30 days apart
 *   - "stale"  > 30 days apart, or either date missing/invalid
 */

export type RecencyBand = "ok" | "caveat" | "stale";

export type RecencyResult = {
  band: RecencyBand;
  /** Absolute days between the two dates. NaN when either is missing. */
  deltaDays: number;
};

const OK_THRESHOLD_DAYS = 14;
const CAVEAT_THRESHOLD_DAYS = 30;

export function compareRecency(
  dateA: string | null | undefined,
  dateB: string | null | undefined
): RecencyResult {
  if (!dateA || !dateB) return { band: "stale", deltaDays: NaN };

  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { band: "stale", deltaDays: NaN };
  }

  const deltaDays = Math.abs(a - b) / 86400_000;
  if (deltaDays <= OK_THRESHOLD_DAYS) return { band: "ok", deltaDays };
  if (deltaDays <= CAVEAT_THRESHOLD_DAYS) return { band: "caveat", deltaDays };
  return { band: "stale", deltaDays };
}
