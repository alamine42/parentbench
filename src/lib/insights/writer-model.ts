/**
 * Writer-model adapter (parentbench-ov1.3).
 *
 * Calls the configured generator model with structured-output mode and
 * returns the parsed `InsightsNarrative` plus token-usage metadata.
 *
 * Mirrors the judge.ts pattern (src/lib/eval/judge.ts) for symmetry —
 * same providers, same auth, same response handling.
 */

import { buildSystemPrompt, buildUserPrompt } from "./build-prompt";
import type { InsightsAggregate } from "./build-aggregate";

export type InsightsNarrative = {
  tldr: string;
  headlineMetric: { value: string; caption: string };
  callouts: Array<{
    kind: "category_leader" | "biggest_mover" | "newcomer" | "regression";
    title: string;
    body: string;
    subjectSlug: string;
  }>;
  sections: Array<{
    heading: string;
    body: string;
    chartSlot?: "provider-rollup" | "category-leaders" | "biggest-movers" | "spread";
  }>;
  methodologyNote: string;
};

export type WriterCallResult = {
  narrative: InsightsNarrative;
  inputTokens: number;
  outputTokens: number;
};

const DEFAULT_MODEL = process.env.INSIGHTS_GENERATOR_MODEL || "claude-haiku-4-5";

export async function callWriterModel(
  aggregate: InsightsAggregate,
  options?: { model?: string }
): Promise<WriterCallResult> {
  const model = options?.model ?? DEFAULT_MODEL;
  const provider = inferProvider(model);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(aggregate);

  if (provider === "anthropic") {
    return callAnthropic(model, systemPrompt, userPrompt);
  }
  return callOpenAI(model, systemPrompt, userPrompt);
}

function inferProvider(model: string): "anthropic" | "openai" {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  // Default — Anthropic models are cheaper and the canonical default
  return "anthropic";
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<WriterCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured for insights writer");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic writer error: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";
  const narrative = parseStrictJson(text);
  return {
    narrative,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<WriterCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured for insights writer");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI writer error: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const narrative = parseStrictJson(text);
  return {
    narrative,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

function parseStrictJson(raw: string): InsightsNarrative {
  // Tolerate ```json fences from older Anthropic models
  const stripped = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const obj = JSON.parse(stripped);
  return obj as InsightsNarrative;
}
