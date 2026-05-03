# parentbench-d95 — First publication runbook

Operator-only checklist for the first consumer-products-track
publication. v1 covers two access modes per provider (where they exist):

- **Anonymous** — logged-out browser. Available on **ChatGPT** and **Grok**.
  Not available on Claude or Gemini (login required).
- **Signed-in** — authenticated adult account. Available on all four.

Six runs total: ChatGPT × 2 (anonymous + signed-in), Claude × 1
(signed-in only), Gemini × 1 (signed-in only), Grok × 2.

## Prerequisites

### For signed-in runs only

- [ ] **Dedicated** adult accounts created on each provider — see
      "Account hygiene" at the bottom of this doc. Do **not** use
      personal accounts; the prompts include adversarial cases that
      would pollute conversation memory and recommendation systems
      tied to your real identity.
- [ ] You're physically at the machine to handle login + 2FA + CAPTCHAs
      during cookie capture. The runner cannot do this for you.

### For all runs

- [ ] `npm install` ran cleanly (playwright + keytar + node-html-parser)
- [ ] Postgres reachable via `DATABASE_URL` in `.env.local`
- [ ] `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` set (the LLM judge runs
      against Anthropic; OpenAI is a fallback)

## 1. Apply the migration

```bash
npx tsx scripts/migrate-add-surface-column.ts --dry-run
npx tsx scripts/migrate-add-surface-column.ts
```

Expected: three statements succeed (`evaluations.surface`,
`scores.surface`, `idx_scores_surface_model`). Idempotent.

## 2. Capture cookies — signed-in runs only

Anonymous runs skip this step entirely. Default storage tier is OS
keychain; for CI/Docker, set `PARENTBENCH_COOKIE_TIER=encrypted-file`
plus `PARENTBENCH_COOKIE_PASSPHRASE=...`.

```bash
npx tsx scripts/refresh-browser-cookies.ts chatgpt adult
npx tsx scripts/refresh-browser-cookies.ts claude  adult
npx tsx scripts/refresh-browser-cookies.ts gemini  adult
npx tsx scripts/refresh-browser-cookies.ts grok    adult
```

Each opens a real browser. Sign in by hand (you'll need to handle 2FA,
any Turnstile / reCAPTCHA, age verification flows). Press Enter when
the chat composer is visible. The script warns on cookies expiring
within 7 days — re-run before each publication if anything's close.

## 3. Smoke-test (1 prompt per surface)

Anonymous runs:

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account anonymous --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider grok    --account anonymous --cases sample:1
```

Signed-in runs:

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider claude  --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider gemini  --account adult --cases sample:1
npx tsx scripts/run-browser-eval.ts --provider grok    --account adult --cases sample:1
```

If any fails, refresh the corresponding fixture HTML
(`src/lib/eval/browser-adapters/__fixtures__/<provider>.*.html`) from
the live site, update selectors in
`src/lib/eval/browser-adapters/<provider>.ts`, re-run unit tests
(`npm test -- src/tests/browser-adapters`), then re-smoke.

## 4. Run the full publication

51 prompts × 6 runs = 306 prompts. Run sequentially, not in parallel —
each run takes 30–90 minutes wall-clock.

Anonymous (no cookies needed; safe to run unattended):

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account anonymous --cases all
npx tsx scripts/run-browser-eval.ts --provider grok    --account anonymous --cases all
```

Signed-in (operator should be near the machine — challenges may pause for manual solve):

```bash
npx tsx scripts/run-browser-eval.ts --provider chatgpt --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider claude  --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider gemini  --account adult --cases all
npx tsx scripts/run-browser-eval.ts --provider grok    --account adult --cases all
```

If a run dies (challenge mid-stream, network blip, fixture rot):

```bash
npx tsx scripts/run-browser-eval.ts \
  --provider <name> --account <anonymous|adult> \
  --resume <run-id-from-summary>
```

Each run writes:
- `reports/web/<run-id>/results.jsonl` — per-case responses (append-only)
- `reports/web/<run-id>/incidents.jsonl` — challenge pauses + retries
- `reports/web/<run-id>/failures/<case-id>/{screenshot.png,page.html}` — on errors
- `reports/web/<run-id>/summary.json` — final stats

## 5. Score and persist

For each completed run, score and insert. Pass the matching `--surface`:

Anonymous runs:

```bash
npx tsx scripts/score-browser-eval.ts --run-id <chatgpt-anon-run-id> \
  --model-slug gpt-5 --surface web-product-anonymous

npx tsx scripts/score-browser-eval.ts --run-id <grok-anon-run-id> \
  --model-slug grok-2 --surface web-product-anonymous
```

Signed-in runs (default `--surface web-product`):

```bash
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug gpt-5
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug claude-opus-4-7
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug gemini-3-1-pro
npx tsx scripts/score-browser-eval.ts --run-id <run-id> --model-slug grok-2
```

This writes `evaluations`, `eval_results`, and `scores` rows with the
correct surface. The runner already triggered a paired API re-run via
Inngest during step 4 — those typically complete within an hour and
populate the api-default rows for the comparison panel.

## 6. Export the JSON cache

```bash
npx tsx scripts/export-scores.ts
npx tsx scripts/validate-data.ts
```

`validate-data.ts` enforces the (model, surface) uniqueness invariant.

## 7. Smoke-check the UI

Dev server up, load:

- `http://localhost:3000/leaderboard` — default API tab
- `http://localhost:3000/leaderboard?surface=web-product` — signed-in Web rows
- `http://localhost:3000/leaderboard?surface=web-product-anonymous` — anonymous Web rows
- `http://localhost:3000/model/<slug>` — comparison panel for models with multiple surfaces

## Watch-fors

- **Anonymous runs on ChatGPT/Grok shouldn't trigger CAPTCHAs as often** as signed-in runs — anonymous traffic is, paradoxically, less scrutinized for bot behavior than authenticated traffic on these platforms. If anonymous runs hit Cloudflare repeatedly, that's a signal worth logging.
- Per-test wall-clock should average 5–30s. Anything longer suggests the response-complete detector is missing a streaming-end signal — check `results.jsonl` `latencyMs`.
- A spike in `incidents.jsonl` `kind: "challenge"` lines means the provider is ratcheting bot detection. Log the dates; consider spacing publication cadence further apart.
- If `score-browser-eval.ts` reports near-zero overall safety, suspect selector rot before suspecting the model. The judge differentiates "model refused" from "blank extraction" only on responses of non-trivial length.

## Account hygiene (signed-in mode)

**Use dedicated benchmark accounts, not personal ones.** The 51 prompts include adversarial cases (suicide, self-harm framing, manipulation pressure, jailbreaks). These pollute:

- ChatGPT memory (saved snippets resurface in your real conversations)
- Gemini → Google account-wide signals (Search, YouTube, Maps personalization)
- Grok → X profile (ad targeting, recommendations)
- Claude — fewer public signals but Projects feature could pick up content

Provider TOS exposure also lands on whichever account you used. Worst case: permanent ban on the account that runs the benchmark. Don't let that be your real account.

Suggested naming: `parentbench-eval-adult-{provider}@<your-domain>`. Use an adult DOB (>18). Document credentials in your password manager. **Do not use these accounts for anything except benchmark runs** — every other interaction adds memory state that could skew the next publication.

## Done

When all configured surfaces have rows visible on the leaderboard,
T7 (`parentbench-2ur`) is operationally complete. Update the beads
issue, close the epic.
