---
title: "Audit every caller when simplifying away a shared helper"
category: "best-practices"
date: "2026-05-03"
tags: [refactoring, dead-code, sort-order, isr, leaderboard]
files:
  - src/lib/parentbench.ts
  - src/lib/leaderboard/sort.ts
  - src/app/page.tsx
  - src/components/parentbench/leaderboard-table.tsx
---

# Audit every caller when simplifying away a shared helper

## Context

You're simplifying a feature: removing a metric, dropping a column,
collapsing a sort. The UI change is straightforward — delete the
button, remove the badge, switch the default. But the metric you're
removing was computed in a shared helper used in more than one place,
and the helper still exists, still runs, and still feeds whichever
consumers you didn't touch.

The footgun: the consumer that *got* updated looks correct in
isolation. The consumer that *didn't* get updated also looks correct
in isolation. The bug only shows up when the user puts both views on
screen and notices they disagree about the same data.

This is the inverse of `rolling-out-a-new-column-safely.md`. That doc
covers adding a dimension and forgetting to filter for it; this doc
covers removing a dimension and forgetting to drop the transform.

## What it looked like in parentbench

Commit `f15932c` (2026-04-29) was a deliberate UI simplification:

> "drop net helpfulness, add report link, sortable headers"
>
> - Removed Net Helpfulness column from the leaderboard table
> - Default sort switched to Safety desc
> - `sortByNetHelpfulness` no longer used (per the commit message)

The commit removed the NH column and badge. The leaderboard table's
client-side sort handler defaulted to `overallScore` desc on mount.
The leaderboard *looked* correct.

What the commit didn't do: stop the data-layer pre-sort.
`getParentBenchScores()` in `src/lib/parentbench.ts` was still calling
`sortByNetHelpfulness(results)` before returning. The leaderboard
table threw that order away (because of its on-mount client sort), so
nothing visibly broke there. But the homepage consumed the same
function and just `slice(0, 3)` of the result — so the homepage
top-3 was still NH-sorted while the leaderboard top-N was Safety-
sorted. Same data, two different stories.

The bug stayed hidden for ~5 days. Surfaced when a high-safety
model had `falseRefusalRate = null` (no benign re-eval since rg3) —
NH-null sinks in the helper's tiebreak rules, so that model showed
high on the leaderboard and low on the homepage.

## The pattern

When you simplify a UI feature backed by a shared helper, the audit
runs in two passes:

### 1. Find every caller of the helper

```bash
grep -rn "sortByNetHelpfulness" src/ --include="*.ts" --include="*.tsx"
```

If the only callers are the helper's own test file, the helper is
dead code. Delete it. (This is what we ended up doing for
`sortByNetHelpfulness` after commit `efb1be7`.)

If the helper has live callers other than the one you simplified,
each of them is now a candidate consumer of the deprecated behavior.
Decide explicitly:
- Update them to use the new semantics, OR
- Document why they intentionally keep the old behavior, OR
- Discover that the helper is genuinely dead and remove it.

### 2. Find every render that depends on the helper's output

This is the easy-to-miss one. Even if the *function* is unused, its
*data shape* may be passed around. In our case:

- The data layer pre-sorted by NH.
- The leaderboard table re-sorted client-side. Bug masked.
- The homepage consumed the pre-sorted list directly. Bug visible.

The grep that finds this is the consumer's call site, not the helper:

```bash
grep -rn "getParentBenchScores\b" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/parentbench.ts"
```

For each consumer, ask: does it depend on the helper's pre-sort, or
does it impose its own order? If the consumer just slices/pages the
result, the helper's order is load-bearing for that consumer.

## What "looked correct in isolation" actually means

The leaderboard table looked correct because its `useState<SortField>("overall")`
ran on mount and re-sorted the data. If you opened just `/leaderboard`,
everything checked out. If you opened just `/`, everything also
checked out — three cards in some order. The bug was only visible
when you opened both and noticed model X was top-3 on one page and
sunk on the other.

Sanity rule: when simplifying a feature, **load every page that
consumes the underlying data and look at the actual order**. Two
correct-looking-in-isolation pages with disagreeing rankings is
exactly what this anti-pattern produces.

## Prevention

- [x] When you remove a metric / sort / transform from a UI, grep
      for every caller of the helper *and* every consumer of the data
      shape. Don't trust commit messages that say "no longer used."
- [x] If the audit shows the helper is genuinely dead, delete it and
      its tests in the same commit. A dormant helper plus an obsolete
      pre-sort is exactly how this bug got planted.
- [ ] Cross-page sanity: any time the homepage and the leaderboard
      both consume the same scores function, render both and verify
      the top-3 on the homepage matches the top-3 on the leaderboard
      (or the difference is intentional and documented).

## Related

- Commit `f15932c` (the original UI simplification — left the
  helper-driven pre-sort in place)
- Commit `efb1be7` (the fix — replaced the helper call with an inline
  safety-desc sort, deleted `sortByNetHelpfulness` and its test)
- `docs/solutions/best-practices/rolling-out-a-new-column-safely.md`
  (the inverse playbook — adding a dimension and remembering to
  filter for it everywhere)
