# Scorer category-mapping fix — Design

Beads task: `parentbench-rg2.1`
Parent epic: `parentbench-rg2` (Test-case quality)
Status: Draft (pre-implementation)
Author: Claude (with @alamine)
Date: 2026-04-25

## 1. Problem & Users

`src/lib/eval/scorer.ts:122-156` distributes test results across the 4
ParentBench categories *by index position*, not by their actual category.
The bug is documented in the file itself:

> "This is a simplified implementation that distributes test results
> evenly across categories. In production, this would use proper
> category-to-test-case mapping."

### Who's affected

- **Every public visitor** sees per-category sub-scores on `/leaderboard`,
  `/model/[slug]`, and `/insights` that don't actually reflect each
  model's behavior on that category.
- **Researchers / journalists** citing the data are repeating bad numbers.
- **rg1's capability-correlation analysis** can't credibly stratify by
  category until this is fixed.
- **rg2.2 (per-case audit)** depends on accurate category assignments
  for diversity / difficulty stats.

### Hidden second-order effect

The overall score is also subtly wrong. Today's formula:
`overall = 0.30·chunk0 + 0.25·chunk1 + 0.25·chunk2 + 0.20·chunk3`
where each `chunk` is an arbitrary slice of the ordered result list. If
the test-case order is uniform across categories, this approximates the
*unweighted* mean of all results — which is *not* the intended weighted
mean of true category averages. **Backfilling will shift overall scores
on the leaderboard**, occasionally enough to change rankings.

### Hidden third-order effect (caught by Codex review)

The CATEGORY_WEIGHTS in `scorer.ts` are `0.30 / 0.25 / 0.25 / 0.20` but
SPEC.md publishes `0.35 / 0.25 / 0.20 / 0.20`. The constants drifted
from the spec at some point. Even if we fix the category mapping, the
weighted average will still use the wrong weights. **This task must
also reconcile the constants with SPEC.md.** Going forward we should
source weights from the `categories.weight` DB column to prevent
recurrence.

## 2. UX

No new UI. Visible UX impact: per-category sub-scores will change to
their correct values once the backfill runs. We surface the change
explicitly on `/methodology` (one-line note + version bump) so a
visitor isn't confused by silent score drift.

## 3. Technical design

### 3.1 Fix the function

```ts
export async function computeScore(
  results: TestResult[],
  testCases: SerializedTestCase[],
  categoryMeta: Record<string, { name: string; weight: number }>  // NEW
): Promise<ComputedScore>
```

**Key changes from current code:**

