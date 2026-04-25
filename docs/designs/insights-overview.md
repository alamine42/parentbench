# Insights & Overview Page — Design

Beads epic: `parentbench-ov1`
Status: Draft (pre-implementation)
Author: Claude (with @alamine)
Date: 2026-04-25

## 1. Problem & Users

The leaderboard answers "which model scores highest?" It does not answer
the questions a parent actually has:

- *Are these models meaningfully different on the things I care about, or
  is it noise?*
- *Which provider is best at refusing manipulation specifically?*
- *Did anyone get noticeably better or worse this month?*
- *What should I take away from all this?*

A raw table of grades cannot carry that load. We need an interpretive
layer — short, parent-readable, chart-led, kept current by the same eval
pipeline that produces the raw scores.

**Primary user:** a non-technical parent comparing AI tools their child
might use. **Secondary user:** journalists / advocates who cite the site
and need a single sharable page that says "here's the state of play."

## 2. Non-goals

- Per-model deep dives (live on the model detail page; out of scope).
- Hand-curated editorial / op-eds. Everything published from `/insights`
  is generated from the live data with admin oversight.
- Real-time / streaming updates. Reports are a coarse, debounced view.
- A new charting library. Reuse `recharts` (already in `package.json`,
  already used in `src/components/charts/score-history-chart.tsx`).

## 3. UX

### 3.1 Page anatomy (`/insights`)

```
┌─────────────────────────────────────────────────────────────┐
│  Hero band                                                  │
│   • H1: "The State of Child-Safe AI"                       │
│   • Subhead: 1 line                                        │
│   • Last-updated badge + "data through" date              │
├─────────────────────────────────────────────────────────────┤
│  TL;DR card (full width)                                   │
│   • One-paragraph summary (LLM-generated, validated)       │
│   • One headline metric (number + caption)                 │
├─────────────────────────────────────────────────────────────┤
│  Chart grid (2x2 on desktop, stacked on mobile)            │
│   ┌─────────────┐  ┌─────────────┐                        │
│   │ Provider    │  │ Category    │                        │
│   │ Rollup      │  │ Leaders     │                        │
│   │ (bar)       │  │ (heatmap)   │                        │
│   └─────────────┘  └─────────────┘                        │
│   ┌─────────────┐  ┌─────────────┐                        │
│   │ Biggest     │  │ Score       │                        │
│   │ Movers (30d)│  │ Spread      │                        │
│   │ (diverging) │  │ (range bar) │                        │
│   └─────────────┘  └─────────────┘                        │
├─────────────────────────────────────────────────────────────┤
│  Callout cards (3 horizontally, stacked on mobile)         │
│   • "Best at refusing manipulation"                        │
│   • "Biggest jump this month"                              │
│   • "New on the leaderboard"                               │
├─────────────────────────────────────────────────────────────┤
│  Long-form narrative (~600–1200 words)                     │
│   • Intro                                                   │
│   • ~3 themed sections with inline mini-charts             │
│   • Methodology footer (writer model, data window, links)  │
├─────────────────────────────────────────────────────────────┤
│  Archive teaser → /insights/archive                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Tone & accessibility

- Reading level: aim for 9th grade (parent-readable, not researcher).
- Verbatim category labels reuse existing `PARENTBENCH_CATEGORY_META`
  display names — no LLM paraphrasing of taxonomy terms.
- All charts have aria-labels and a textual fallback ("Top 3 in
  manipulation resistance: …").
- Mobile: 2-column chart grid collapses to a single column; no
  horizontal scroll; charts get min-height 240px so labels stay legible.

### 3.3 Routes

| Path | Purpose |
|---|---|
| `/insights` | Latest published report |
| `/insights/[slug]` | Historical entry (slug = report's `generated_at` date, e.g., `2026-04-25`) |
| `/insights/archive` | Paginated list of past reports |
| Homepage `/` | Compact teaser card linking to `/insights` |
| `/admin/insights` | Admin: manage drafts, regen, retract |

`revalidate = 60` on `/insights` and `/insights/[slug]` (matches
`/leaderboard`). Manual `revalidatePath('/insights')` after publish so
new reports surface within seconds.

### 3.4 Empty states

- No published report yet → `/insights` returns 404. Homepage card
  hidden. Admin sees a "Generate first report" button.
- Latest report retracted with no fallback published → 404 (don't
  silently show a stale retracted report).

## 4. Architecture

### 4.1 Data flow

```
   (eval/completed event)        (models row insert)        (admin: POST regen)
            │                            │                         │
            └────────────────────────────┴─────────────────────────┘
                                         │
                            ┌────────────▼─────────────┐
                            │ maybe-regenerate-insights │  (Inngest)
                            │  • debounce 12h           │
                            │  • dedupe trigger reasons │
                            └────────────┬─────────────┘
                                         │
                            ┌────────────▼─────────────┐
                            │ generate-insights-report  │  (Inngest)
                            │  step 1: build aggregate  │  (pure SQL)
                            │  step 2: call LLM writer  │
                            │  step 3: numeric guard    │
                            │  step 4: insert draft     │
                            │  step 5: auto-publish     │
                            │  step 6: revalidatePath   │
                            └────────────┬─────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │ insights_reports    │
                              │   (Postgres)        │
                              └──────────┬──────────┘
                                         │
                          (read by /insights, /insights/[slug],
                           homepage card, admin page)
