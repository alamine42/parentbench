---
title: "Dotenv config fires after module-top imports — DATABASE_URL undefined"
category: "runtime-errors"
date: "2026-04-19"
tags: [dotenv, esm, tsx, nodejs, import-order]
files:
  - scripts/trigger-eval.ts
  - scripts/update-anthropic-google-models.ts
  - scripts/assign-eval-tiers.ts
---

# Dotenv config fires after module-top imports — DATABASE_URL undefined

## Problem

Running `npx tsx scripts/trigger-eval.ts <slug>` threw:

```
Error: DATABASE_URL environment variable is required
    at src/db/index.ts:6
```

…even though `.env.local` clearly had `DATABASE_URL` set, and the dotenv
call was at the top of the script file. Other scripts in the same folder
worked fine.

## Root Cause

The broken script used **static imports** for both dotenv and the db
module:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });          // runs first — except it doesn't

import { db } from "../src/db";           // ESM hoists — evaluates here FIRST
```

In ESM (and in tsx's CJS emulation), all `import` statements are hoisted
and their modules instantiated before any file-level statement runs. So
`src/db/index.ts` evaluated first, threw on missing `DATABASE_URL`, and
the dotenv call never got the chance.

Scripts that worked (`update-anthropic-google-models.ts`,
`assign-eval-tiers.ts`) had already solved this by using **dynamic
imports inside the async main**:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  // …
}
```

## Solution

Match the dynamic-import pattern the other scripts use:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

async function triggerEvaluation(modelSlug: string) {
  const { db } = await import("../src/db/index.js");
  const { models } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const { inngest } = await import("../src/inngest/client.js");
  // …
}
```

`dotenv.config()` executes before the dynamic imports do, so
`process.env` is populated by the time `src/db/index.ts` reads it.

## Prevention

- [ ] Codify the pattern: any script that loads `.env.local` must use
      dynamic imports for modules that read env at top level. Add it to
      a project conventions doc / CLAUDE.md
- [ ] Alternative: have `src/db/index.ts` lazy-initialize the Neon
      client (first `db.select()` creates the connection), so its module
      top isn't env-dependent. This removes the entire class of bug but
      is a larger change
- [ ] Consider `dotenv-cli` (`dotenv -e .env.local -- npx tsx script.ts`)
      to inject env before Node starts — sidesteps the ordering issue
      entirely

## Related

- Fixed in commit `1906f15` (trigger-eval dotenv fix bundled with the
  Opus 4.7 registration)
- Node docs: [ES modules — Top-level await and static imports](https://nodejs.org/api/esm.html#top-level-await)
