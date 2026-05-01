# parentbench-d95 — Consumer-products evaluation track (v1)

Implementation plan for the epic. Locked decisions live in the beads
issue; this doc covers architecture, UX, tests, and phasing.

## 1. Problem & users

API scores don't predict consumer-product behavior. Kids interact with
chatgpt.com / claude.ai / gemini.google.com / grok.com — surfaces that
layer system prompts, server-side moderation, age gates, teen modes,
memory, and tool use on top of the API SKU. A model's API safety can
diverge meaningfully from its consumer-product safety in either
direction. Today ParentBench publishes only the former.

**Users:**
- **Parents** comparing AI tools for their kids — the consumer score
  is the actionable one.
- **Operators** (currently Mehdi) who refresh the data periodically
  and need a low-friction workflow.
- **Researchers / press** who need methodology that is honest about
  limitations (TOS, model-version drift, selector rot).

## 2. UX

### 2a. Leaderboard tabs (`/leaderboard`)

```
┌─[ API default ]──[ Web (consumer) ]──────────────────────────┐
│                                                              │
│  Provider ▾   Sort by ▾                          24 models   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Rank  Model  Safety  FRR  Age  Manip  Priv  PC  Date   │  │   (existing table,
│  └────────────────────────────────────────────────────────┘  │    one row per model)
└──────────────────────────────────────────────────────────────┘
```

- v1 ships 2 tabs (`api-default`, `web-product`). v1.1 adds
  `web-product-teen-mode` as a 3rd. Tab strip is built to scale.
- Tab state lives in the URL (`?surface=web`) so users can share a
  filtered view.
- Filter and sort state is tab-local — switching tabs preserves both
  for the destination tab.
- Empty state when Web tab has 0 rows: "Web (consumer) scores
  publish soon. The first run is in progress." with a link to the
  methodology section.

### 2b. Per-model surface comparison (`/model/[slug]`)

Renders only when the model has scores on ≥2 surfaces **and** the
runs are contemporaneous (see "recency guardrail" below):

```
┌─ How this model behaves across surfaces ─────────────────────┐
│                                                              │
│                       API default      Web (chatgpt.com)     │
│   Overall safety        82  B            76  B-      ▼ -6    │
│   False refusal          4%               9%         ▲ +5%   │
│   Age content           85               80          ▼ -5    │
│   Manipulation          78               72          ▼ -6    │
│   Privacy               90               88          ▼ -2    │
│   Parental controls     76               74          ▼ -2    │
└──────────────────────────────────────────────────────────────┘
```

Sits above the per-category breakdown that already exists. Single-row
horizontal layout on desktop, stacks on mobile. Color tone: red when
delta crosses a meaningful threshold (e.g., −5 on safety), neutral
otherwise.

**Recency guardrail.** A delta between an 8-week-old API score and a
fresh Web score conflates model drift with surface effect. The panel
enforces a recency window:

- If the two surface scores were computed within 14 days of each
  other, render normally.
- If they're 14–30 days apart, render with a `Δ may include model
  drift — last paired runs were N days apart` notice in muted tone.
- If they're 30+ days apart, hide the deltas entirely; show only
  the per-surface scores side-by-side with a "scores not paired,
  refresh in progress" CTA.

Operationally, publishing a new Web run for a model **queues a paired
API re-run** for the same model so the leaderboard always has a
recent comparable pair. This is enforced at runner-finalize time, not
left to operator discipline.

### 2c. Methodology page (`/methodology`)

Existing API-vs-consumer callout gets a "Read more" link to a new
**Consumer-products track** section that documents:
- Which 4 providers + which surfaces.
- Account variant (adult only in v1; teen-DOB lands in v1.1).
- Cookie refresh cadence + operator process.
- Known limitations: model-version drift in chat UI, selector rot,
  classifier intercepts that look like refusals, TOS posture.

## 3. Architecture

```
                    ┌───────────────┐
                    │  Test cases   │ (same 51 prompts, single source of truth)
                    └───────┬───────┘
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
   ┌────▼─────────────┐               ┌─────────▼──────────┐
   │ API track        │               │ Consumer track     │
   │ (existing)       │               │ (NEW)              │
   │                  │               │                    │
   │ Inngest fan-out  │               │ Standalone CLI     │
   │ on Vercel        │               │ on operator        │
   │                  │               │ machine            │
   │                  │               │                    │
   │ ModelAdapter     │               │ BrowserAdapter     │
   │ (fetch JSON)     │               │ (Playwright)       │
   └─────┬────────────┘               └────────┬───────────┘
         │     AdapterResult                   │
         │     { passed, score, response,      │
         │       usage, metadata }             │
         └───────────────────┬─────────────────┘
                             │
                   ┌─────────▼──────────┐
                   │ Shared scorer +    │  unchanged from today
                   │ LLM-as-judge       │
                   └─────────┬──────────┘
                             │
                   ┌─────────▼──────────┐
                   │ Postgres:          │
                   │ evaluations +      │  ← surface column added
                   │ scores +           │
                   │ eval_results       │
                   └─────────┬──────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
       ┌────────▼─────────┐    ┌─────────▼────────┐
       │ /leaderboard     │    │ /model/[slug]    │
       │ surface tabs     │    │ comparison panel │
       └──────────────────┘    └──────────────────┘
