---
title: "Vercel caches dynamic pages even without export const revalidate"
category: "gotchas"
date: "2026-04-19"
tags: [nextjs, vercel, isr, full-route-cache, caching]
files:
  - src/app/leaderboard/page.tsx
  - src/app/page.tsx
---

# Vercel caches dynamic pages even without `export const revalidate`

## Problem

A freshly-written score for `claude-opus-4-7` was in the DB and in the
raw-SQL leaderboard query, but the live site at `parentbench.ai/leaderboard`
did not include it. Headers showed:

```
cache-control: public, max-age=0, must-revalidate
age: 190
x-vercel-cache: HIT
```

`cache-control: max-age=0, must-revalidate` suggests "no CDN caching," but
Vercel was happily serving a 190-second-old response anyway.

## Root Cause

Next.js 13+ App Router eagerly puts Server Components into the
**full-route cache** when the route doesn't use dynamic APIs (cookies,
searchParams, no-store fetches). The `leaderboard/page.tsx` used
`React.cache()` for request-level memoization only — no dynamic markers —
so Next.js built it once and Vercel pinned that render at the edge. The
`cache-control` header applies to browsers, not to Vercel's own CDN layer.

There is no default revalidation interval; once cached, a route stays
cached until the next deploy.

## Solution

Add an explicit revalidation window to the route segment:

```typescript
// src/app/leaderboard/page.tsx
export const revalidate = 60;  // seconds

// Same for src/app/page.tsx
```

After deploy, `x-vercel-cache` transitions through `PRERENDER` (fresh
build) and serves stale-while-revalidate within the 60-second window.

**Alternative** for pages where real-time freshness matters more than
CDN performance:

```typescript
export const dynamic = "force-dynamic";  // bypass full-route cache
```

For this project the 60-second window is the right trade-off: scheduled
evals only add a few rows a day, and the DB query is cheap.

## Prevention

- [x] Any App Router page that reads from the DB and expects "recent"
      data should ship with an explicit `revalidate` — relying on
      invisible defaults is a footgun (`f4913b9`)
- [x] Add an on-demand revalidation hook: when the Inngest
      `eval/completed` handler runs, call `revalidatePath('/')` and
      `revalidatePath('/leaderboard')` to bust the cache immediately
      rather than waiting the window (`9c0a2a0`, 2026-05-03 — see
      Step 5b "revalidate-public-pages" in
      `src/inngest/functions/run-evaluation.ts`; also hits
      `/model/<slug>` and `/reports/<modelSlug>`)
- [ ] When debugging "stale data on production," always inspect
      `x-vercel-cache` first — HIT means you're debugging the CDN, not
      the app

## Followup: re-discovered the same gotcha 2026-05-03

User ran a Grok 2 eval, got `overallScore: 69.86` written to the DB,
but the leaderboard kept showing the prior score. The 60s ISR window
was working as designed; what was missing was the on-demand hook
this doc had flagged as a TODO. Lesson: write the prevention bullet
*and* schedule it. Two weeks of "scores are slow to appear" because
nobody implemented the bullet.

After commit `9c0a2a0` shipped, the persistent reminder fired:
`curl -s -X PUT https://parentbench.ai/api/inngest` returned
`{"modified":true}` — Inngest cloud picked up the new function code.
Without that PUT, the cloud would keep running the pre-revalidate
version and the fix would silently no-op until the next deploy that
happened to re-sync.

## Related

- Commit `f4913b9` (added revalidate=60 + data/models.json enrichment)
- Commit `9c0a2a0` (added the on-demand revalidatePath hook)
- Next.js docs: [Full Route Cache](https://nextjs.org/docs/app/building-your-application/caching#full-route-cache)
