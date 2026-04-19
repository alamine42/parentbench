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

- [ ] Any App Router page that reads from the DB and expects "recent"
      data should ship with an explicit `revalidate` — relying on
      invisible defaults is a footgun
- [ ] Add an on-demand revalidation hook: when the Inngest
      `eval/completed` handler runs, call `revalidatePath('/')` and
      `revalidatePath('/leaderboard')` to bust the cache immediately
      rather than waiting the window
- [ ] When debugging "stale data on production," always inspect
      `x-vercel-cache` first — HIT means you're debugging the CDN, not
      the app

## Related

- Commit `f4913b9` (added revalidate=60 + data/models.json enrichment)
- Next.js docs: [Full Route Cache](https://nextjs.org/docs/app/building-your-application/caching#full-route-cache)
