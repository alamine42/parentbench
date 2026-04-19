---
title: "Schema drift stalls evaluation pipeline with no visible errors"
category: "database-issues"
date: "2026-04-19"
tags: [drizzle, schema, migrations, neon, inngest, silent-failure]
files:
  - src/db/schema.ts
  - scripts/migrate-add-statistical-robustness.ts
  - src/inngest/functions/run-evaluation.ts
---

# Schema drift stalls evaluation pipeline with no visible errors

## Problem

No new scores had been written to the leaderboard for 9 days. Public pages
looked frozen on 2026-04-10 data. Scheduled evaluation runs reached 51/51
completed test cases with 0 failures, then silently stuck at
`status='running'` forever. 40+ eval rows were orphaned this way.

The Inngest worker produced no error events visible from the admin UI, and
the user-facing symptom was only "the website doesn't reflect the latest
runs."

## Root Cause

Commit `51daa4a` (feat(eval): statistical robustness) introduced new schema
in `src/db/schema.ts` — two enums (`score_batch_status`, `confidence_level`),
two tables (`score_batches`, `batch_run_scores`), and four columns on
`scores` (`score_batch_id`, `variance`, `confidence`, `is_partial`) — but
none were ever pushed to prod.

The project has no migration-tracking table (no `drizzle/` folder, no
`__drizzle_migrations`). The intended workflow is `drizzle-kit push` on
demand, which had been skipped for this change.

Downstream, `run-evaluation.ts`'s final step INSERTs into `scores` with all
new fields populated. That statement errored on the missing columns; the
Inngest step didn't mark the run `failed` or `completed`, so it stayed
`running` indefinitely. The test cases themselves had already succeeded, so
dashboards showed healthy 51/51 progress.

## Solution

Write a narrow, additive, idempotent SQL script instead of using
`drizzle-kit push` (which can be destructive on a diverged prod) or
`drizzle-kit generate` (which produces a full-schema CREATE when no prior
snapshot exists — useless against a populated prod):

```typescript
// scripts/migrate-add-statistical-robustness.ts
const STATEMENTS = [
  {
    label: "enum score_batch_status",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."score_batch_status" AS ENUM('pending','in_progress','completed','failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  // ... additive CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS
];
```

Then clean up the orphaned `running` evals so the scheduler would re-pick
them up:

```sql
UPDATE evaluations SET status='failed',
  error_message = COALESCE(error_message, 'schema_mismatch during stats-robustness rollout'),
  completed_at = now()
WHERE status='running';
```

## Prevention

- [ ] Add a CI check that runs `drizzle-kit push --dry-run` (or equivalent
      diff) against a prod snapshot and fails the build on drift
- [ ] Add a post-deploy smoke test that writes and reads a score row end
      to end, so missing columns surface immediately instead of stalling
      silently
- [ ] Consider adopting generated migrations (`drizzle-kit generate` with
      real history in `drizzle/`) so schema changes become explicit PR
      artifacts instead of implicit push-after-merge chores
- [ ] Mark Inngest's final scoring step with a visible failure state when
      the DB write errors, rather than relying on the outer function to
      transition status

## Related

- Commit `51daa4a` (introduced the drift)
- Commit `e19d1f9` (fix — targeted migration script)
- The `.env.local` → prod Neon foot-gun noted in prior HANDOVER: local
  scripts bypass any staging layer
