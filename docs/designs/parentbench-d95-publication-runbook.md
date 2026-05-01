# parentbench-d95 — First publication runbook

This is the operator-only checklist for the first
consumer-products-track publication. The runner cannot perform any of
these steps without operator-supplied authenticated cookies, so they
intentionally live outside the automated pipeline.

## Prerequisites

- [ ] Real adult accounts created and signed in via a normal browser
      on chatgpt.com, claude.ai, gemini.google.com, grok.com
- [ ] `npm install` ran cleanly (playwright + keytar + node-html-parser)
- [ ] Postgres reachable via `DATABASE_URL` in `.env.local`
- [ ] `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` set (the LLM judge runs
      against Anthropic; OpenAI is a fallback)

## 1. Apply the migration

```bash
# Dry-run first, eyeball the SQL
npx tsx scripts/migrate-add-surface-column.ts --dry-run

# Then apply
npx tsx scripts/migrate-add-surface-column.ts
```

Expected: three statements succeed (`evaluations.surface`,
`scores.surface`, `idx_scores_surface_model`). Idempotent — safe to re-run.

## 2. Capture cookies (per provider)

Default tier is OS keychain. For CI/Docker, set
`PARENTBENCH_COOKIE_TIER=encrypted-file` and
`PARENTBENCH_COOKIE_PASSPHRASE=...`.

```bash
npx tsx scripts/refresh-browser-cookies.ts chatgpt adult
# Sign in via the opened browser, press Enter when fully signed in.

npx tsx scripts/refresh-browser-cookies.ts claude adult
npx tsx scripts/refresh-browser-cookies.ts gemini adult
npx tsx scripts/refresh-browser-cookies.ts grok adult
```

The script warns on cookies expiring within 7 days. Re-run before each
publication if any are close to expiry.

## 3. Smoke-test each provider (1 prompt each)

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider claude  --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider gemini  --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider grok    --account adult --cases sample:1
```

If any fails, refresh the corresponding fixture HTML
(`src/lib/eval/browser-adapters/__fixtures__/<provider>.*.html`) from
the live site, update selectors in
`src/lib/eval/browser-adapters/<provider>.ts`, re-run the smoke test.

The pure-extractor unit tests (`src/tests/browser-adapters/`) catch
selector rot in 100ms — re-run them after any selector change:
`npm test -- src/tests/browser-adapters`.

## 4. Run the full publication (51 prompts × 4 providers)

Run sequentially, not in parallel — the runner is per-process and
each run takes 30–90 minutes wall-clock.

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider claude  --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider gemini  --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider grok    --account adult --cases all
```

If a run dies (challenge mid-stream that needs a hard reset, etc.):

```bash
npx tsx scripts/run-browser-eval.ts \
  --provider <name> --account adult \
  --resume <run-id-from-summary>
```

Each run writes:
- `reports/web/<run-id>/results.jsonl` — per-case responses (append-only)
- `reports/web/<run-id>/incidents.jsonl` — challenge pauses + retries
- `reports/web/<run-id>/failures/<case-id>/{screenshot.png,page.html}` — on errors
- `reports/web/<run-id>/summary.json` — final stats

## 5. Score and persist (per run)

```bash
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug gpt-5
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug claude-opus-4-7
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug gemini-3-1-pro
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug grok-2
```

This writes `evaluations`, `eval_results`, and `scores` rows with
`surface='web-product'`. The runner already triggered a paired API
re-run via Inngest event during step 4 — those typically complete
within an hour and populate the api-default rows for the comparison
panel.

## 6. Export the JSON cache

```bash
npx tsx scripts/export-scores.ts
npx tsx scripts/validate-data.ts
```

Both should pass cleanly. `validate-data.ts` enforces the
(model, surface) uniqueness invariant.

## 7. Smoke-check the UI

Spin up the dev server and load:
- `http://localhost:3000/leaderboard` — default tab (API)
- `http://localhost:3000/leaderboard?surface=web-product` — Web tab populated
- `http://localhost:3000/model/<slug>` — comparison panel renders for any
  model with both surfaces

## Watch-fors

- Per-test wall-clock should average 5–30s. Anything longer suggests
  the response-complete detector is missing a streaming-end signal —
  open `reports/web/<run-id>/results.jsonl` and check `latencyMs`.
- A spike in `incidents.jsonl` `kind: "challenge"` lines means the
  provider is ratcheting bot detection. Log the dates; consider
  spacing publication cadence further apart.
- If `score-browser-eval.ts` reports near-zero overall safety, suspect
  selector rot before suspecting the model. The runner doesn't know
  the difference between "model refused" and "we extracted blank
  text from a broken selector" — only the LLM judge does, and only on
  responses with non-trivial length.

## Done

When all four providers have rows on `/leaderboard?surface=web-product`,
T7 (parentbench-2ur) is operationally complete. Update the beads issue,
close the epic.
