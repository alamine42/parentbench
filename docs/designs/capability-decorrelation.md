# Capability decorrelation & safetywashing defense — Design

Beads epic: `parentbench-rg1`
Status: Draft (pre-implementation)
Author: Claude (with @alamine)
Date: 2026-04-25

## 1. Problem & Users

Per Ren et al., *Safetywashing* (arXiv:2407.21792, 2024), about half of
widely-cited AI safety benchmarks correlate ≥80% (Spearman) with a
capabilities component (PCA over MMLU/GSM8K/ARC/MATH/etc.). When that
correlation is high, "improvements on the benchmark" are mostly raw
capability gains in disguise — the field calls this *safetywashing*.
Refusal-style single-turn benchmarks like ParentBench are flagged as
the highest-risk class.

We don't measure or report this for ParentBench today. That's a
credibility ceiling: a sophisticated journalist or researcher *will*
ask, and we don't have a number.

### Primary user
A **researcher or journalist** evaluating whether ParentBench measures
something distinct from "this model is generally capable." They want
one number on `/methodology` that says "ParentBench's overall score
correlates 0.X with general capability across our active model set."

### Secondary user
A **parent** comparing AI tools doesn't read correlation coefficients.
For them, the visible benefit is the eventual **decorrelated subscore**
(rg1.4) — a number that captures something a smaller-but-careful model
can win on, not just bigger models.

### Why this is the right rigor reform now
- Cheapest credibility lift available: ~one number, computable today
- Methodology version 1.1.0 already shipped (rg2 close-out); v1.2.0
  is the right place to bump for "now we report capability correlation"
- Unblocks rg3 (over-alignment): once we publish the correlation, we
  can claim that Net Helpfulness moves it lower

## 2. Non-goals

- **Per-category capability correlation.** With n≈10 active models,
  per-category Spearman is statistically meaningless. Headline number
  only.
- **PCA over many capability benchmarks.** The Safetywashing paper used
  PCA over 8+ capability scores with n=70+ models. We have n≈10. PCA
  collapses to a z-score average; we'll just compute that directly and
  document the simplification.
- **Automatic refresh from public APIs.** No public API exposes
  proprietary model benchmark scores in a unified way. Manual curation
  with citation per model is the floor; build automation later.
- **Real-time score correlation.** Quarterly recompute + manual admin
  trigger.
- **Historical correlation tracking.** v1 stores only the latest
  computation. Series-over-time can come if we ever want it.

## 3. UX

No new public-facing page. Two surface additions and one admin page.

### 3.1 `/methodology` — new section

Insert a small section between "Scoring approach" and "Limitations".
The copy must communicate **both magnitude and sign** correctly —
Spearman ρ is on [-1, 1], and a strong negative correlation
(capable models score WORSE on safety) is just as concerning as a
strong positive one. **|ρ| near zero is the goal**, not low ρ
(Codex CRITICAL fix).

```
┌─────────────────────────────────────────────────────────────────┐
│  Is ParentBench just measuring how smart the model is?          │
├─────────────────────────────────────────────────────────────────┤
│  Coupling to general capability:  |ρ| = 0.XX  (sign: ±)         │
│                                                                  │
│  • |ρ| near 0  →  ParentBench captures something independent    │
│    of raw capability                                             │
│  • |ρ| near 1  →  the score mostly tracks how strong the model  │
│    is overall (the "safetywashing" risk Ren et al. flagged)     │
│  • Sign +      →  more-capable models tend to score higher      │
│  • Sign −      →  more-capable models tend to score lower       │
│                                                                  │
│  Today's |ρ| is **0.XX** with sign **±**, computed across XX    │
│  active-tier models against MMLU + GPQA + AIME 2025 as a        │
│  capability component (z-score average).                        │
│                                                                  │
│  Sample size disclaimer: with n≈10, treat this as a directional │
│  signal, not a precise estimate. Recomputed quarterly.          │
│                                                                  │
│  [See per-model capability scores] [Last computed: 2026-04-XX]  │
└─────────────────────────────────────────────────────────────────┘
```

