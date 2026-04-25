/**
 * Prompt builder for the insights narrative generator (parentbench-ov1.3).
 *
 * Builds the dynamic prompt fed to the writer model. Empty aggregate
 * buckets are NOT requested — this prevents the writer from being asked
 * to invent a "newcomer" or "biggest mover" when none exists (Codex
 * CRITICAL #3).
 */

import type { InsightsAggregate } from "./build-aggregate";

const SYSTEM_PROMPT = `You are a writer for ParentBench, a child-safety AI benchmark for non-technical parents.

Your job: turn a JSON snapshot of benchmark data into a clear, parent-readable analysis.

Rules:
- Reading level: 9th grade. No jargon. No researcher-speak.
- When quoting numbers, prefer values from the supplied "displayValues" list. Do not invent statistics.
- Never paraphrase a category name — use the verbatim labels supplied in the input.
- Tone: confident but neutral. No marketing fluff. No alarmism.
- Frame findings around what they mean for a parent choosing tools for their child.
- Output JSON ONLY, matching the requested schema.`;

export type RequestedCallouts = Array<"category_leader" | "biggest_mover" | "newcomer" | "regression">;

export function getRequestedCallouts(agg: InsightsAggregate): RequestedCallouts {
  const requested: RequestedCallouts = ["category_leader"]; // always available
  if (agg.biggestMovers.length > 0) requested.push("biggest_mover");
  if (agg.newcomers.length > 0) requested.push("newcomer");
  if (agg.regressionWatch.length > 0) requested.push("regression");
  return requested;
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(agg: InsightsAggregate): string {
  const requested = getRequestedCallouts(agg);

  return [
    "## Benchmark snapshot (only source of truth)",
    "",
    "```json",
    JSON.stringify(agg, null, 2),
    "```",
    "",
    "## Requested output (JSON)",
    "",
    "Produce an InsightsNarrative with these slots:",
    "",
    "- `tldr` (≤280 chars): one parent-friendly paragraph summarizing the state of play.",
    `- \`headlineMetric\`: \`{ value, caption }\`. Use a single number that grounds the TL;DR (e.g., the top score).`,
    `- \`callouts\`: an array with one entry per requested kind below. ${requested.length} requested:`,
    ...requested.map((k) => `    - kind="${k}" — title (≤40 chars), body (≤200 chars), subjectSlug (model slug from the aggregate)`),
    "- `sections`: 2–3 entries, each with a heading and 2–4 paragraph markdown body. Optionally specify `chartSlot` (one of: provider-rollup, category-leaders, biggest-movers, spread).",
    "- `methodologyNote`: one short paragraph naming this writer is an LLM, that all numbers were programmatically validated, and pointing to /methodology.",
    "",
    "Empty buckets in the snapshot mean those callouts are NOT requested.",
    "Use category labels from the aggregate verbatim — do not invent shorter names.",
  ].join("\n");
}
