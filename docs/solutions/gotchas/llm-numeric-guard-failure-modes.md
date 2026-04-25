---
title: "LLM numeric-guard rejected three legitimate things in three regen attempts"
category: "gotchas"
date: "2026-04-25"
tags: [llm, validation, hallucination, anti-hallucination, regex]
files:
  - src/lib/insights/numeric-guard.ts
  - src/lib/insights/build-aggregate.ts
  - src/lib/insights/build-prompt.ts
  - src/tests/insights/numeric-guard.test.ts
---

# LLM numeric-guard rejected three legitimate things in three regen attempts

## Problem

The insights pipeline (`parentbench-ov1`) has an anti-hallucination
validator that rejects narratives whose numeric tokens cannot be traced
to the source `InsightsAggregate`. The first three production
regenerations all failed validation — each on a *different* false
positive, each with a Claude Haiku output that was, in fact,
factually correct:

| Attempt | Rejected token | Narrative segment | What was wrong |
|---|---|---|---|
| `2026-04-25` | `30` | "tested over **30** days for child safety" | windowDays=30 wasn't surfaced to the guard |
| `-2` | `5.4` | "**GPT-5.4** mini Dropped Sharply" | Regex pulled version digits out of a model name |
| `-3` | `1` | "debuted on April **19**" → leftover "1" | Strip ate a bare-digit displayValue ("9") out of unrelated text |

After fix #3, attempt `-4` published successfully.

## Root Cause

Three separate flavors of "the validator is too literal":

**1. Missing meta-fields.** The guard collected raw numbers from
`totals.activeModels`, `spread.*`, etc., but `windowDays` lived
top-level in the aggregate and was overlooked. The LLM correctly
referenced "the last 30 days" — perfectly grounded — but the validator
had no path to verify it.

**2. Regex over-extracts inside identifiers.** `\d+(?:\.\d+)?%?` happily
extracts "5.4" out of "GPT-5.4 mini". The model name *is* in
displayValues (verbatim, grounded) but the bare digit-substring is not.
The validator can't tell that "5.4" is structural to a name vs. a
numeric claim.

**3. Substring strip is too eager when displayValues contains bare digits.**
The fix for #2 was to strip every digit-bearing displayValue from the
text before scanning. But displayValues *also* contains bare numerics
like `"9"` (a gap value). Stripping `"9"` blindly chews the "9" out of
"April 19" and leaves the validator with a free-floating "1" that it
then flags as fabricated.

## Solution

Three changes, applied in order:

**Fix #1** — `windowDays` is now part of both displayValues and the
raw-numbers list:

```ts
// build-aggregate.ts
values.add(String(agg.windowDays));

// numeric-guard.ts
nums.push(agg.windowDays);
```

**Fix #2** — strip displayValues from text before extracting tokens:

```ts
// numeric-guard.ts
const stripped = stripGroundedIdentifiers(text, aggregate.displayValues);
const tokens = stripped.match(NUMERIC_TOKEN_RE) ?? [];
```

**Fix #3** — only strip *identifier-like* values (containing a letter),
never bare digits:

```ts
function stripGroundedIdentifiers(text: string, displayValues: string[]): string {
  let stripped = text;
  const sorted = [...displayValues]
    .filter((v) => /\d/.test(v) && /[A-Za-z]/.test(v))  // <-- both digit and letter
    .sort((a, b) => b.length - a.length);
  for (const v of sorted) {
    if (v.length === 0) continue;
    const re = new RegExp(escapeRegex(v), "gi");
    stripped = stripped.replace(re, " ");
  }
  return stripped;
}
```

**Plus a prompt-level mitigation**: the writer is now explicitly told
not to mention specific calendar dates ("April 19", "March 2026") and
to use relative language ("recently", "this month", "in the last 30
days") instead. This eliminates a whole class of date-related false
positives at the source rather than trying to whitelist every possible
day-of-month number in displayValues.

## Prevention

- [x] Regression tests G13–G16 in `src/tests/insights/numeric-guard.test.ts`
      lock the three failure modes
- [x] Prompt explicitly forbids specific dates
- [ ] **Future:** if a fourth false-positive shows up, consider
      requiring numeric tokens to be NOT preceded by a letter
      (`(?<![A-Za-z])\d+...`) as an additional safeguard for
      identifier-embedded digits the strip might miss
- [ ] **Future:** observe how often validation rejects in prod;
      excessive rejections would signal the prompt needs tightening
      OR the displayValues set is incomplete

## Lessons

- **Anti-hallucination guards are not free.** Every constraint you
  enforce has false-positive risk. The defensive choice (validator
  rejects everything it can't ground) is correct for a public-facing
  page, but each new failure mode needs to be diagnosed and either
  whitelisted in displayValues or eliminated via prompt instructions.
- **Don't substring-strip bare numbers.** Ever. They occur naturally
  inside other numbers.
- **Prefer prompt-level constraints to validator-level constraints**
  when possible. "Don't mention dates" in the prompt is worth dozens
  of date-whitelisting entries in the guard.

## Related

- Beads epic: `parentbench-ov1`
- Codex adversarial-review (2026-04-25) flagged the **±0.05** rounding
  tolerance as too tight (WARNING #2) — that fix was already applied
  pre-implementation. The three issues above slipped through anyway,
  on different surfaces.
- Commits: `d1eff88` (windowDays), `4d0b828` (strip + first version),
  `d47298a` (letter-bearing-only strip + date prompt rule).