**Empty / day-zero state** (Codex WARNING #5): if no
`correlation_reports` row exists yet, the section instead shows:

```
Coupling to general capability:  Not yet computed
We're populating capability benchmark data for our active models.
The first correlation report will publish once at least 8 active
models have ≥2 benchmark scores each.
```

**Stale state**: if the latest report's `computedAt` is more than
120 days old, the section adds an amber strip: *"This figure was
computed 4+ months ago. A refresh is overdue — admins have been
notified."*

### 3.2 `/methodology/changelog` — new route

Already authored content lives in `data/parentbench/methodology.json`
under `changelog`. Renders as a simple timeline with version pills.
Entries are reverse-chronological. v1.2.0 added by rg1.

### 3.3 `methodologyVersion` micro-display

A tiny `v1.2.0` pill next to every visible score on the leaderboard,
model-detail, and `/insights` pages. Click → `/methodology/changelog`.

Existing schema field: `score_batches.methodologyVersion`. Surface it
through the existing data-loading pipeline.

### 3.4 `/admin/capability-scores` — new admin page

Editable table of (model, benchmark, score, source URL, recordedAt)
tuples. Per-row actions: edit, mark stale, refresh. "Recompute
correlation" button calls the rg1.2 endpoint.

Auth: existing `validateSession` cookie pattern (used everywhere else
in `/admin`).

## 4. Architecture

### 4.1 Data flow

```
Manual curation (admin page)
         │
         ▼
model_capability_scores  (new table)
         │
         ▼  (capability score per model = z-score average across benchmarks)
build-capability-component  (pure function)
         │
         ▼  (Spearman ρ between capability vector and ParentBench overall)
compute-correlation  (pure function)
         │
         ▼
correlation_reports  (new table; one row per quarterly compute)
         │
         ▼
/methodology page reads latest row
```

### 4.2 New tables

```ts
export const capabilityBenchmarkEnum = pgEnum("capability_benchmark", [
  "mmlu",       // general knowledge / reasoning
  "gsm8k",      // DEPRECATED — saturated for frontier models, retained
                // in enum because Postgres enum drops are destructive
  "gpqa",       // grad-level QA — strong discrimination among frontier
                // models, all three providers publish it
  "aime_2025",  // 2025 American Invitational Math Exam — replaces
                // GSM8K as the math discriminator (added 2026-04-26)
]);

// History-preserving design (Codex WARNING #3): no unique constraint
// on (modelId, benchmark). Each curation entry is appended; the
// "current" score is the most-recent row per (modelId, benchmark).
// The compute step selects via DISTINCT ON.
export const modelCapabilityScores = pgTable("model_capability_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  benchmark: capabilityBenchmarkEnum("benchmark").notNull(),
  score: real("score").notNull(),                     // server-validated 0..100
  // Provenance metadata (Codex WARNING #4) — different shot settings
  // and variants produce non-comparable scores. We capture them so
  // the audit trail is honest.
  shotSetting: text("shot_setting"),                  // e.g. "5-shot", "0-shot", "cot"
  benchmarkVariant: text("benchmark_variant"),        // e.g. "Diamond" for GPQA, "Pro" for MMLU
  sourceUrl: text("source_url").notNull(),
  sourceNote: text("source_note"),                    // free-text caveat
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  recordedBy: text("recorded_by").notNull(),
  supersededAt: timestamp("superseded_at"),           // nullable; populated when a newer row arrives
});

export const correlationReports = pgTable("correlation_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  spearmanRho: real("spearman_rho").notNull(),       // -1 to 1
  spearmanRhoAbs: real("spearman_rho_abs").notNull(),// |ρ| — what the public UI headlines (Codex CRITICAL fix)
  modelCount: integer("model_count").notNull(),       // n
  benchmarksUsed: jsonb("benchmarks_used").$type<string[]>().notNull(),
  perModelScores: jsonb("per_model_scores").$type<{
    modelSlug: string;
    parentBenchScore: number;
    capabilityScore: number;
  }[]>().notNull(),
  methodologyVersion: text("methodology_version").notNull(),
});
```

### 4.2.1 Server-side validation

Admin POST validates before insert (Codex WARNING #4):

- `score` is a number with `0 <= score <= 100`
- `sourceUrl` is non-empty and starts with `http://` or `https://`
- `benchmark` is in the enum
- If `shotSetting` is omitted, default to `"unspecified"` and warn
  the admin via the response that comparability across rows is
  weakened

The newer-row insertion also stamps `superseded_at` on the prior
"current" row in a transaction, preserving history without ambiguity
about which row is live.

### 4.3 Pure modules

- `src/lib/capability/build-capability-score.ts` — z-score average
  across benchmarks per model. Returns `Map<modelId, capabilityScore>`.
- `src/lib/capability/spearman.ts` — Spearman rank-correlation.
  Implementation: rank both vectors with average-rank tie-breaking,
  Pearson correlation on the ranks. Pure function, fully testable.
- `src/lib/capability/compute-correlation.ts` — orchestrator. Loads
  data via the fetcher, calls build + spearman, returns the report
  shape ready to insert.

### 4.4 Inngest function

```
generate-correlation-report  (Inngest)
  triggers: [{ cron: "0 5 1 1,4,7,10 *" }]   // quarterly: 1st of Jan/Apr/Jul/Oct, 5am UTC
                                              // (after the Monday active-tier cron has run)
  steps:
    1. load-active-models
    2. load-capability-scores  (latest per (model, benchmark) via DISTINCT ON)
    3. filter-to-eligible      (models with ≥2 of 3 benchmark scores;
                                this is the bar everywhere — no single-
                                benchmark fallback. Codex WARNING #2 fix.)
    4. abort-if-insufficient   (need ≥5 eligible models with a
                                ParentBench score; otherwise insert
                                no row and surface "insufficient data"
                                via admin notification)
    5. load-parentbench-scores (latest published per eligible model)
    6. build-capability-component  (z-score average across each model's
                                    available benchmarks)
    7. compute-spearman
    8. insert-correlation-report   (stores both rho and |rho|)
    9. revalidate /methodology
```

Manual admin trigger sends `correlation/regenerate-requested` directly
to bypass the cron.

**Single-benchmark policy** (Codex WARNING #2): admin can ENTER a
single-benchmark score (it sits in the table for record-keeping), but
that model is excluded from the report until a second benchmark
arrives. The admin page shows a coverage column ("2/3 benchmarks
present") so the gap is visible.

### 4.5 Display surfaces (data plumbing)

- `getLatestCorrelationReport()` in `src/lib/parentbench.ts`. Used by
  `/methodology` server component.
- `getCurrentMethodologyVersion()` reads `methodology.json.version`.
  Used by the leaderboard / model-detail / insights pages.

### 4.6 Performance / reliability / security

- **Performance**: report compute is offline (cron + manual). Read
  path is one row from `correlation_reports` plus the methodology
  JSON — zero hot-path cost.
- **Reliability**: function is idempotent — multiple triggers in the
  same window produce identical reports. New row per recompute; old
  rows are immutable history.
- **Security**: no public input. Admin curation surface is
  cookie-auth gated. The `recordedBy` column captures the admin user
  for audit.

## 5. Subscope: rg1.4 (decorrelated subscore)

The original epic plan called for a "pressure-resistant" subscore
combining sycophancy, dynamic adversarial robustness, and calibration.

**Realistic blockers:**

- *Sycophancy probes* need the multi-turn runner from `rg5.1`
- *Dynamic adversarial robustness* needs the variant generator from
  `ffa.12` (the merged rg4.1 child)
- *Calibration* needs uncertainty/confidence in the model output —
  not currently captured in `eval_results`

**Recommendation: defer rg1.4 explicitly.** Don't ship a half-baked
subscore. Instead, after rg5.1 and ffa.12 land, revisit rg1.4 with
real data sources. Update the rg1.4 task to "depends on rg5.1 +
ffa.12.X" and lower priority.

What rg1 ships in v1: just the **transparency number**. That's the
lift Safetywashing actually recommends; the decorrelated subscore is a
nice-to-have that we'd be approximating without the input signals.

## 6. E2E / integration tests

`src/tests/capability/` — three test files.

### 6.1 Spearman implementation (`spearman.test.ts`)

| # | Scenario | Expectation |
|---|---|---|
| S1 | Two identical vectors | ρ = 1 |
| S2 | Two opposite vectors `[1,2,3]` vs `[3,2,1]` | ρ = -1 |
| S3 | Independent uniform random | \|ρ\| < 0.5 with high probability over many seeds |
| S4 | Vectors with ties resolved via average rank | matches scipy reference (hand-computed fixture) |
| S5 | n=3 minimum | does not throw; returns a number |
| S6 | n<2 | throws explicit "need at least 2 points" |
| S7 | Mismatched lengths | throws |
| S8 | Realistic 10-model fixture | ρ within 0.001 of hand-computed expected |

### 6.2 Capability score builder (`build-capability-score.test.ts`)

| # | Scenario | Expectation |
|---|---|---|
| B1 | Single benchmark, n=5 models | z-scores have mean=0, std=1 (within ε) |
| B2 | Two benchmarks per model | output is the average of the two z-scores |
| B3 | Model with only 1 benchmark when policy requires ≥2 | excluded from output (eligible list) |
| B4 | Model with all 3 benchmarks | included; capability score is z-average over all 3 |
| B5 | All models have identical scores on a benchmark | that benchmark's z-score is 0 for everyone; doesn't break the build |
| B6 | Model with no benchmarks | excluded from output |

### 6.3 Orchestrator + persistence (`compute-correlation.test.ts`)

| # | Scenario | Expectation |
|---|---|---|
| O1 | Insufficient data (<5 models with capability scores) | Aborts; returns "insufficient_data" without writing a row |
| O2 | All models have ≥2 benchmarks + a ParentBench score | writes one correlation_reports row with valid `spearmanRho` |
| O3 | Same input twice | second run produces an identical row (deterministic) |
| O4 | Excludes inactive models | n in report only counts active+evaluated models |

## 7. Simplification pass

| Considered | Dropped because |
|---|---|
| PCA over 4+ capability benchmarks | n≈10; PCA over 3-dim space is just z-score avg with extra steps. Math is misleading at this n. |
| Bootstrap CI on Spearman | Honest — but small n means CI is so wide ("ρ between 0.2 and 0.85") that publishing it confuses more than it informs. Sample size disclaimer is sufficient. |
| Track per-category correlation | n≈10 → meaningless per-category. Document as a non-goal. |
| Scrape capability scores from public leaderboards | Brittle, no canonical source for proprietary models, license concerns. Manual curation + sources is more honest. |
| One unified `methodologyVersion` column on `scores` rows | Already exists on `score_batches`. Don't sprawl the column to two places; pull from there in display. |
| Ship rg1.4 (decorrelated subscore) in v1 | Genuine blockers — sycophancy needs rg5, adversarial needs ffa.12, calibration not captured today. Defer with explicit dependency note. |

## 8. Adversarial review (Codex)

Performed 2026-04-25 via `/adversarial-review`. Verdict: "Needs
revisions before implementation," confidence Medium. All five
findings (1 critical + 4 warnings) incorporated.

| Severity | Finding | Resolution |
|---|---|---|
| CRITICAL | "Lower is better" copy is wrong — Spearman ρ on [-1,1]; ρ=−0.6 is bad, not good | UI surfaces |ρ| as the headline with sign annotation; copy explains both magnitude and direction (§3.1) |
| WARNING | Inconsistent ≥2-benchmarks rule between cron and tests | Single policy locked: ≥2 benchmarks REQUIRED for inclusion in any correlation report; admin can still enter single-benchmark rows but they're flagged "incomplete" until a second lands (§4.4, §6.2) |
| WARNING | unique(model, benchmark) destroys history on edit | Constraint removed; rows are append-only with `superseded_at` populated on the prior row in a transaction; compute uses DISTINCT ON to pick the live row (§4.2) |
| WARNING | No score validation / shot-setting metadata | Server validates `0 ≤ score ≤ 100`; `shotSetting`, `benchmarkVariant`, `sourceNote` columns capture provenance (§4.2, §4.2.1) |
| WARNING | No "not yet computed" / staleness UX | Methodology section handles null with "Not yet computed" copy; >120 days triggers admin alert and amber strip (§3.1) |

## 9. Mapping to beads tasks

| Task | Section(s) |
|---|---|
| rg1.1 capability fetcher + storage | 4.2, 3.4 |
| rg1.2 compute & display Spearman | 4.3, 4.4, 3.1, 6.1, 6.3 |
| rg1.3 methodology version + changelog | 3.2, 3.3, 4.5 |
| rg1.4 decorrelated subscore | 5 — DEFERRED, explicit deps on rg5.1 + ffa.12 |

## 10. Two-step deploy plan

1. **Schema + admin curation page** (rg1.1) — ship; populate manually.
2. **Once ≥8 active models have ≥2 benchmark scores each**, run
   the cron / admin trigger to produce the first `correlation_report`
   row.
3. **Bump methodology to v1.2.0** in the same commit as the first
   report ships, with a changelog entry explaining the new section.
4. **Surface on /methodology** in that same commit so the public
   number lands together with the version bump.

## 11. Risk register

| Risk | Mitigation |
|---|---|
| Capability scores go stale | Admin page surfaces `recordedAt`; quarterly cron + admin alert when an active model has no benchmark in last 12 months |
| Different sources use different MMLU subset (e.g., 5-shot vs 0-shot) | `sourceUrl` is required; `sourceNote` field optional for nuance; document the policy on `/methodology` |
| n=10 leads to noisy ρ | Disclaimer on the methodology section ("n=10; treat as a directional signal, not a precise estimate") |
| One outlier model swings ρ wildly | Compute and store both regular Spearman and a leave-one-out worst case; only the regular one is displayed publicly |
| Provider releases a model we don't have benchmarks for yet | The compute step requires ≥2 benchmarks; un-benchmarked models are excluded with a note on the admin page |
| Capability rises as a model is fine-tuned for safety | Re-curate quarterly; track `recordedAt` so we know how stale a number is |
