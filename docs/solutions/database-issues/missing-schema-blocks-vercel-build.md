---
title: "Missing schema breaks Vercel build via static prerender"
category: "database-issues"
date: "2026-04-25"
tags: [drizzle, neon, vercel, ssg, migrations, prerender]
files:
  - src/app/insights/page.tsx
  - src/app/insights/[slug]/page.tsx
  - src/app/insights/archive/page.tsx
  - src/components/insights/homepage-teaser.tsx
  - scripts/migrate-add-insights-reports.ts
---

# Missing schema breaks Vercel build via static prerender

## Problem

Two production deployments errored out within minutes of each other with:

```
Error occurred prerendering page "/insights".
Error: Failed query: select "id", "slug", "status", ... from "insights_reports"
[cause]: Error [NeonDbError]: relation "insights_reports" does not exist
```

The build had succeeded for previous commits but failed once code that
queries a freshly-introduced table (`insights_reports`) made it onto
`main`. The migration to create the table had not yet been applied to
prod. Even worse: the build failure took the **entire site** down, not
just the new feature, because the prerender step aborts the whole build.

## Root Cause

Two compounding factors:

1. **Next.js statically prerenders pages at build time** unless you opt
   out with `force-dynamic`. `/insights` had `revalidate = 60` (ISR),
   which still requires a successful initial render at build time.
2. **The DB query has no fallback.** When the table doesn't exist, the
   query throws, the page render throws, and Next aborts the build.

This is the same family of issue as
[`schema-drift-silent-scoring-failure.md`](./schema-drift-silent-scoring-failure.md)
— a divergence between the schema declared in `src/db/schema.ts` and
what's actually in prod — but with a different symptom: instead of
silently failing evaluations, it loudly breaks the build.

## Solution

Two layers of defense, both wired in:

**1. Defensive try/catch around every DB call that queries the new table.**
   On query failure, treat the result as "no data" — return `notFound()`,
   render an empty list, or hide a teaser card. The build now succeeds
   regardless of migration state.

```ts
// src/app/insights/page.tsx
let rows: ReportRow[] = [];
try {
  rows = await db.select({...}).from(insightsReports);
} catch (err) {
  console.warn("[insights] insights_reports query failed; treating as no data:", err);
}

const picked = pickPublishedForInsightsRoute(rows);
if (!picked || !picked.narrative) {
  notFound();
}
```

**2. Hand-written idempotent migration script.** Same pattern as
`scripts/migrate-add-statistical-robustness.ts` from the prior incident.
`CREATE TABLE IF NOT EXISTS`, `DO $$ ... duplicate_object` for enums.

```bash
# Validate without changes
npx tsx scripts/migrate-add-insights-reports.ts --dry-run

# Apply
npx tsx scripts/migrate-add-insights-reports.ts
```

The script connects via `DATABASE_URL` from `.env.local` (which points
at prod Neon — known foot-gun).

## Prevention

- [x] Added `try/catch` to every page that queries new tables — pattern
      to repeat for any future schema additions
- [x] Migration script committed alongside the schema change so prod
      can be brought to parity in one command
- [ ] **Future:** wire `db:generate` + `db:migrate` history properly so
      drizzle-kit can manage migrations without `--push` (which can drop
      diverged columns). Tracked from prior session — still not done.
- [ ] **Future:** dev-mode check that warns when schema declares a
      table that doesn't exist in the connected DB

## Related

- [`schema-drift-silent-scoring-failure.md`](./schema-drift-silent-scoring-failure.md)
  — the prior incident, same class of bug, different blast radius.
- Commits: `cb868a8` (defensive try/catch), `251eebe` (schema +
  migration script), migration applied 2026-04-25.