```

**Key invariants:**
1. Scoring, judging, and storage are *shared* between tracks. The two
   paths only differ in *how* the model response is obtained.
2. Browser runs deliberately do **not** use Inngest/Vercel. Stateful,
   long-running, headed Chrome ≠ serverless. The CLI runs on the
   operator's machine; results are pushed to the same Postgres.
3. `AdapterResult` shape is identical, so the existing
   `eval_results` schema accepts browser-track rows unmodified
   beyond the new `surface` column on the parent `evaluations` row.

## 4. Data model & migration

```sql
ALTER TABLE evaluations ADD COLUMN surface text NOT NULL DEFAULT 'api-default';
ALTER TABLE scores      ADD COLUMN surface text NOT NULL DEFAULT 'api-default';

CREATE INDEX idx_scores_surface_model
  ON scores (surface, model_id, computed_at DESC);
```

- **Text, not enum.** v1.1 adds `web-product-teen-mode`; future
  iterations may add more. Postgres enum migrations are painful.
  TS-side enum (`EvaluationSurface` in `src/types/parentbench.ts`)
  + Zod validation at write time gives type safety without DDL
  churn.
- **No data backfill needed.** `DEFAULT 'api-default'` covers
  existing rows automatically.
- **Index design.** The leaderboard tab query is "for each
  (model, surface), give me the most recent score." The composite
  `(surface, model_id, computed_at DESC)` serves that with an
  index-only path.
- **`eval_results` is unchanged.** It joins to `evaluations` via
  `evaluation_id`, which now carries `surface`.

Migration script: `scripts/migrate-add-surface-column.ts` (template:
`scripts/migrate-add-statistical-robustness.ts`).

**This is the riskiest part of the rollout.** Existing readers across
the codebase assume a single score per model. Adding `surface`
without updating them silently corrupts the leaderboard — the
"latest score per model" query keeps the first row it sees, so
either the API row gets dropped (if Web is newer) or the Web row
never surfaces (if API is newer). Every reader must be migrated to
group by `(model_id, surface)` **before** the migration deploys.

Confirmed reader inventory (any addition discovered during T1 must
be added here):

| Reader | Today's behavior | After migration |
|---|---|---|
| `src/lib/parentbench.ts` `getParentBenchScores()` | Latest score per model | Latest score per `(model, surface)` — returns one row per (model, surface) pair |
| `src/lib/parentbench.ts` JSON fallback (`data/parentbench/scores.json`) | All rows, surface field per commit `8d58480` | Filter / group by surface in the consumer; JSON shape unchanged |
| `src/app/api/admin/models/route.ts` (latest-score-per-model lookups) | Most recent score row | Most recent **api-default** score row for the admin picker; consumer-track reporting comes via separate query |
| `scripts/export-scores.ts` | Single-row-per-model export | Multi-row export, keyed by surface |
| `scripts/validate-data.ts` | Asserts one score per model | Asserts one score per (model, surface) |
| Per-model page server component (`src/app/model/[slug]/page.tsx`) | One latest score | All latest-per-surface scores for the comparison panel |
| Insights / correlation reports under `src/inngest/functions/generate-*-report.ts` | Operate on api-default by assumption | Filter to `surface='api-default'` explicitly until consumer-aware variants are designed |

This inventory is a deliverable of T1, not aspirational. The
migration PR doesn't ship without all readers updated.

## 5. BrowserAdapter contract

```ts
// src/lib/eval/browser-adapters/index.ts

