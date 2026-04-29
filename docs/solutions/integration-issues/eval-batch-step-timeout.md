---
title: "GPT-5 family eval runs hit Vercel step timeout at batch 7/9"
category: "integration-issues"
date: "2026-04-29"
tags: [inngest, eval, vercel-timeout, batch, parallelization, abort-controller]
files:
  - src/inngest/functions/run-evaluation.ts
  - src/lib/eval/adapters/index.ts
  - src/lib/eval/judge.ts
---

# GPT-5 family eval runs hit Vercel step timeout at batch 7/9

## Problem

Two GPT-5 family runs (`b2586b1e` GPT-5, `86e1be01` GPT-5-mini) stalled
at exactly `70/81` test cases — batch 7 of 9 (batchSize 10). Same
symptom on both. The previously shipped fix (parentbench-fd3c2cf) made
the stuck rows self-heal via `cleanupStuckEvals` cron and made
`onFailure` target the right row by `inngestRunId`, but the runs still
*failed* — they just no longer lied about being "running" forever.
Goal here was to make GPT-5 family runs actually *complete*.

## Root Cause

Inside each `step.run("run-batch-N", ...)`, the test cases were
processed **sequentially** with a `for...of batch` loop:

```typescript
for (const testCase of batch) {
  const result = await runModelAdapter(modelSlug, testCase);  // 20–40s for GPT-5
  if (useLlmJudge) {
    await judgeResponse(...);                                  // +5–10s
  }
}
```

Vercel functions on Pro Fluid Compute cap at ~300s. With slow GPT-5
reasoning latencies (20–40s/call) plus an Anthropic judge call per
case, a single batch of 10 could approach or exceed 300s. By batch 7,
the cumulative probability of *some* batch hitting the wall is high
enough that the run fails. Why batch 7 specifically: nothing — the
prompt order isn't randomized, so the slowest cluster lands at the
same point every run.

A second compounding factor: any one hung upstream call (network blip,
provider outage) had no per-call ceiling. One stuck `fetch` could pin
the whole batch until Vercel killed it.

## Solution

Two-part fix, low risk, no infrastructure changes.

**1. Parallelize within the batch.** Replaced the sequential `for...of`
with `Promise.all(batch.map(...))`. Wall-clock per step drops from
sum-of-N to max-of-N. Ten parallel calls of 30s now take ~30s instead
of 300s.

```typescript
// src/inngest/functions/run-evaluation.ts
return Promise.all(
  batch.map(async (testCase) => {
    try {
      const result = await runModelAdapter(modelSlug, testCase);
      // ...judge call, metadata, return shape...
    } catch (error) {
      return { testCaseId: testCase.id, passed: false, score: 0, error: ... };
    }
  })
);
```

Per-test-case error isolation preserved: each promise has its own
try/catch, so one failure doesn't poison the batch.

**2. Per-call AbortController timeout.** Added
`signal: AbortSignal.timeout(MODEL_CALL_TIMEOUT_MS)` to every upstream
fetch in the four adapters and the two judge code paths. 120s for
model calls (covers GPT-5 reasoning), 60s for judge calls. Now any
single hung call aborts cleanly instead of holding the whole batch
hostage.

```typescript
// src/lib/eval/adapters/index.ts
const MODEL_CALL_TIMEOUT_MS = 120_000;

const response = await fetch(url, {
  // ...
  signal: AbortSignal.timeout(MODEL_CALL_TIMEOUT_MS),
});
```

## Why not other approaches

- **Lower batchSize for slow models.** Considered. Per-model batch
  config adds complexity and only mitigates — sequential 5 calls is
  still 150s in the bad case. Parallelization removes the bottleneck
  outright.
- **Fan out each test case as its own Inngest step.** Cleaner
  conceptually but multiplies Inngest event count by 10 and costs more.
  Only worth it if Promise.all proves insufficient.
- **Shuffle test cases.** Doesn't fix the underlying problem — just
  moves which batch hits the wall.

## Provider rate-limit risk

10 parallel calls per batch × max 5 concurrent evaluations
(`concurrency.limit: 5` on the function) = 50 in-flight requests
worst case. OpenAI Tier 1+ allows 500–10000 RPM; Anthropic similar.
Comfortable headroom.

## Verification

After merging, schedule a fresh GPT-5 eval and confirm it completes
end-to-end with `completedTestCases === totalTestCases`. The
`cleanupStuckEvals` cron is still in place as a safety net for any
unrelated future failure mode.

## Related

- `docs/solutions/integration-issues/inngest-stuck-running-evals.md`
  — fix for the *symptom* (rows stuck at running) shipped first
- `parentbench-5xu` — this work
