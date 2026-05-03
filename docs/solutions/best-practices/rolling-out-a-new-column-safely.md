---
title: "Rolling out a new column with default-back-compat semantics"
category: "best-practices"
date: "2026-05-03"
tags: [postgres, drizzle, migrations, reader-inventory, back-compat]
files:
  - scripts/migrate-add-surface-column.ts
  - src/lib/parentbench.ts
  - src/lib/db-loaders.ts
  - src/db/queries/models.ts
---

# Rolling out a new column with default-back-compat semantics

## Context

You're adding a column to a shared table that already has many readers
across the codebase. The standard pattern is `ADD COLUMN ... NOT NULL
DEFAULT '<canonical>'` so existing rows backfill automatically and
existing readers continue to work. The problem: existing readers
*don't actually keep working* — they keep returning rows, but the rows
they return are now ambiguous because new rows can have a different
column value, and the readers don't filter for the canonical default.

This is the inverse of `retiring-a-deprecated-provider-model.md`: that
doc covers removing a reference; this doc covers adding a dimension.

This pattern bit parentbench-d95 (the `surface` column on
`scores` and `evaluations`). The original adversarial review caught
the most-trafficked readers. The first codex pass after implementation
caught one more (the comparison panel silently dropped surfaces beyond
the first two). The second codex pass caught two more (hero stats,
the `src/db/queries/models.ts` module). Three review rounds; four
sets of findings; one anti-pattern.

## The anti-pattern

> "I added a column with a sensible default. Existing readers don't
> need to change because the default makes them act like before."

This is **wrong** as soon as new rows can have non-default values.
Existing readers were written assuming the column didn't exist —
which means they implicitly assumed all rows had the same logical
identity along that dimension. The moment you add new rows with a
different column value, those readers start mixing rows that should
be filtered apart.

Symptoms after a half-rolled-out column:
- "Latest score per model" queries return whichever row landed most
  recently, regardless of which surface it was for. So a fresh
  consumer-track row knocks out the API row, or vice versa.
- Aggregates (counts, max-date, distinct-providers) reflect a mix of
  row populations the UI never asked about.
- "Recent activity" feeds show items from populations the user can't
  see in the canonical view.
- Internal APIs (`/api/internal/...`) leak the new dimension to
  consumers that hard-coded assumptions about the old shape.

## The playbook

When adding a column with this shape, before the migration ships:

### 1. Build an exhaustive reader inventory

Search every file that reads the affected table. The grep should be
mechanical:

```bash
grep -rn "from(scores)\|\.scores\." src/ scripts/ 2>/dev/null
```

Sort the results by file. For each one, classify:

- **Surface-aware** — already filters on the new column, or doesn't
  return the column at all (only an aggregate that's still correct).
- **Surface-blind** — returns rows that include the new column value
  but doesn't filter or expose it. **This is the at-risk set.**

Common at-risk sites you might forget:
- Admin routes that pick "the latest score for this model"
- Internal APIs that other systems read
- Insights/correlation reports that operate on aggregates
- Caches that key on `(model_id, computed_at)` instead of
  `(model_id, surface, computed_at)`
- Inngest / cron functions that read recent activity
- Score-history endpoints that should stay scoped to one dimension
- Test fixtures and seed scripts

### 2. Decide each reader's behavior

For each surface-blind reader, decide:

- **Filter to canonical default** — preserve the legacy contract by
  filtering to the column's default value (`eq(scores.surface,
  'api-default')`). Best when downstream consumers expect "the old
  shape." Most readers fall here.
- **Pass through the dimension** — let the reader's caller specify
  which value of the new column it wants. Best for new readers built
  with the column in mind.
- **Aggregate across all values** — keep returning everything but
  expose the dimension in the result so callers can disambiguate.
  Rarely the right choice; usually a sign the reader should be
  split into two.

### 3. Ship the readers BEFORE the migration

The migration itself doesn't break readers — it's the first INSERT
of a non-default value that breaks them. So readers must land
first. In a single-developer workflow, that means:

1. Land all reader updates as one commit (with tests proving the
   filter works against synthetic mixed-dimension data).
2. Land the migration as a separate commit.
3. Verify one pass through every reader against a real DB before
   any non-default INSERT.

In a team workflow, holding the migration behind a feature flag
or a config gate is safer.

### 4. Make the surface-blind anti-pattern grep-able

Mark every "this reader filters to the canonical default" site with
a one-line comment that names the column and the rationale. Future
greps for that comment find every back-compat point at once:

```ts
// surface-aware filter (parentbench-d95): caller wants API track only
.where(and(eq(scores.modelId, m.id), eq(scores.surface, "api-default")))
```

If a reader is added later that touches the table without the comment
or filter, code review catches it.

### 5. Cross-model review is non-optional

For columns that affect data interpretation downstream (i.e. anything
that answers "which row is the latest"), run two independent reviews:

- One that reads the migration + every changed reader and asks
  "is this list complete?"
- One that searches the codebase fresh, ignoring the migration PR,
  for any other reader of the affected table.

These find different misses. The first review is anchored on the
diff and tends to ratify what's there; the second is anchored on the
codebase and tends to find what's missing. /codex-review (or any
out-of-context model) is well-suited to the second.

In parentbench-d95, the in-context Claude review caught 5 of 7
readers; codex's two follow-up passes caught the remaining 2 (in
files the original review never opened). The two are
complementary, not redundant.

## What it looked like in parentbench-d95

The `surface` column was added to `scores` and `evaluations` with
`NOT NULL DEFAULT 'api-default'`. The reader inventory ran in T1.

| Reader | Caught by |
|---|---|
| `src/lib/parentbench.ts` `loadScoresFromDB` | T1 inventory |
| `src/lib/parentbench.ts` JSON fallback | T1 inventory |
| `src/app/api/admin/models/route.ts` | T1 inventory |
| `src/app/model/[slug]/page.tsx` server component | T1 inventory |
| `src/inngest/functions/run-evaluation.ts` trend lookup | T1 inventory |
| `src/inngest/functions/generate-correlation-report.ts` | T1 inventory |
| `src/inngest/functions/maybe-regenerate-insights.ts` | T1 inventory |
| `src/lib/db-loaders.ts` (3 readers) | T1 inventory |
| Hero stats: `getParentBenchModelCount` / `LastUpdated` | **codex pass 2** |
| `src/db/queries/models.ts` (4 readers) | **codex pass 2** |
| `src/components/parentbench/surface-comparison.tsx` `sorted[0..2]` slice | **codex pass 1** |
| `scripts/score-browser-eval.ts` benign-case heuristic | **codex pass 1** |

Three of the four codex findings would have shipped a wrong-data
leaderboard. None were caught by the in-context review. The
`db/queries/models.ts` module was particularly easy to miss because
it's a parallel data-loaders file: there are two separate model-query
modules in the codebase (`src/lib/db-loaders.ts` and
`src/db/queries/models.ts`), and the original inventory only
inspected the first.

## Related

- `docs/solutions/best-practices/retiring-a-deprecated-provider-model.md`
  — the inverse playbook (removing a column reference)
- `docs/designs/parentbench-d95-consumer-products-track.md` §4 (Data
  model) and the §12 changelog documenting the codex-pass findings