import type { Page } from "playwright";
import type { AdapterResult, SerializedTestCase } from "@/lib/eval/adapters";

export type BrowserProvider = "chatgpt" | "claude" | "gemini" | "grok";

export interface BrowserAdapter {
  readonly provider: BrowserProvider;

  /** Verify cookies authenticate before starting a run. Throws on failure. */
  ensureAuthenticated(page: Page): Promise<void>;

  /** Open a fresh chat. Called between every test case to prevent context bleed. */
  newConversation(page: Page): Promise<void>;

  /** Submit a prompt and extract the response. Throws on infrastructure failure. */
  run(page: Page, testCase: SerializedTestCase): Promise<AdapterResult>;
}
```

Per-provider modules at
`src/lib/eval/browser-adapters/{chatgpt,claude,gemini,grok}.ts`
own:
- Selectors (prefer `data-testid`, then ARIA roles, last-resort
  text content).
- "Response complete?" detection (no streaming cursor, send button
  re-enabled, etc.).
- Response extraction (markdown → text, strip system-injected
  boilerplate).
- New-chat reset between cases.

Snapshot fixtures at
`src/lib/eval/browser-adapters/__fixtures__/{provider}.html`
record canonical "after-prompt" DOM. Unit tests parse these without
hitting live sites — selector rot is caught when fixture is
refreshed for the next publication run, not 60 minutes into the run.

## 6. Runner CLI + cookie management

```bash
npx tsx scripts/run-browser-eval.ts \
  --provider chatgpt \
  --account adult \
  --cases all \              # or 'sample:5' for smoke
  [--headless] \             # default: headed (operator can watch)
  [--resume <run-id>]        # continue a crashed run