```

Why two Inngest functions? Separation of concerns: debounce is a policy
decision; generation is the work. It also lets the admin "Regenerate
now" call go straight to `generate-insights-report` (bypass debounce)
while organic events go through `maybe-regenerate-insights`.

### 4.2 Schema: `insights_reports`

```ts
export const insightsReportStatusEnum = pgEnum("insights_report_status", [
  "draft",              // aggregate snapshotted, narrative not yet attempted
  "generation_failed",  // writer ran but validator/LLM call failed
  "published",          // visible on /insights and /insights/[slug]
  "retracted",          // hidden but kept for audit
]);

export const insightsTriggerReasonEnum = pgEnum("insights_trigger_reason", [
  "score_delta", "new_model", "active_tier_promoted",
  "manual", "scheduled_recheck",
]);

export const insightsReports = pgTable("insights_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),               // "2026-04-25" or "2026-04-25-2"
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  dataThrough: timestamp("data_through").notNull(),    // latest score timestamp considered

  aggregates: jsonb("aggregates").notNull(),           // typed InsightsAggregate
  narrative: jsonb("narrative"),                       // NULLABLE — populated after writer succeeds
  failureReason: text("failure_reason"),               // populated when status='generation_failed'

  generatorModel: text("generator_model").notNull(),
  generatorCostUsd: real("generator_cost_usd"),
  generatorTokensIn: integer("generator_tokens_in"),
  generatorTokensOut: integer("generator_tokens_out"),

  triggerReason: insightsTriggerReasonEnum("trigger_reason").notNull(),
  triggeringEvent: jsonb("triggering_event"),          // small payload describing what fired it

  status: insightsReportStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  retractedAt: timestamp("retracted_at"),
  retractedReason: text("retracted_reason"),
}, (t) => ({
  byStatusGenerated: index("idx_insights_status_generated")
    .on(t.status, t.generatedAt.desc()),
}));
```

Notes from adversarial review:
- `narrative` is intentionally nullable so the step-2 draft insert
  can succeed before the writer runs. Public reads filter
  `status = 'published'` (which guarantees narrative IS NOT NULL).
- Failure path uses `status='generation_failed' + failure_reason` rather
  than wedging the failure into the `draft` state (Codex CRITICAL #1).
- Debounced "pending triggers" carrying forward is dropped from the
  design (was vaporware — no schema column existed). Inngest already
  retains the event log; if the user really wants to know what fired
  during a debounced window, query Inngest history. Keeps the schema
  honest.

Migration follows the prior session's lesson: hand-write a narrow
additive SQL script under `scripts/migrate-add-insights-reports.ts` with
`CREATE TABLE IF NOT EXISTS` semantics. Do NOT use `drizzle-kit push`
against prod (would risk dropping diverged columns elsewhere).

### 4.3 `InsightsAggregate` shape (the numeric contract)

```ts
type InsightsAggregate = {
  generatedAt: string;        // ISO
  dataThrough: string;        // ISO
  windowDays: 30;
  totals: {
    activeModels: number;
    providers: number;
    evalsLast30d: number;
  };
  spread: {
    topScore: number; topModelSlug: string;
    bottomScore: number; bottomModelSlug: string;
    gap: number;
    stdDev: number;
  };
  providers: Array<{
    name: string;
    avgOverall: number;
    perCategory: Record<ParentBenchCategory, number>;
    activeModelCount: number;
  }>;
  categoryLeaders: Record<ParentBenchCategory, {
    modelSlug: string; modelName: string; provider: string; score: number;
  }>;
  biggestMovers: Array<{
    modelSlug: string; modelName: string; provider: string;
    deltaPoints: number; previousScore: number; currentScore: number;
    direction: "up" | "down";
  }>; // top 5 by |delta|, only ≥5pt moves; MAY BE EMPTY
  newcomers: Array<{
    modelSlug: string; modelName: string; provider: string;
    debutScore: number; debutGrade: string; addedAt: string;
    percentile: number;
  }>; // MAY BE EMPTY
  regressionWatch: Array<{
    modelSlug: string; deltaPoints: number; currentScore: number;
  }>; // active models with ≥5pt drop; MAY BE EMPTY
  displayValues: string[];   // human-friendly renderings the writer is
                             // allowed to quote (see §4.6)
};
```

This object is the *only* numeric source for both the charts and the
narrative. Charts read it directly. The narrative validator checks every
number it produces against this object's values (raw numbers ±0.5
tolerance OR exact match against `displayValues`).

**Empty buckets are valid.** Three of the seven sections (`biggestMovers`,
`newcomers`, `regressionWatch`) can legitimately be empty in a calm
window. Aggregator must produce a valid object in those cases; chart
components and prompt builder both handle empty arrays gracefully.

### 4.4 `InsightsNarrative` shape

```ts
type InsightsNarrative = {
  tldr: string;                                  // 1 paragraph, ≤ 280 chars
  headlineMetric: { value: string; caption: string };
  callouts: Array<{ kind: "category_leader" | "biggest_mover"
                          | "newcomer" | "regression";
                    title: string; body: string;
                    subjectSlug: string; }>;     // 0–4 items; only requested
                                                 // for non-empty buckets
  sections: Array<{ heading: string; body: string;     // markdown
                    chartSlot?: "provider-rollup" | "category-leaders"
                              | "biggest-movers" | "spread"; }>;
  methodologyNote: string;                       // 1 short paragraph
};
```

LLM is forced to JSON via the provider's structured-output mode (Anthropic
tool use or OpenAI `response_format`). No free-form markdown blob.

**Empty-bucket policy** (Codex CRITICAL #3): the prompt is constructed
dynamically from the aggregate. If `newcomers` is empty, the prompt
does not request a `newcomer` callout and the validator does not require
one. The UI shows static fallback copy ("No new entrants this month")
in the slot. Same for `biggestMovers` and `regressionWatch`. The only
callout always required is `category_leader` (it can't be empty unless
the leaderboard itself is empty).

### 4.5 Generator pipeline

Inngest function `generate-insights-report`, `retries: 2`, concurrency 1.

```
step 1: build-aggregate         (SQL only, no LLM)
step 2: snapshot-aggregate      (insert draft row: aggregates set,
                                  narrative = NULL — see §4.2)
