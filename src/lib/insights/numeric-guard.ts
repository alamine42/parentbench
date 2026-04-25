/**
 * Numeric guard (parentbench-ov1.3).
 *
 * Rejects an `InsightsNarrative` if it contains numeric tokens that
 * cannot be traced to the source `InsightsAggregate`. The single most
 * embarrassing failure mode for this feature is a fabricated stat on a
 * public page; this guard is the cheap insurance against it.
 *
 * Acceptance rules (per design §4.6):
 *   1. Token appears verbatim in `aggregate.displayValues`
 *   2. Token's numeric value is within ±0.5 of any raw aggregate number
 *   3. Token is in the small constants whitelist (years, ordinals,
 *      "100%", category count)
 */

import type { InsightsAggregate } from "./build-aggregate";

const NUMERIC_TOKEN_RE = /\d+(?:\.\d+)?%?/g;
const ROUNDING_TOLERANCE = 0.5;

// The floor catches empty / near-empty narratives. Real reports run
// 600–1200 words; this is a sanity threshold, not a quality bar.
const MIN_TOTAL_LENGTH = 40;

const WHITELISTED_YEARS = new Set(["2024", "2025", "2026", "2027", "2028", "2029", "2030"]);
const WHITELISTED_ORDINALS = new Set(["1st", "2nd", "3rd", "4th"]);
const WHITELISTED_FIXED = new Set(["100%", "0%", "4"]); // 4 = number of categories

export type ValidatableNarrative = {
  tldr: string;
  headlineMetric: { value: string; caption: string };
  callouts: Array<{ title: string; body: string }>;
  sections: Array<{ heading: string; body: string }>;
  methodologyNote: string;
};

export type GuardResult =
  | { valid: true }
  | { valid: false; failureReason: string };

export function validateNarrativeAgainstAggregate(
  narrative: ValidatableNarrative,
  aggregate: InsightsAggregate
): GuardResult {
  // Length floor — stops empty/near-empty rejections from sliding through
  const totalLength = collectAllStrings(narrative).join("").trim().length;
  if (totalLength < MIN_TOTAL_LENGTH) {
    return { valid: false, failureReason: `Narrative too short (${totalLength} < ${MIN_TOTAL_LENGTH} chars)` };
  }

  const rawNumbers = collectRawNumbersFromAggregate(aggregate);
  const displaySet = new Set(aggregate.displayValues);

  for (const text of collectAllStrings(narrative)) {
    const tokens = text.match(NUMERIC_TOKEN_RE) ?? [];
    for (const token of tokens) {
      if (!isAcceptable(token, displaySet, rawNumbers, text)) {
        return {
          valid: false,
          failureReason: `Unverified numeric token "${token}" in narrative segment: "${truncate(text, 100)}"`,
        };
      }
    }
  }

  return { valid: true };
}

// ============================================================================
// HELPERS
// ============================================================================

function collectAllStrings(n: ValidatableNarrative): string[] {
  return [
    n.tldr,
    n.headlineMetric.value,
    n.headlineMetric.caption,
    ...n.callouts.flatMap((c) => [c.title, c.body]),
    ...n.sections.flatMap((s) => [s.heading, s.body]),
    n.methodologyNote,
  ].filter(Boolean);
}

function collectRawNumbersFromAggregate(agg: InsightsAggregate): number[] {
  const nums: number[] = [];
  nums.push(agg.totals.activeModels, agg.totals.providers, agg.totals.evalsLast30d);
  nums.push(agg.spread.topScore, agg.spread.bottomScore, agg.spread.gap, agg.spread.stdDev);
  for (const p of agg.providers) {
    nums.push(p.avgOverall, p.activeModelCount);
    for (const cat of Object.keys(p.perCategory) as Array<keyof typeof p.perCategory>) {
      nums.push(p.perCategory[cat]);
    }
  }
  for (const c of Object.values(agg.categoryLeaders)) nums.push(c.score);
  for (const m of agg.biggestMovers) {
    nums.push(m.currentScore, m.previousScore, Math.abs(m.deltaPoints));
  }
  for (const n of agg.newcomers) nums.push(n.debutScore);
  for (const r of agg.regressionWatch) nums.push(r.currentScore, Math.abs(r.deltaPoints));
  return nums;
}

function isAcceptable(
  token: string,
  displaySet: Set<string>,
  rawNumbers: number[],
  contextText: string
): boolean {
  // 1. Exact match against displayValues
  if (displaySet.has(token)) return true;

  // 2. Whitelisted constants — but watch the context for ordinals
  if (WHITELISTED_FIXED.has(token)) return true;
  if (WHITELISTED_YEARS.has(token)) return true;

  // Ordinals: "1st", "2nd", "3rd", "4th" — token regex won't capture the suffix,
  // so check ordinal context separately
  const ordinalMatch = contextText.match(/\b\d+(st|nd|rd|th)\b/g);
  if (ordinalMatch) {
    for (const o of ordinalMatch) {
      if (o.startsWith(token)) {
        // Only allow ordinals 1st-4th by default
        if (WHITELISTED_ORDINALS.has(o)) return true;
      }
    }
  }

  // 3. Within rounding tolerance of any raw aggregate number
  const numericValue = parseNumericToken(token);
  if (numericValue === null) return false;
  for (const raw of rawNumbers) {
    if (Math.abs(numericValue - raw) <= ROUNDING_TOLERANCE) return true;
  }

  return false;
}

function parseNumericToken(token: string): number | null {
  const stripped = token.endsWith("%") ? token.slice(0, -1) : token;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