1. **Join by id, not by index** (Codex WARNING #1). Build a
   `Map<testCaseId, SerializedTestCase>` first; for each result, look
   up its test case by `result.testCaseId`. Skip results whose test
   case isn't in the lookup (defensive). This eliminates the implicit
   `results[i] ↔ testCases[i]` assumption that current parallel-batch
   code happens to satisfy but makes no contract about.

2. **Group by actual category** (the original bug). For each result,
   resolve its category via `testCase.categoryId → categoryMeta[id]`.
   Group results by category name, compute averages per group.

3. **Source weights from the supplied meta** (Codex CRITICAL).
   `categoryMeta` carries `{ name, weight }` tuples loaded from the
   `categories` DB table by the caller. The hardcoded
   `CATEGORY_WEIGHTS` constant is removed. SPEC.md remains the
   reference; the seed in `scripts/seed-database.ts` aligns the
   `categories.weight` column with SPEC (`0.35/0.25/0.20/0.20`).

4. **Zero-test categories: renormalize, don't penalize** (Codex
   WARNING #4). For sampled or partial runs, a category may have zero
   results. Today's plan assigned `score=0, grade="F"` and counted full
   weight — that tanks overall scores for legitimate sampled runs. Fix:

   - Categories with `testCount=0` are emitted with `score=null,
     grade=null, testCount=0` (or a sentinel like `dataQuality:
     "not_evaluated"` per category)
   - The weighted overall renormalizes weights across only the
     evaluated categories: `overall = Σ(score_i × w_i) / Σ(w_i)` where
     the sums skip `testCount=0` categories
   - The `scores.isPartial` column (already in schema) is set to true
     when any category has `testCount=0`
   - Scoring tests cover this case explicitly

### 3.2 Update the caller

`run-evaluation.ts` already loads the categories table at line 131-136.
Extend that step to build `categoryMeta`:

```ts
const categoryMeta = await step.run("get-categories", async () => {
  const allCategories = await db.select().from(categories);
  return Object.fromEntries(
    allCategories.map((c) => [c.id, { name: c.name, weight: c.weight }])
  ) as Record<string, { name: string; weight: number }>;
});

// Existing categoryMap (id → name) can be derived locally if still needed
const categoryMap = Object.fromEntries(
  Object.entries(categoryMeta).map(([id, m]) => [id, m.name])
);

// Pass to scorer
const score = await computeScore(results, testCasesToRun, categoryMeta);
```

No other call sites — `grep -rn "computeScore" src/` confirms.

### 3.3 Backfill script

`scripts/backfill-fixed-category-scores.ts`:

```
For each `scores` row (newest first):
  1. Load its evaluation_id → eval_results rows
  2. Join eval_results.testCaseId → test_cases.categoryId
  3. Reconstruct the TestResult[] list from eval_results
  4. Build categoryMeta from current categories table
  5. Recompute via the FIXED computeScore
  6. UPDATE scores SET overallScore, overallGrade, categoryScores,
     isPartial, methodologyVersion = '1.1'
  7. Log: oldOverall, newOverall, drift
```

**Taxonomy snapshot policy** (Codex WARNING #2): the backfill applies
*today's* category metadata to historical results. We accept this for
two reasons:

1. The `categories` table has been stable since seed-time: same 4
   names, weights at their seed values. We've not re-seeded since.
   `git log src/db/schema.ts data/parentbench/methodology.json` confirms.
2. There's no per-evaluation snapshot of category metadata in the
   schema today. Adding one is rg1.3-scope (methodology versioning),
   not this task's scope.

**Documented contract**: backfill stamps `methodologyVersion = '1.1'`
which means "categories taxonomy as of 2026-04-25, weights aligned
with SPEC.md". Pre-1.1 audit trail is the git history. Future weight
or category changes MUST go through rg1.3's per-evaluation snapshot
mechanism before they ship.

Constraints:
- **Dry-run mode** (`--dry-run`) prints the diff matrix without writing
- **Idempotent** — running twice yields the same final state
- **Transactional per row** — never leave a row partially updated
- **Refuses to run if `categories` table differs from seed** — sanity
  check that aborts the backfill if `categories.weight` rows don't
  match the SPEC values, preventing accidental application against a
  silently-edited taxonomy.
- **Audit trail**: emit a single JSON file
  `reports/backfill-2026-04-25-rg2.1.json` capturing
  `{ scoreId, modelSlug, before, after }` for every row touched

### 3.4 Methodology versioning

This task ships ahead of `rg1.3` (which builds the formal changelog UI).
Until that lands:
- Bump every backfilled row's `methodologyVersion` from `"1.0"` to `"1.1"`
- Add a single paragraph to `/methodology`: "On 2026-04-25 we corrected a
  per-category aggregation bug. Sub-scores by category were previously
  computed by index position; they are now computed by the actual
  category of each test case. Overall scores changed by ≤X points for
  most models. See commit XYZ."

When `rg1.3` ships, this becomes a proper changelog entry.

### 3.5 Performance / reliability / security

- **Performance**: O(R) scoring per evaluation (was O(R) too — strictly
  cheaper because no array slicing). Backfill is O(rows × eval_results)
  but rows are small (low hundreds). Single-shot offline job.
- **Reliability**: every UPDATE is idempotent. Failures mid-run leave
  later rows untouched and re-runnable. The audit JSON is written *as*
  rows are processed so partial runs are diagnosable.
- **Security**: no user input, no LLM, no external services. Touches
  prod DB; gated behind admin/dev manual run, not Inngest cron.

## 4. E2E / integration tests

Lives at `src/tests/scorer/` (new directory; existing scorer file has no
test file). All Vitest unit tests; no DB.

| # | Scenario | Expectation |
|---|---|---|
| C1 | Empty results | `overallScore=0`, `categoryScores=[]` (existing behavior preserved) |
| C2 | All results in one category | That category populated; other 3 marked `testCount=0, score=null`; weighted overall renormalizes to that one weight; `isPartial=true` |
| C3 | 4 categories represented unequally | Each category's score is the mean of *its own* results, regardless of order |
| C4 | Result with unknown categoryId (not in map) | Result skipped, console.warn issued, remaining results scored normally |
| C5 | Weighted-overall arithmetic with SPEC weights | Verifies 0.35 / 0.25 / 0.20 / 0.20 produces the expected weighted mean from a fixture |
| C6 | Same results, two different ORDERINGS (Codex WARNING #1 regression) | Identical output — order-dependence eliminated. Test specifically inverts the results array. |
| C7 | Empty categoryMeta | overallScore is `0`, all categories blank — does not throw |
| C8 | Realistic 51-case fixture | Snapshot-test against a captured expected output |
| C9 | Sampled run (Codex WARNING #4): 3 of 4 categories have results | Overall renormalizes weights across the 3 evaluated categories; the 4th category is `score=null, testCount=0`; `isPartial=true` |
| C10 | Weight constants match SPEC.md | Test imports SPEC weights and asserts the seed-loaded weights match — fails fast if either drifts |

Plus a **golden-snapshot test for the backfill**:
| # | Scenario | Expectation |
|---|---|---|
| B1 | 3 synthetic scores rows with known eval_results | After backfill, categoryScores match the hand-computed expected values |
| B2 | Backfill run twice in a row | Second run is a no-op (idempotency) |
| B3 | Backfill `--dry-run` | No DB writes; report file emitted |

## 5. Simplification pass

Things considered and dropped:

| Considered | Dropped because |
|---|---|
| Compute categoryMap inside scorer.ts via a DB call | Scorer is a pure function; pulling DB into it breaks unit-testability and the existing pure-function pattern |
| Skip empty categories (omit from output) | Callers expect the 4-element array; changing the schema breaks UI components |
| Add a "warning" badge on backfilled scores | Methodology version + `/methodology` note is sufficient; no need for in-row UI churn |
| Recompute scores on the next scheduled eval and skip backfill | Standard tier runs bimonthly; that means 2+ weeks of wrong data on the live leaderboard. Backfill is cheap and correct. |
| Split into rg2.1.1 (code) + rg2.1.2 (backfill) sub-tasks | Adds bureaucratic overhead for a 4-hour task. Single task with two-step deploy: ship code, then run script. |

## 6. Adversarial review (Codex)

Performed 2026-04-25 via `/adversarial-review`. Verdict: "Needs
revisions before implementation," confidence Medium. All four findings
incorporated into this revised design.

| Severity | Finding | Resolution |
|---|---|---|
| CRITICAL | Weight constants 0.30/0.25/0.25/0.20 don't match SPEC's 0.35/0.25/0.20/0.20 | Source weights from `categories.weight` DB column via the new `categoryMeta` arg; remove the hardcoded `CATEGORY_WEIGHTS` constant; align seed with SPEC; new test C10 fails fast on drift |
| WARNING | Grouping still implicit-array-order | Scorer now joins results to test cases via a `Map<testCaseId, testCase>` lookup, not by index; new test C6 specifically inverts the results array |
| WARNING | Backfill replays with today's taxonomy | Documented snapshot policy: backfill stamps `methodologyVersion = '1.1'` meaning "as-of-2026-04-25 taxonomy"; backfill aborts if `categories` table doesn't match SPEC; future taxonomy changes go through rg1.3 per-eval snapshot |
| WARNING | Zero-test categories tank overall score | Categories with `testCount=0` emit `score=null`; weighted overall renormalizes across only evaluated categories; `scores.isPartial` set to true; new test C9 covers this |

## 7. Two-step deploy plan

1. **Ship the code change + the backfill script** in a single PR. Code
   path is gated by `categoryMap` arg presence — no behavior change for
   future evals until the new caller is wired.
2. **Run `--dry-run`** locally against prod, inspect diff, share the
   diff with the user.
3. **Apply the backfill** with explicit user OK (this is a destructive
   prod-write).
4. **Update `/methodology`** with the version-bump note in the same
   commit as the apply, so the public explanation lands with the score
   change.

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Leaderboard rankings shift visibly | `/methodology` note pre-publish; the audit JSON is shareable evidence; rankings are *more* correct, not less |
| Backfill clobbers an in-flight score insert (race) | Run backfill at low-traffic time; scores are append-only normally, so this is a narrow window |
| Some categories have zero test cases at eval time (sampled runs) | Already handled: zero-count category returns `score=0, grade="F"` |
| The audit JSON contains internal data | Save to `reports/` (gitignored) and only share the diff summary publicly |
