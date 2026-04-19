---
title: "Provider model IDs rot — every eval failed for weeks without alerting"
category: "integration-issues"
date: "2026-04-19"
tags: [gemini, anthropic, openai, model-ids, silent-failure]
files:
  - src/lib/eval/adapters/index.ts
  - src/lib/eval/validate-models.ts
---

# Provider model IDs rot — every eval failed for weeks without alerting

## Problem

All seven Gemini models on the leaderboard showed `score=0 / grade=F` with
`dataQuality=verified`. Their most recent eval rows had
`completed_test_cases=0, failed_test_cases=51` — i.e. every API call
returned an error — but the system still wrote a completed "score row" of
zero instead of marking the eval failed.

## Root Cause

The adapter registry sent hard-coded preview model IDs with date suffixes
to Google's API:

```typescript
"gemini-2-5-pro": () => new GoogleAdapter("gemini-2.5-pro-preview-05-06"),
"gemini-2-5-flash": () => new GoogleAdapter("gemini-2.5-flash-preview-05-20"),
"gemini-2-5-flash-lite": () => new GoogleAdapter("gemini-2.5-flash-lite-preview-06-17"),
```

Google retired those dated preview IDs some time after mid-2025; they now
return `404 NOT_FOUND`. The stable unsuffixed IDs (`gemini-2.5-pro`,
`gemini-2.5-flash`, `gemini-2.5-flash-lite`) are what current APIs accept.
1.5-series IDs dropped out of the supported list entirely.

There was no alert because: (a) the evaluation pipeline treats per-test
API failures as a "failed test," not a fatal error, and (b) 51 failures
still produce a completed eval row with score=0/F, which looks like real
data.

## Solution

Verify every provider model ID against the live list endpoint before
relying on registry entries:

```bash
# Google — lists everything the API key can actually call
GET https://generativelanguage.googleapis.com/v1beta/models?key=$KEY | jq '.models[].name'
```

Then pin the registry to stable (unsuffixed) IDs where they exist, and
drop entries for IDs that 404:

```typescript
// Gemini 3 series (preview — current frontier)
"gemini-3-1-pro": () => new GoogleAdapter("gemini-3.1-pro-preview"),
"gemini-3-flash": () => new GoogleAdapter("gemini-3-flash-preview"),
// Gemini 2.5 (stable — drop -preview-MM-DD suffix)
"gemini-2-5-pro": () => new GoogleAdapter("gemini-2.5-pro"),
"gemini-2-5-flash": () => new GoogleAdapter("gemini-2.5-flash"),
"gemini-2-5-flash-lite": () => new GoogleAdapter("gemini-2.5-flash-lite"),
// (drop 1.5 and 2.0 — API now returns 404 for both)
```

Rule of thumb: **preview IDs with date suffixes are not safe to pin.** Use
the stable alias whenever the provider publishes one.

## Prevention

- [ ] Wire `src/lib/eval/validate-models.ts` into CI so a retired model
      ID breaks the build, not just silently zeroes a column on the
      leaderboard
- [ ] Treat a 404 from the provider as eval-level fatal, not per-test,
      so the eval row lands with `status='failed'` and shows up in
      dashboards instead of producing a misleading F grade
- [ ] Run the validation script as a periodic job (weekly?) with alerts
      when any ID newly 404s — catches provider-initiated retirements
      before they affect scheduled runs
- [ ] When a score drops dramatically between runs, surface it as an
      anomaly — a previously A-grade model going to F in one cycle is
      almost always an infra bug, not a capability regression

## Related

- Commit `03fa301` (Gemini refresh)
- Same category of bug likely exists for dated OpenAI / Anthropic IDs
  (`claude-opus-4-0`, `claude-sonnet-4-0` in the registry); worth
  auditing next
