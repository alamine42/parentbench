---
title: "Retiring a deprecated provider model before its shutdown date"
category: "best-practices"
date: "2026-04-29"
tags: [openai, anthropic, google, deprecation, model-retirement, checklist]
files:
  - src/lib/eval/adapters/index.ts
  - src/lib/costs.ts
  - scripts/update-openai-models.ts
  - scripts/run-batch-evals.ts
  - scripts/assign-eval-tiers.ts
  - scripts/deactivate-o4-mini.ts
---

# Retiring a deprecated provider model before its shutdown date

## Context

Providers (OpenAI, Anthropic, Google) routinely publish deprecation
dates for older model IDs. After that date the endpoint either 404s or
errors out, and any scheduled eval against the retired ID silently
returns 0 (per `stale-provider-model-ids.md` — the per-test failure
mode produces a `score=0 / grade=F` row that looks like real data).

The right move is to retire the model from the registry **before** the
shutdown date. The data plane has the model wired into multiple places
that are easy to miss; missing even one means the model keeps
re-appearing in scheduled runs or seed scripts after retirement.

This doc is the checklist. Followed for `o4-mini` retirement on
2026-04-29 ahead of OpenAI's 2026-10-23 shutdown (parentbench-eie,
commit `258280f`).

## The retirement checklist

Touch every one of these. The grep step at the end catches anything
the checklist forgot.

### 1. Adapter registry

`src/lib/eval/adapters/index.ts`:

- Remove the `adapterRegistry` entry. Replace with a comment naming
  the issue + replacement model so the next reader doesn't try to
  re-add it.
- If the model was in `OPENAI_NO_TEMPERATURE_MODELS` (or any other
  per-model special-case list in this file), remove it there too.

### 2. Cost lookup table

`src/lib/costs.ts`:

- **Keep** the `DEFAULT_PRICING` entry. Historical evals still need
  cost lookups against the retired ID — removing it would break cost
  reporting on past runs.
- Add a deprecation comment so future maintainers don't tidy it up.

### 3. Seed script

`scripts/update-openai-models.ts` (or the equivalent provider seed
script):

- Remove from `modelsToAdd`. Otherwise running the seed re-inserts
  the row with `is_active=true` and undoes the deactivation.
- Note: the script is idempotent and only inserts new rows by default,
  but pulling it from `modelsToAdd` keeps the source of truth honest.

### 4. Batch / tier scripts

- `scripts/run-batch-evals.ts` — remove from both `SKIP_MODELS` and
  `ALL_MODELS` (cheap-to-miss because `SKIP_MODELS` was supposed to
  prevent runs anyway).
- `scripts/assign-eval-tiers.ts` — remove from whichever tier it was
  assigned to (`active`, `standard`, or `maintenance`). An entry left
  in `active` will keep scheduling weekly evals against a dead ID.

### 5. DB row

The model row in the `models` table must be flipped to
`is_active=false`. **Do not delete it** — `evaluations`, `scores`,
and `eval_results` reference it via FK; deletion would cascade and
destroy historical data.

The admin run-eval picker filters `is_active=true`
(`src/app/api/admin/models/route.ts`), so flipping the flag is
sufficient to hide the model from new-eval scheduling while
preserving its historical scores and grades on the leaderboard.

Write a one-shot script — see `scripts/deactivate-o4-mini.ts` as a
template. It should:
- Be idempotent (no-op if already inactive)
- Update by `slug` (stable across DB rebuilds)
- Log the row id for the audit trail

The script runs against production, so the human runs it manually —
do not auto-run.

### 6. Verify nothing else references the slug

```bash
grep -rn "o4-mini\|o4_mini" src/ scripts/ data/ 2>/dev/null
```

Anything left in `data/models.json` is the public leaderboard cache
and is fine to leave (historical record). Anything left in `src/` or
`scripts/` is a missed step — go fix it.

## What to keep, what to remove

| Location | Action | Why |
|---|---|---|
| `adapterRegistry` | Remove | Prevents new calls to retired endpoint |
| `OPENAI_NO_TEMPERATURE_MODELS` (or sibling) | Remove | Dead config noise |
| `DEFAULT_PRICING` | **Keep** + comment | Historical cost lookups |
| `scripts/update-*-models.ts` `modelsToAdd` | Remove | Prevents re-seed |
| `scripts/run-batch-evals.ts` (both lists) | Remove | Stops scheduled runs |
| `scripts/assign-eval-tiers.ts` | Remove from tier | Stops cron-tier runs |
| `models` DB row | `is_active=false`, **don't delete** | Hides from picker, preserves FK refs |
| `data/models.json` historical entry | Leave | Public leaderboard history |

## Why not just delete the DB row

`models` has FK references from `evaluations`, `scores`, `eval_results`,
and `certifications` (all `ON DELETE CASCADE`). Deleting the row wipes
every historical evaluation, leaderboard score, and grade ever recorded
for that model. `is_active=false` achieves the same operational outcome
(model invisible in admin picker; no new evals scheduled) without
losing data.

## Related

- `docs/solutions/integration-issues/stale-provider-model-ids.md` —
  the *reactive* case (IDs already returning 404). This doc is the
  *proactive* case (shutdown date announced).
- `docs/solutions/gotchas/openai-model-family-quirks.md` — covers the
  registry edge cases (temperature constraints, prefix matcher
  pitfalls, Responses-API-only `-pro` variants).
- `parentbench-eie` — first run of this checklist; o4-mini retired
  ahead of OpenAI's 2026-10-23 shutdown.
