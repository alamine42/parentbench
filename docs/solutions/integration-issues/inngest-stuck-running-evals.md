---
title: "Inngest evals stuck in running forever — onFailure mis-targeting + no cleanup safety net"
category: "integration-issues"
date: "2026-04-28"
tags: [inngest, eval, on-failure, cleanup-cron, run-id, concurrent-runs]
files:
  - src/inngest/functions/run-evaluation.ts
  - src/inngest/functions/cleanup-stuck-evals.ts
  - src/inngest/functions/index.ts
  - scripts/fix-stuck-evals.ts
---

# Inngest evals stuck in running forever — onFailure mis-targeting + no cleanup safety net

## Problem

Two evaluation runs (GPT-5 `b2586b1e`, GPT-5-mini `86e1be01`) showed
`status=running` in the admin UI for hours after the underlying Inngest
runs had already died. Both stuck at exactly `70/81` completed test cases
= batch 7 of 9 (batchSize 10) — consistent with a Vercel/Inngest step
timeout on the slowest model family.

Symptoms:
- Admin UI "All evaluations complete" banner never lit because two rows
  were perpetually `running` with `completedAt=null` and
  `errorMessage=null`.
- No way to retry — the system thought the run was still in flight.
- `scripts/fix-stuck-evals.ts` could mark them failed manually, but only
  if a human noticed.

## Root Cause

Two compounding failure modes:

**1. `onFailure` matched by query, not by ID.** The previous handler in
`runEvaluation` looked up "the most recent eval row with `status=running`
and matching model" to mark failed. That works for serial runs but
silently mis-targets when concurrent runs exist for the same model — a
later run could "steal" the failed status and leave the actually-failed
row untouched.

**2. No safety net when `onFailure` itself doesn't run.** If the failure
is at the Inngest infrastructure layer (step timeout that doesn't
deliver onFailure, DB blip during the handler, etc.), the row just sat
at `running` forever. Nothing checked.

## Solution

Two-part fix in commit `fd3c2cf`:

**Match `onFailure` by `inngestRunId`.** The eval row stores the
Inngest run ID at create time. The handler now looks up by that exact
ID, with the legacy "most recent running for model" path kept only as a
fallback for older rows.

```typescript
// src/inngest/functions/run-evaluation.ts (onFailure)
const evalRow = await db.query.evaluations.findFirst({
  where: eq(evaluations.inngestRunId, event.data.run_id),
});
// fallback: legacy lookup by model + most-recent-running
```

**Add `cleanupStuckEvals` cron.** A new Inngest function on
`*/15 * * * *` that finds any eval where `status=running` AND
`startedAt < now() - 30min`, marks it `failed` with a clear
`errorMessage` ("Auto-cleanup: stuck in running for >30min"). Self-heals
within 15–45 minutes worst case.

```typescript
// src/inngest/functions/cleanup-stuck-evals.ts
export const cleanupStuckEvals = inngest.createFunction(
  { id: "cleanup-stuck-evals" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const stuck = await step.run("find-stuck", () =>
      db.select().from(evaluations).where(
        and(eq(evaluations.status, "running"), lt(evaluations.startedAt, cutoff))
      )
    );
    // ...mark each failed with errorMessage
  }
);
```

`scripts/fix-stuck-evals.ts` stays as a manual escape hatch for
emergencies or for clearing rows older than the cron's lookback.

## Prevention

- [x] Match by stable IDs, not by "most recent matching" queries, when a
  handler needs to update a specific row created elsewhere
- [x] Any state machine with a "running" terminal-ish state needs a
  janitor — don't trust the happy-path handler to always fire
- [ ] Investigate the underlying GPT-5 batch-7 timeout
  (parentbench-5xu) — cleanup hides the symptom but evals still fail
- [ ] Consider per-model batch sizes if GPT-5 family consistently
  blows the step budget

## Related

- Commit: `fd3c2cf` — fix(inngest): auto-clean stuck evals + match onFailure by run id
- Beads: parentbench-5xu (follow-up GPT-5 batch timeout investigation)
- Manual escape hatch: `scripts/fix-stuck-evals.ts`
- Sibling deployment-time gotcha: `docs/solutions/integration-issues/stale-provider-model-ids.md`
  (Vercel→Inngest sync drift — see also the
  `after-every-vercel-deploy-that-touches-src-inngest` bd memory)