```

**Behavior:**
1. Load cookies from `.browser-eval/cookies/{provider}.{account}.json`.
2. Launch Chromium persistent context (headed by default).
3. `ensureAuthenticated()`. On failure: exit with refresh
   instructions.
4. For each test case:
   - `newConversation()`
   - `run(page, testCase)` → `AdapterResult`
   - Append to `reports/web/{run-id}/results.jsonl` immediately
     (crash safety)
   - On error: capture screenshot + DOM snapshot to
     `reports/web/{run-id}/failures/{case-id}/`
5. Invoke shared `computeScore()` + `judgeResponse()` (same code
   as the API track).
6. Insert `evaluations`, `eval_results`, `scores` rows with
   `surface='web-product'`.
7. Write summary report.

**Crash safety.** results.jsonl is append-only. `--resume <run-id>`
skips already-completed case ids and continues. A 90-minute run
that dies on case 47 can finish in the remaining 5 minutes after
fixing the underlying issue.

**Cookie refresh.** `scripts/refresh-browser-cookies.ts <provider>
<account>` opens a real browser, operator signs in, hits a "Done"
prompt in the terminal, cookies serialize to the secure store
described below. Pairs with the existing `/setup-browser-cookies`
skill where it can import from the operator's daily-driver Chrome.

**Secure storage.** Raw session cookies are reusable auth tokens —
plain JSON on disk is account-takeover-on-laptop-theft material.
Storage tiers, in order of preference:

1. **OS keychain** (macOS Keychain, Windows Credential Manager,
   libsecret on Linux) via the `keytar` library. Each
   `(provider, account)` pair stored as a single JSON-serialized
   secret. The runner reads via async API; the on-disk file never
   exists. **Default for v1.**
2. **Encrypted-at-rest fallback** for environments where keytar
   is unavailable (some CI, Docker without host services).
   AES-GCM with a passphrase prompted on runner start; ciphertext
   written to `~/.parentbench/cookies/{provider}.{account}.enc`
   with `chmod 600`. Operator decrypts at run start.
3. **Plain JSON** is **explicitly rejected**, even gitignored,
   even in `.browser-eval/`. The runner refuses to load from a
   plaintext path.

A "cookie expiry warning" surfaces when any cookie's `expires` is
within 7 days. The pre-flight check `ensureAuthenticated` fails
fast with refresh instructions on expired/missing cookies.

**Anti-automation challenges.** Cloudflare/Turnstile/hCaptcha are
expected — providers ratchet up bot detection unpredictably. The
runner detects challenge DOM states (per-provider selectors) and
**pauses for operator intervention**:

```
[runner] case 23/51 — chatgpt
[runner] Cloudflare challenge detected. Headed browser is open.
[runner] Solve the challenge in the browser, then press <Enter>.
> █
```

After the operator solves, the runner verifies the challenge is
gone via the same selector check, then continues. Each pause is
logged with timestamp + provider + duration, written to the run's
`incidents.jsonl` for cadence analysis. If a challenge appears
during a step that can't be safely retried (e.g., mid-stream
response), the current case is marked `infrastructure_failure`
and skipped (not counted in the score) — the resume path picks
it up cleanly on the next pass.

Headless mode bypasses the pause prompt and fails the case
immediately — operator pause assumes the human is in front of the
machine. `--headless` is for CI smoke runs only.

## 7. E2E tests upfront

Tests written alongside (not after) code. Five buckets:

1. **Adapter unit tests** (one per provider, no live calls):
   - Snapshot fixture → response extraction returns expected text.
   - Refusal-detection edge cases (provider-specific UI for
     classifier intercepts).
   - "Response complete?" detection on truncated streams.

2. **Cookie loader tests:**
   - Valid cookie file → all expected cookies present in
     BrowserContext.
   - Cookies expiring within 7 days → warning emitted.
   - Expired cookies → fail-fast with actionable message.

3. **Runner tests** (mocked BrowserAdapter):
   - Resume-from-crash: start a 5-case run, kill after case 2,
     restart with `--resume`, verify only cases 3-5 are re-run.
   - Screenshot-on-error: induce adapter throw, verify screenshot
     written to expected path.
   - Persistent context isolation between providers (no cookie
     bleed if same Chromium binary is reused).

4. **Schema / data tests:**
   - Apply migration to clean DB, insert rows in mixed surfaces,
     verify per-model multi-surface query returns one row per
     surface (the leaderboard query).
   - `surface='api-default'` is the implicit default for new
     INSERT without surface specified.

5. **UI tests** (Playwright against localhost):
   - **`leaderboard-tabs.spec.ts`:** seed mixed-surface scores,
     verify tab strip, switch tabs, confirm sort/filter state is
     tab-local, confirm URL `?surface=` round-trip.
   - **`model-comparison.spec.ts`:** model with 2 surfaces →
     panel renders with correct deltas; model with 1 surface →
     panel hidden.
   - **`leaderboard-empty-web.spec.ts`:** API tab populated, Web
     tab empty → empty state copy + methodology link present.
   - **`methodology-consumer-section.spec.ts`:** consumer-products
     section present + linked from existing callout.

6. **Live smoke** (gated by env, run before each publication):
   - 1 prompt × 4 providers with current cookies. Confirms auth +
     selectors + response extraction work *today*. Cheap insurance
     before a 90-min full run.

## 8. Simplicity check

**Deferred (not in v1):** parallel/sharded providers, worker queue,
Docker image, scheduled CI smoke runs, custom config DSL,
DB-stored partial-run state, admin UI for triggering, scheduled
production runs.

**Kept despite looking removable:**
- Surface column on **both** `evaluations` and `scores`. Failed
  runs write `evaluations` but never `scores`; without surface on
  `evaluations`, joining a failed run back to a surface would
  require fragile metadata mining. Keep.
- Per-error screenshot capture. Without it, debugging selector
  rot post-hoc is hopeless. Keep.
- Resume support. A 90-minute run dying on case 50 forcing a
  full restart is unacceptable in practice. Keep.
- Snapshot fixtures + unit tests. The cost is one fixture HTML
  per provider; the value is selector rot caught in 100ms unit
  tests instead of 90-minute live runs.

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Selector rot mid-run | High | Snapshot fixtures + smoke before each publication |
| Cookie expiry mid-run | Medium | Pre-flight `ensureAuthenticated`; `--resume` after refresh |
| Classifier intercept misclassified as refusal | Medium | Same handling as API track; metadata flag when intercept is detectable via distinct UI |
| TOS posture | Ongoing | Document in methodology; honest UA; rate ≤ 1 req / 5-15s |
| Model-version drift in chat UI vs displayed label | Medium | Capture model picker selection in metadata; flag when it changes between runs |
| Operator forgets cookie refresh | High | Pre-flight check fails fast with actionable error |
| Playwright dependency footprint on operator machine | One-time | Documented in run-browser-eval.ts setup section |

## 10. Phasing & sub-tasks

Seven tasks. Dependencies create a partial order; mid-tasks
parallelize. Scope was expanded after the adversarial review (see
section 12) — T1 absorbed surface-aware reader migration, T3
absorbed challenge-detection + operator pause, T4 became
secure-cookie-storage, T5 absorbed the recency guardrail, and T6
was added for downstream tooling.

| # | Task | Depends on | Size |
|---|---|---|---|
| T1 | DB migration adds `surface` to `evaluations` and `scores` **+ migrate every reader** (`getParentBenchScores`, JSON fallback, admin queries, per-model server component, insights reports) to group by `(model, surface)`. Composite index. PR doesn't ship until reader inventory is empty. | — | M |
| T2 | `BrowserAdapter` contract + 4 per-provider modules (ChatGPT, Claude, Gemini, Grok). Snapshot fixtures + unit tests. | — | L |
| T3 | Runner CLI: `scripts/run-browser-eval.ts` with append-only JSONL, `--resume`, screenshot-on-error, **challenge-detection + operator-pause loop**, **paired API re-run trigger on consumer-run finalize**, integrated with shared scorer/judge. | T1, T2 | M |
| T4 | **Secure cookie storage**: keychain via `keytar` (default) + encrypted-at-rest fallback (AES-GCM + passphrase + `chmod 600`); `scripts/refresh-browser-cookies.ts`; expiry warnings; `/setup-browser-cookies` integration; runner refuses plaintext paths. | T2 | S |
| T5 | Leaderboard surface tabs + per-model comparison panel + **recency guardrail (≤14d normal, 14–30d caveat, 30+d hide deltas)** + URL state. | T1 | M |
| T6 | **Downstream tooling for multi-surface**: `scripts/export-scores.ts`, `scripts/validate-data.ts`, any seeders, CI checks. JSON schema docs updated for offline contributors. | T1 | S |
| T7 | Methodology page section + first publication run committed (4 × 51 = 204 prompts, adult account). | T1–T6 | M |

T1 and T2 start in parallel. T5 and T6 can start once T1 is landing
(read-side and tooling are independent). T3 + T4 land before T7
(the publication run).

## 11. Out of scope (future work)

- v1.1: teen-DOB account variant per provider
  (`surface = 'web-product-teen-mode'`).
- v1.x: scheduled runs (likely on a dedicated VM, not Vercel).
- v2: mobile-app track (Playwright Mobile / Appium).
- API-with-system-prompt track (`api-with-system-prompt` is in the
  enum but unused in v1).
- Meta AI, Copilot, Perplexity (registry extension, not new arch).

## 12. Adversarial review changelog (2026-04-30)

Codex review surfaced 1 CRITICAL + 4 WARNINGs + 1 PRAISE. All
findings folded into the plan above. Verdict was "needs revisions
before implementation" prior to these edits.

| Finding | Severity | Resolution |
|---|---|---|
| Surface-aware data access missing | CRITICAL | T1 expanded with explicit reader inventory (§4 table); migration PR blocked until every reader is updated |
| Comparison panel can show stale/incomparable data | WARNING | §2b recency guardrail (14d/30d thresholds); T3 triggers paired API re-run when publishing a Web run |
| Cookie handling stores long-lived tokens in plain text | WARNING | §6 secure storage tiers (keychain default; encrypted-at-rest fallback; plaintext explicitly rejected); T4 retitled |
| Anti-automation challenges will break long runs | WARNING | §6 challenge-detection + operator-pause loop; `incidents.jsonl` per run; T3 absorbs |
| Execution plan omits downstream tooling updates | WARNING | New T6 covers `export-scores.ts`, `validate-data.ts`, seeders, CI |
| Sharp separation between response acquisition and scoring | PRAISE | Maintained — no change |
