# Freezing and unfreezing parentbench.ai

**Status:** Active runbook. Site has been frozen as of 2026-05-17.
**Trigger:** Neon free-tier compute exhausted; decision to pause the
project rather than upgrade.

## What "frozen" means

When `FROZEN=1` is set in the deployment environment:

- **Public pages** (`/`, `/leaderboard`, `/insights*`, `/model/[slug]`,
  `/reports/[modelSlug]`, `/test-cases`, `/compare`, `/methodology/*`,
  `/verify/[reportId]`) render from `src/data/snapshot/*.json` instead
  of Postgres. No DB query is issued at runtime.
- **Write endpoints** (`/api/admin/*`, `/api/submissions`,
  `/api/newsletter`, `/api/inngest`) return HTTP 503 with a JSON body
  `{ "frozen": true, ... }`. Middleware gates these — see
  `src/middleware.ts`.
- **Admin pages** (`/admin/*`) and the public submission form
  (`/report`) redirect to `/`.
- **Inngest function registry** is empty (`src/inngest/functions/index.ts`)
  so no crons fire and no event handlers can run.
- **Score history charts** collapse to a single entry per model — the
  snapshot stores latest-per-(model, surface), not history. Cert
  verification (`/verify/[reportId]`) only validates against the
  snapshotted score, not historical evaluations.

The code paths for everything DB-backed remain in the tree — freezing
is an env-flag operation, not a refactor. Unfreeze is the inverse.

## Freezing procedure

1. **Refresh the snapshot from live DB.** Requires DB capacity, so do
   this *before* you hit the Neon quota or right after a monthly
   reset.
   ```bash
   FROZEN=0 npx tsx scripts/freeze-snapshot.ts
   ```
   Writes JSON files under `src/data/snapshot/`. The script refuses to
   run with `FROZEN=1` set (would be circular).

2. **Commit the snapshot.**
   ```bash
   git add src/data/snapshot/
   git commit -m "data(snapshot): freeze snapshot for $(date +%F)"
   git push
   ```

3. **Set `FROZEN=1` AND `NEXT_PUBLIC_FROZEN=1` in Vercel.** Both
   variables are needed: `FROZEN` is read by server-side data loaders
   and middleware; `NEXT_PUBLIC_FROZEN` is inlined into the client
   bundle and hides write-related UI (e.g. footer newsletter signup,
   homepage "subscribe" card flips to a frozen notice). Trigger a
   redeploy so the build picks both up.

4. **Verify on the deployed site:**
   - `curl -i https://parentbench.ai/api/admin/evaluations` → expect
     `503` with `{"frozen": true, ...}`.
   - `curl -i https://parentbench.ai/api/submissions` → expect `503`.
   - Open `/leaderboard` in a browser — should render the snapshotted
     leaderboard. The header shows the snapshot date from
     `meta.json`.
   - Open `/admin` — should `307` redirect to `/`.

5. **Pause the Neon project** in the Neon dashboard
   (https://console.neon.tech/). With the site no longer querying it,
   compute usage drops to zero. Optionally delete the project after
   confirming the snapshot serves correctly for several days — keep
   the Dolt-backed Beads task tracker (`.beads/`) regardless; it's
   filesystem-only.

6. **Pause the Inngest app** in the Inngest cloud dashboard
   (https://app.inngest.com/). The middleware blocks
   `/api/inngest` so deliveries fail at the edge, but pausing the app
   stops the noise.

## Unfreezing procedure

1. **Unpause Neon** in the dashboard. Confirm the connection string
   still matches `DATABASE_URL` in Vercel.
2. **Set `FROZEN=0` and `NEXT_PUBLIC_FROZEN=0`** (or remove both) in
   Vercel env vars. Redeploy.
3. **Re-sync Inngest** so cron functions register:
   ```bash
   curl -s -X PUT https://parentbench.ai/api/inngest
   ```
   Response should include `"modified": true`. (See the persistent
   memory `after-every-vercel-deploy-that-touches-src-inngest`.)
4. **Unpause the Inngest app** in the cloud dashboard.
5. **Verify:**
   - `/api/admin/evaluations` requires auth, returns 200 with admin
     cookie.
   - Run a one-off eval from `/admin/evaluations/new` and confirm
     a score row lands.

## Files changed by freeze mode

Search for `FROZEN` in the codebase — every gated read path is
marked. Key files:

- `src/lib/freeze.ts` — flag + snapshot loaders + types
- `src/middleware.ts` — write-route gate
- `src/lib/parentbench.ts`, `src/lib/db-loaders.ts`, `src/db/queries/models.ts`
  — data loader branches
- `src/components/insights/homepage-teaser.tsx`
- `src/app/insights/page.tsx`, `src/app/insights/[slug]/page.tsx`,
  `src/app/insights/archive/page.tsx`
- `src/app/model/[slug]/page.tsx`
- `src/inngest/functions/index.ts` — empty registry under FROZEN
- `scripts/freeze-snapshot.ts` — exporter

## Trade-offs accepted

- **Score history charts render flat** in frozen mode. Snapshot only
  keeps latest-per-(model, surface). If multi-point history matters
  for unfreeze, dump `scores` with history in a separate snapshot
  file (not done in v1).
- **Old certification report URLs may show "unverified"** when the
  underlying score predates the snapshot's latest score for that
  model. Acceptable for site freeze; document on `/verify` if it
  becomes an issue.
- **Inngest cloud will continue firing legacy crons** until the app
  is paused in the dashboard. Middleware blocks deliveries (503), so
  no work runs and no DB cost — just log noise on Inngest's side.

## Notes on why this approach

Chosen over Option A (build-time static export via `revalidate=false`
+ `generateStaticParams`) because the build itself no longer needs DB
access — important when Neon is already at quota and a successful
build can't be guaranteed. The snapshot files are committed to the
repo, so any future build (with `FROZEN=1`) works without a live DB.
