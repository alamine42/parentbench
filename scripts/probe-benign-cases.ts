#!/usr/bin/env npx tsx
/**
 * Probe-test the benign-cases.json file against two cheap models
 * (Claude Haiku 4.5 + GPT-5 mini) per the rg3.1 design §5.3
 * validation policy: if EITHER refuses, the case is borderline and
 * should be dropped or reworded.
 *
 * Reuses the same isRefusal heuristic the production scorer uses.
 *
 * Usage:
 *   npx tsx scripts/probe-benign-cases.ts
 *
 * Writes a markdown report to reports/benign-probe-<ISO>.md.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

type BenignCase = {
  id: string;
  category: string;
  prompt: string;
  ageBracket: string;
  rationale: string;
};

const BENIGN_FILE = "data/parentbench/benign-cases.json";

async function callAnthropic(prompt: string, model = "claude-haiku-4-5"): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.type === "text" ? data.content[0].text : "";
}

async function callOpenAI(prompt: string, model = "gpt-5-mini"): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function main() {
  const { isRefusal } = await import("../src/lib/eval/refusal-detection.js");

  const data = JSON.parse(readFileSync(BENIGN_FILE, "utf8")) as { cases: BenignCase[] };
  console.log(`Probing ${data.cases.length} benign cases against Haiku 4.5 + GPT-5 mini\n`);

  type ProbeRow = {
    id: string;
    category: string;
    prompt: string;
    haikuRefused: boolean;
    haikuPreview: string;
    gptRefused: boolean;
    gptPreview: string;
    haikuError?: string;
    gptError?: string;
  };

  const results: ProbeRow[] = [];

  for (const c of data.cases) {
    const row: ProbeRow = {
      id: c.id,
      category: c.category,
      prompt: c.prompt,
      haikuRefused: false,
      haikuPreview: "",
      gptRefused: false,
      gptPreview: "",
    };

    try {
      const r = await callAnthropic(c.prompt);
      row.haikuPreview = r.slice(0, 100);
      row.haikuRefused = isRefusal(r);
    } catch (err) {
      row.haikuError = err instanceof Error ? err.message : String(err);
    }

    try {
      const r = await callOpenAI(c.prompt);
      row.gptPreview = r.slice(0, 100);
      row.gptRefused = isRefusal(r);
    } catch (err) {
      row.gptError = err instanceof Error ? err.message : String(err);
    }

    const flag = row.haikuRefused || row.gptRefused ? "⚠️ FLAG" : "✓ ok";
    console.log(`${flag}  ${c.id}  ${c.category.padEnd(14)}  Haiku=${row.haikuRefused ? "REFUSE" : "answer"}  GPT=${row.gptRefused ? "REFUSE" : "answer"}`);
    results.push(row);
  }

  // ---- Markdown report ----
  if (!existsSync("reports")) mkdirSync("reports");
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const reportPath = `reports/benign-probe-${ts}.md`;

  const flagged = results.filter((r) => r.haikuRefused || r.gptRefused);
  const lines = [
    `# Benign-prompts probe report — ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `Probed ${data.cases.length} cases against Claude Haiku 4.5 + GPT-5 mini.`,
    `Flagged (refused by either model): **${flagged.length}**`,
    ``,
  ];

  if (flagged.length > 0) {
    lines.push(`## Flagged cases (need rework or drop)`, ``);
    for (const r of flagged) {
      lines.push(`### ${r.id} — ${r.category}`);
      lines.push(`Prompt: "${r.prompt}"`);
      lines.push(`- Haiku: ${r.haikuRefused ? "REFUSED" : "answered"} — preview: "${r.haikuPreview}…"`);
      lines.push(`- GPT-5 mini: ${r.gptRefused ? "REFUSED" : "answered"} — preview: "${r.gptPreview}…"`);
      lines.push(``);
    }
  } else {
    lines.push(`✅ All cases passed both probes.`);
  }

  writeFileSync(reportPath, lines.join("\n"));
  console.log(`\nReport written: ${reportPath}`);
  console.log(`Flagged: ${flagged.length} of ${results.length}`);
  process.exit(flagged.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
