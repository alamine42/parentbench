---
title: "OpenAI model family quirks: temperature constraints and Responses-API-only -pro variants"
category: "gotchas"
date: "2026-04-29"
tags: [openai, gpt-5, gpt-5.5, temperature, responses-api, model-registry]
files:
  - src/lib/eval/adapters/index.ts
  - src/lib/costs.ts
---

# OpenAI model family quirks: temperature constraints and Responses-API-only -pro variants

## Context

When adding new OpenAI models to `adapterRegistry`, two non-obvious failure
modes can ship silently and cost a full eval run before being noticed.
Both surfaced while adding gpt-5.5 on 2026-04-29; both will repeat for
every future GPT-5.x release.

## The two gotchas

### 1. Temperature support is not consistent across a single model family

You cannot infer temperature behavior from the model family name. Verified
empirically on 2026-04-29:

| Model | Accepts `temperature=0.7`? |
|---|---|
| `gpt-5`, `gpt-5-mini`, `gpt-5-nano` | ❌ — only `temperature=1` |
| `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` | ✅ — accepts arbitrary |
| `gpt-5.5` | ❌ — only `temperature=1` |

Failure mode: the API returns HTTP 400 with
`"Unsupported value: 'temperature' does not support 0.7 with this model.
Only the default (1) value is supported."` Every test case in the eval
batch fails with the same error — same silent-zero-score pattern as
`stale-provider-model-ids.md`.

### 2. The `OPENAI_NO_TEMPERATURE_MODELS` matcher silently misses dot-versioned models

The current matcher in `src/lib/eval/adapters/index.ts`:

```typescript
return OPENAI_NO_TEMPERATURE_MODELS.some(
  (m) => this.modelId === m || this.modelId.startsWith(`${m}-`)
);
```

`"gpt-5.5".startsWith("gpt-5-")` is **false** — the `.` after `gpt-5`
breaks the prefix match. So adding just `"gpt-5"` to the list will not
catch any `gpt-5.x` family member. **Each new dot-versioned model must
be added explicitly by its full id.**

### 3. The `-pro` variants are Responses-API-only, not chat completions

Verified empirically on 2026-04-29:

| Model | `/v1/chat/completions` response |
|---|---|
| `gpt-5.4-pro` | ❌ "This is not a chat model and thus not supported in the v1/chat/completions endpoint. Did you mean to use v1/completions?" |
| `gpt-5.5-pro` | ❌ Same error |

`gpt-5.4-pro` was sitting in the registry from a previous session; every
call against it has been silently failing or going to the mock adapter.
Tracked in parentbench-7ev.

## Guidance — checklist for adding a new OpenAI model

Before merging a new entry to `adapterRegistry`:

1. **Verify the model exists in the live API.** Don't trust release notes,
   blogs, or other agents:
   ```bash
   curl -s https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     | jq -r '.data[].id' | grep <new-family>
   ```
2. **Verify the endpoint.** Hit `/v1/chat/completions` with the model id —
   if it returns *"not a chat model"*, the model is Responses-API-only.
   Either add a Responses adapter path or skip the model.
3. **Verify temperature support.** Call once with `temperature=0.7`. If
   it returns the *"Unsupported value"* 400, add the model id (with dot,
   not hyphen) to `OPENAI_NO_TEMPERATURE_MODELS` in
   `src/lib/eval/adapters/index.ts`.
4. **End-to-end smoke.** With temperature handling correct, send a real
   prompt and confirm a 200 with content. The `model` field in the
   response surfaces the underlying snapshot id (e.g.
   `gpt-5.5-2026-04-23`) — record it in the commit message.
5. **Update both pricing maps.** `DEFAULT_PRICING` keys are API model ids
   (with dots: `"gpt-5.5"`), while `data/models.json` and
   `scripts/update-openai-models.ts` use DB slugs (with hyphens:
   `"gpt-5-5"`). Mixing the two is the easiest way to write a registry
   entry that doesn't price.

## Examples

```typescript
// src/lib/eval/adapters/index.ts
const OPENAI_NO_TEMPERATURE_MODELS = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.5",  // ← MUST be the full id with dot, prefix matcher won't help
];
```

```bash
# Live verification before committing a new entry
set -a && source .env.local && set +a
curl -s -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"<NEW_MODEL>","messages":[{"role":"user","content":"hi"}],
       "max_completion_tokens":5,"temperature":0.7}' \
  | jq -c '{choices:(.choices|length), error:(.error.message // null)}'
```

## References

- Sibling doc: `docs/solutions/integration-issues/stale-provider-model-ids.md`
  (the original "every eval silently scored 0" incident — same failure
  shape, different root cause)
- Beads: parentbench-7ev (Responses API adapter for -pro variants)
- Beads: parentbench-eie (o4-mini deprecation, separate concern)
- Live registration commit example: `89d4ffb` (gpt-5.5)
