---
title: "ISR `revalidate=60` keeps Neon compute always-on and exhausts the free tier in days"
category: "gotchas"
date: "2026-05-17"
tags: [nextjs, isr, neon, postgres, cost, compute]
files: [src/app/page.tsx, src/app/leaderboard/page.tsx, src/app/insights/page.tsx]
---

# ISR `revalidate=60` keeps Neon compute always-on and exhausts the free tier in days

## Problem

Neon emailed: *"Your project parentbench has used 100% of its 100
CU-hour monthly compute allowance."*

The site had only modest traffic — a few hundred visits a day from
crawlers and a handful of organic visitors. Yet the free-tier budget
of 100 CU-hours (≈ one CU running for ~3.3 hours/day) was burned in
roughly **four days**.

## Root cause

Neon bills by **compute-active time**, not query count. The compute
endpoint auto-suspends after a configurable idle period (default 5
min). To stay within the free tier you have to let it sleep most of
the day.

We had `export const revalidate = 60` on eight public pages
(`/`, `/leaderboard`, `/insights`, `/insights/archive`,
`/insights/[slug]`, `/methodology/changelog`, `/model/[slug]`,
`/reports/[modelSlug]`). With Next.js ISR:

1. Any incoming request to one of those routes — including from
   crawlers, uptime monitors, prefetchers, or social-share scrapers
   — triggers a background revalidation if the cached page is older
   than 60 seconds.
2. Background revalidation re-runs the page's server code, which
   issues fresh DB queries.
3. Each query wakes the Neon compute endpoint (if asleep) and resets
   its idle timer.

Even at one revalidation per page per minute, eight pages keep the
compute endpoint awake almost continuously: 8 × 60 = 480 wake events
per hour, far more than enough to keep idle resets firing
indefinitely. Compute stays "active" 24×7, burning the entire
monthly budget in days.

## Solution

Two paths, depending on whether the site needs to keep changing:

1. **If the site is still active:** stretch `revalidate` to a much
   larger window (600s or 3600s). Combined with `revalidatePath()`
   on writes (already wired into `src/inngest/functions/run-evaluation.ts`
   after commit `9c0a2a0`), freshness on real DB updates is
   preserved. The 60s safety-net rebuild was catching cases that
   shouldn't happen anyway (DB state changing outside the app).

2. **If the site can be frozen** (this session, 2026-05-17): snapshot
   the DB to committed JSON, swap the data layer to read from the
   snapshot via a `FROZEN=1` env flag, and pause Neon. Pages still
   re-render every 60s — but they hit `fs.readFile` on local JSON,
   not Postgres. Compute stays asleep forever. See
   `docs/solutions/integration-issues/freezing-and-unfreezing-parentbench.md`.

We chose option 2 for the freeze.

## Prevention

- **Don't default to `revalidate = 60` on any DB-backed page on
  Neon free tier.** The smallest defensible value is the longest
  window the product can tolerate.
- **Audit `revalidate` values across all routes** when bringing up a
  Neon free-tier project. Sum up the effective wake rate: if it's
  comfortably higher than `1 / idle_timeout`, compute will never
  sleep.
- **Watch the "Compute hours" graph in Neon dashboard** during the
  first week after a deploy that adds or modifies an ISR page.
  Flat-line near the cap = trouble. Inverse-related to the gotcha in
  [`vercel-caches-dynamic-pages-without-revalidate.md`](./vercel-caches-dynamic-pages-without-revalidate.md):
  that one is about ISR not running often enough; this one is about
  it running too often.
- **For sites where the data only changes through application
  writes**, prefer `revalidate = false` + explicit `revalidatePath()`
  calls. That's pure SSG with on-demand invalidation, zero idle DB
  cost.

## Related

- `docs/solutions/gotchas/vercel-caches-dynamic-pages-without-revalidate.md`
  — the *other* direction of this trade-off.
- `docs/solutions/integration-issues/freezing-and-unfreezing-parentbench.md`
  — how we decoupled the site from the DB rather than retune ISR.
- Commit `9c0a2a0` (2026-05-03) — added `revalidatePath()` after
  score insert. Was necessary for freshness but had no effect on
  the compute-burn problem this doc covers.