step 3: call-writer-model       (single LLM call → narrative JSON,
                                  prompt built dynamically from
                                  non-empty buckets only — see §4.4)
step 4: validate-narrative      (numeric guard + length checks)
        on fail: update row → status='generation_failed' +
                 failure_reason, exit. Admin alert sent.
step 5: persist-narrative       (update draft row with narrative + costs)
step 6: auto-publish            (status: draft → published, set publishedAt)
step 7: revalidate-paths        (revalidatePath('/insights'),
                                  revalidatePath('/'),
                                  revalidatePath('/insights/archive'),
                                  revalidatePath(`/insights/${slug}`))
```

### 4.6 Numeric guard (anti-hallucination)

The aggregate exposes a precomputed `displayValues` array of every
human-readable rendering the writer is allowed to use:

```ts
// Inside InsightsAggregate (added per Codex WARNING #2)
displayValues: string[];   // e.g., ["92", "92.4", "11 models", "9-point gap",
                           //         "Anthropic", "Google", "Gemini 3 Flash", ...]
```

For every text field (`tldr`, callouts, sections), tokenize numeric
substrings (regex: `\d+(?:\.\d+)?%?`) and verify each is either:

- Present in `displayValues` exactly, OR
- Within ±0.5 of any raw numeric value in the aggregate (covers natural
  rounding like "92" for 92.4), OR
- A small whitelisted constant (years 2024–2030, "100%", ordinals
  "1st"/"2nd"/"3rd"/"4th", and the category count from
  `Object.keys(PARENTBENCH_CATEGORY_META).length`).

If any token fails, the whole narrative is rejected. The row is updated
to `status='generation_failed'` with `failure_reason` populated. Admin
gets an alert (route TBD in implementation; Sentry breadcrumb is the
floor, Resend email the stretch goal — see §8).

The system prompt instructs the writer: "When quoting numbers, prefer
values from `displayValues`. Do not invent statistics." The validator
is the contract enforcer; the prompt is the cooperation request.

### 4.7 Generator-model bias mitigation

The user's correct intuition: "writer = model on the leaderboard" looks
biased. Three mitigations stacked:

1. **Disclosure.** Methodology footer names the writer model and notes
   that all numbers are programmatically validated.
2. **Numeric guard.** Whatever model writes, it cannot fabricate a
   metric. The bias surface shrinks to *framing* of identical numbers.
3. **Configurability.** `INSIGHTS_GENERATOR_MODEL` env var. Default
   `claude-haiku-4-5` (cheap, capable, well-calibrated tone). When a
   higher-stakes report is needed, swap to `gpt-5-4` for one regen.

We deliberately do NOT use a model from a provider that's currently
"behind" — picking the leader is more defensible than picking a
sympathetic underdog.

### 4.8 Trigger / debounce logic

`maybe-regenerate-insights` listens for:

- `eval/completed` → check if model is active-tier and
  `|new - prev| >= 5` (mirrors the existing alert in
  `run-evaluation.ts:373`).
- `model/created` → emitted from the admin model-create endpoint
  (`src/app/api/admin/models/route.ts` — wired in task ov1.9).
- `eval/active-tier-promoted` → emitted when a model's `evalTier`
  transitions to `active` (also wired in ov1.9).
- Cron `0 3 * * 1` (Monday 3am UTC, one hour after active-tier evals
  finish) → safety net `scheduled_recheck` if no organic trigger fired
  but data has changed.

Debounce: if the last *published* report's `generatedAt` is < 12h ago,
no-op silently. The new trigger is recorded in the Inngest event log
(which Inngest retains automatically) — we don't carry pending state
in our schema. If the user later wants to know what was suppressed,
they query Inngest history.

Why dropped: an earlier draft proposed a `pending_triggers` JSON column
on `insights_reports` to carry forward debounced events. Codex flagged
this as vaporware (no schema column existed and no consumer would read
it). We removed the concept entirely — Inngest is already the source
of truth for "what events fired."

### 4.9 Cost & rate limiting

- One regen ≈ one LLM call. With `claude-haiku-4-5` and ~4k input tokens
  + 2k output: ~$0.005 per report. At an upper bound of ~30 regens/month
  (very pessimistic), that's $0.15/mo. Negligible vs. eval cost.
- Concurrency 1 on the Inngest function so simultaneous triggers don't
  race on `slug` uniqueness.
- Admin "Regenerate now" rate-limited to 1/min via in-memory token bucket.

### 4.10 Reliability

- Each step in the Inngest function is idempotent (insert with
  `ON CONFLICT DO NOTHING` on slug; updates are by id).
- Slug strategy: `YYYY-MM-DD` for the first report of the day,
  `YYYY-MM-DD-2`, `-3`, … for additional same-day regens. Never
  collides; archive remains stable.
- Generator failure leaves a draft row with `triggering_event.error`
  populated — visible in admin, not on the public page.
- DB writes go through one transaction at step 2 (snapshot) and one at
  step 5 (narrative). No partial state visible to readers.

### 4.11 Security

- All admin endpoints reuse `validateSession` from
  `src/app/api/admin/auth/route.ts`.
- Public endpoints are read-only; no user-supplied input reaches the
  generator. The aggregate is built from internal DB state only.
- LLM prompt does not include any unsanitized data (every string in the
  aggregate comes from internal records: model slugs, provider names,
  category names — all controlled).
- OG image generator (for `/insights/[slug]`) uses Next's built-in
  `ImageResponse` with no user input → no SSRF surface.
- `retractedReason` is admin-supplied free text; we render with
  `dangerouslySetInnerHTML=false` (default) — Next handles escaping.

### 4.12 Performance

- `/insights` is a server component with `revalidate=60`; under cache
  it's a static render.
- Aggregate is computed once at generation time and stored as JSONB —
  no aggregate query on page load.
- Charts are client components (recharts needs DOM) but lazily mounted
  with `next/dynamic({ ssr: false })` so they don't block FCP. Skeleton
  is a fixed-height placeholder to prevent CLS.
- Narrative is server-rendered markdown → HTML at request time with
  `marked` (already transitively present, or we add a single tiny dep
  if not — TBD during implementation).

## 5. E2E / integration tests (upfront)

This codebase uses Vitest + jsdom; there is no Playwright. "E2E" here
means full-stack integration tests that exercise the route + the
Inngest handler with a seeded test DB. Tests live under
`src/tests/insights/`.

### 5.1 Aggregator (`build-aggregate.test.ts`)

| # | Scenario | Expectation |
|---|---|---|
| A1 | Seed: 5 active models across 3 providers | `totals.activeModels === 5`, `totals.providers === 3` |
| A2 | One model has +6 score delta vs. prior | appears in `biggestMovers` with `direction: "up"` |
| A3 | One model has +3 delta | NOT in `biggestMovers` (below 5pt threshold) |
| A4 | One model has -7 delta | appears in `biggestMovers` *and* `regressionWatch` |
| A5 | Model added 10 days ago, 1 score | in `newcomers` with correct percentile |
| A6 | All scores equal | `spread.gap === 0`, `stdDev === 0` |
| A7 | Inactive models present | excluded from every section |
| A8 | Calm window: no movers, no newcomers, no regressions | aggregate is valid; the three arrays are empty; `categoryLeaders` still populated |
| A9 | `displayValues` contents | includes top score (raw + rounded), provider names, gap phrasing, model count |

### 5.2 Numeric guard (`numeric-guard.test.ts`)

| # | Narrative content | Aggregate has | Pass? |
|---|---|---|---|
| G1 | "Top score is 92.4" | top=92.4 | ✅ exact |
| G2 | "Top score is 92" | top=92.4 | ✅ within ±0.5 rounding tolerance |
| G3 | "Provider X leads with 87" | aggregate has 87 | ✅ |
| G4 | "85% of models pass" | no 85 in aggregate | ❌ rejected |
| G5 | "Founded in 2026" | year whitelist | ✅ |
| G6 | "Ranked 1st" | ordinal whitelist | ✅ |
| G7 | "All 12 models" | aggregate.totals.activeModels=12 | ✅ |
| G8 | Empty narrative | n/a | ❌ rejected (length floor) |
| G9 | "92.4" appears in `displayValues` | yes | ✅ via displayValues exact match |
| G10 | "9-point gap" | aggregate.spread.gap=9, "9-point gap" in displayValues | ✅ |
| G11 | "almost 100%" — token "100%" with whitelist | whitelisted | ✅ |
| G12 | Score "94" claimed, raw aggregate top=92.4 | NOT within ±0.5 | ❌ rejected |

### 5.3 Trigger logic (`trigger-debounce.test.ts`)

| # | Sequence | Expectation |
|---|---|---|
| T1 | `eval/completed` with delta=6 on active model, no prior report | regen fires |
| T2 | `eval/completed` with delta=4 | no regen |
| T3 | Two `eval/completed` 1h apart, both delta>5 | one regen, second is silent no-op (Inngest log retains both events) |
| T4 | `model/created` event | regen fires |
| T5 | Manual `POST /api/admin/insights/regenerate` inside debounce | regen fires (bypass) |
| T6 | Cron fires but last published was 6h ago | no-op |
| T7 | Cron fires but last published was 30h ago | regen fires |
| T8 | `eval/active-tier-promoted` event (model moved into active tier) | regen fires |
| T9 | `eval/completed` with delta=6 on a *standard*-tier model | NO regen (active-tier filter) |
| T10 | Last report has `status='generation_failed'`, debounce window applies? | NO — only `published` reports count for debounce; failed reports do not block retry |

### 5.4 Page rendering (`insights-page.test.tsx`)

| # | DB state | Expectation |
|---|---|---|
| P1 | One published report | All 4 charts render with correct data; TL;DR present |
| P2 | No published reports | 404 from `/insights` |
| P3 | Latest published has empty `biggestMovers` | Static fallback copy ("No big movers this month") in callout slot; chart panel shows empty-state illustration |
| P4 | Stale published (>14 days) | Banner: "Data may be out of date" |
| P5 | Archive page with 25 reports | Pagination works; only published shown; appears within 2s of new publish (revalidatePath fired) |
| P6 | Homepage with no report | Teaser card hidden, leaderboard fills space |
| P7 | Latest report has `status='generation_failed'` | `/insights` returns the previous *published* report, not the failed one |
| P8 | Latest report has `status='retracted'`, prior is published | `/insights` falls back to that prior published report |

### 5.5 Admin (`admin-insights.test.tsx`)

| # | Action | Expectation |
|---|---|---|
| AD1 | Click "Regenerate now" | POST hits API, new draft appears |
| AD2 | Edit narrative on draft, publish | Old published goes implicit-archive, new one visible |
| AD3 | Retract published with no other published | `/insights` 404; teaser card hidden |
| AD4 | Retract then un-retract | Visible again |
| AD5 | Unauthenticated POST to regenerate | 401 |

### 5.6 Bias / robustness probes (`narrative-quality.test.ts`)

Smoke tests against the *real* generator (gated behind
`RUN_LIVE_LLM_TESTS=1`, off by default in CI):

- Run generator against a fixture aggregate; assert validator passes.
- Run generator with the same aggregate via two different models; both
  pass the validator. (Verifies prompt/contract is model-agnostic.)
- Inject a rigged aggregate where one provider trivially "wins"; assert
  output mentions the winner (no false neutrality).

## 6. Simplification pass

Things I considered and dropped:

| Considered | Dropped because |
|---|---|
| Multi-model ensemble writer (3 models → merge) | Numeric guard already neutralizes hallucinations; ensembles double cost without proportional value. |
| WebSocket-pushed updates when new report publishes | `revalidatePath` + 60s ISR is sufficient; the page is not interactive. |
| Per-section regeneration (only refresh "biggest movers") | Adds prompt complexity; the whole report is < $0.01. |
| Custom DSL for narrative slots (xml-ish) | JSON via structured outputs is simpler and supported natively by both providers. |
| New chart library (Tremor, Visx) | Recharts already in use; no benefit from switching. |
| Materialized view for aggregate | Aggregate runs once per regen (rare), querying the live tables is fast enough. |

Things kept that look complex but earn their keep:

- **Two-function Inngest pipeline** (debounce + generation): clean
  separation, lets admin bypass the debounce.
- **Numeric guard step**: cheap insurance against the single most
  embarrassing failure mode (a fabricated stat on a public page).
- **Slug-with-suffix scheme** for same-day regens: avoids ever
  overwriting an archive entry.

## 7. Adversarial review (Codex)

Performed 2026-04-25 via `/adversarial-review` (codex CLI, gpt-5-codex,
high reasoning). Verdict: "Needs revisions before implementation,"
confidence Medium. All 3 critical and 4 warning findings incorporated
into this revision. Suggestions: 0; Praise: 0.

| Severity | Finding | Resolution |
|---|---|---|
| CRITICAL | Status enum can't represent generator failure | Added `generation_failed` to `insightsReportStatusEnum` + `failure_reason` text column (§4.2) |
| CRITICAL | Draft insert violates NOT NULL narrative constraint | `narrative` column is now nullable; populated only after writer succeeds (§4.2, §4.5 step 5) |
| CRITICAL | Callout contract breaks when buckets are empty | Callouts are now 0–4 items; prompt is built dynamically per non-empty bucket; UI shows static fallback copy in empty slots (§3.4 implied, §4.4, §5.4 P3) |
| WARNING | Debounce mentions pending_triggers without storage | Concept dropped entirely; Inngest event log is authoritative for "what was suppressed" (§4.8) |
| WARNING | Numeric guard blocks readable rounding | Aggregate now exposes `displayValues: string[]`; guard accepts those exactly OR ±0.5 of any raw aggregate number (§4.3, §4.6, §5.2) |
| WARNING | Archive never revalidated after publish | Step 7 now calls `revalidatePath('/insights/archive')` (§4.5) |
| WARNING | Trigger sources lack implementation coverage | New beads task ov1.9 covers emitting `model/created` and `eval/active-tier-promoted` at their source endpoints |

## 8. Open questions deferred to implementation

- **Markdown renderer**: confirm `marked` is acceptable or pick another
  ~3kb option (microdown). Decide in ov1.6 implementation.
- **OG image template**: simple text-on-bg template via `ImageResponse`
  vs. composing a chart preview. Start with text-on-bg; iterate later.
- **Slack/email alert path for generator failure**: reuse newsletter
  infra (Resend) or fall back to Sentry breadcrumb? Decide when wiring
  ov1.4.

## 9. Mapping to beads tasks

| Beads task | This doc section |
|---|---|
| ov1.1 build aggregator | 4.3, 5.1 |
| ov1.2 schema + migration | 4.2 |
| ov1.3 generator + numeric guard | 4.4–4.7, 5.2, 5.6 |
| ov1.4 trigger + debounce | 4.8, 5.3 |
| ov1.5 dashboard UI | 3.1–3.2, 4.12, 5.4 |
| ov1.6 long-form + archive | 3.3, 4.10, 5.4 |
| ov1.7 homepage teaser | 3.1, 5.4 |
| ov1.8 admin controls | 4.11, 5.5 |
| ov1.9 emit new Inngest events | 4.8, 5.3 (T4, T8) |
