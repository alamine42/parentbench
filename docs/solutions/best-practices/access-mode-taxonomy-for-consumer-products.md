---
title: "Designing consumer-product evaluation around access modes, not account attributes"
category: "best-practices"
date: "2026-05-03"
tags: [methodology, consumer-products, evaluation, access-modes]
files:
  - src/types/parentbench.ts
  - docs/designs/parentbench-d95-consumer-products-track.md
  - docs/designs/parentbench-d95-publication-runbook.md
---

# Designing consumer-product evaluation around access modes, not account attributes

## Context

When evaluating a consumer product (AI assistant, social platform,
e-commerce app, banking app, anything end-user-facing), the
benchmark designer has to pick a taxonomy: which "surfaces" or
"variants" of the product should be tested?

The temptation is to organize around account attributes the product
exposes — adult vs minor accounts, free vs paid tiers, individual vs
family plans, business vs personal. Those axes feel principled
because they're discrete, schema-backed, and easy to defend in
methodology copy.

The temptation is wrong. Real users don't access a product through
"account attributes" — they access it through whatever rung of the
auth ladder they happen to be on. And which rungs even *exist*
varies dramatically per provider.

This came up in parentbench-d95. The original v1 plan was
"adult-account variant only, teen-account in v1.1." The user pushed
back: "How can minors actually access these LLMs on the web?"
Re-running the question against reality produced a completely
different surface taxonomy.

## Guidance

### Step 1: Ask the access question, not the persona question

For each provider in scope, list every realistic way a user from
your target population can access the product. Don't filter for
"officially supported" — filter for "actually used by people in the
target population, including informal paths." Examples for
parentbench's "minor accessing AI assistants" target:

1. **Logged-out / anonymous** (no account, no signup)
2. **Their own account, age-appropriate** (own teen-DOB account)
3. **Family-supervised account** (parent provisioned it, ongoing
   oversight)
4. **An adult's account** (parent's, sibling's, friend's, shared)

This list is *empirically derived*, not theoretically clean. It
captures informal access (item 4) which is often the dominant
real-world path but invisible if you only look at account schemas.

### Step 2: Map availability per provider

For each provider, mark which rungs exist:

| | ChatGPT | Claude | Gemini | Grok |
|---|---|---|---|---|
| Anonymous | ✓ | ✗ | ✗ | ✓ |
| Own age-appropriate | ✓ (13+) | ✗ (TOS forbids <18) | ✓ (13+) | ✓ (13+) |
| Family-supervised | ✗ | ✗ | ✓ (Family Link) | ✗ |
| Adult's account | ✓ | ✓ | ✓ | ✓ |

The matrix is asymmetric. Two facts stand out:
- Some rungs are universal (adult's account works everywhere).
- Some rungs are unique to one provider (Family Link → Gemini only).
- Some are flatly unavailable (Claude prohibits under-18 entirely).

Trying to design around persona ("a 12-year-old user") forces
arbitrary choices to fill the gaps. Designing around access mode
("anonymous browser session") lets you test the rung where it
exists and honestly say "n/a" where it doesn't.

### Step 3: Pick v1 surfaces by coverage × cost

For each (provider, access-mode) cell that exists, score:
- **Coverage** — how many real users in the target population
  reach the product this way? (informal access usually scores high;
  family-supervised usually scores low but with high stakes-per-user)
- **Cost** — how hard is it to set up and maintain a measurement?
  Anonymous = $0 (no account, no cookies, no expiry). Adult-account
  = moderate (one human-created account per provider, cookie refresh
  monthly). Teen-DOB = high (DOB-based provisioning, age verification,
  per-provider TOS variation). Family-supervised = highest
  (multi-account dance, Family Link approval flows).

Prioritize high-coverage / low-cost cells for v1. Defer low-coverage
or high-cost cells to v1.x where they earn their slot once the
pipeline is proven.

In parentbench-d95, this produced:

- **v1**: anonymous (where it exists: ChatGPT, Grok) + adult-account
  (everywhere). Six runs, two per provider where supported.
- **v1.x**: teen-DOB (Gemini meaningful, others marginal),
  Family-supervised (Gemini-only), api-with-system-prompt (already
  scaffolded but unused).

### Step 4: Make the gaps visible in published methodology

When a provider doesn't support a rung you're testing on others, say
so explicitly. "Claude required login on the date we tested; we
report only the signed-in score" is more credible than silently
omitting the column. Asymmetric coverage is honest; pretending
symmetry is misleading.

### Step 5: Future-proof with a flat surface enum

Don't bake the taxonomy into a hierarchy. A flat enum of
`(provider × access-mode)` strings (e.g., `web-product-anonymous`,
`web-product`, `web-product-teen-mode`, `web-product-supervised`)
lets you add new modes without restructuring. Resist the urge to
model parent-child relationships ("teen mode IS-A signed-in mode")
— different providers' modes don't actually nest cleanly.

In parentbench-d95: `EvaluationSurface` is a flat string-literal
union; the DB column is `text NOT NULL DEFAULT 'api-default'`
(not an enum, so adding a value is `ALTER` of zero rows).

## Counter-pattern: "we'll add account variants later"

The original parentbench-d95 plan deferred teen accounts to v1.1
on the theory that "adult-only is the simpler scope." This sounds
reasonable but it's a mistake when:

- The benchmark exists *because* the target population (minors) is
  underserved by adult-account assumptions
- The most actionable surface for the target population *isn't*
  in v1 (anonymous-on-ChatGPT in this case)
- The "simpler" framing is simpler in the *engineering* sense but
  weaker in the *measurement* sense

Catching this requires asking the access question, not the persona
question. The reframe was triggered by a single user prompt: "How
can minors access LLMs from the four major providers on the web?"
That question would have produced the right taxonomy on day one if
it had been the framing question for the v1 scope decision.

## Tell

Indicators you've fallen into the persona-attribute trap:
- Your surface taxonomy uses adjectives that map to schema fields
  (adult / teen / verified / paid)
- Coverage gaps in your matrix are awkward to explain to a
  non-technical reader
- The v1 cut "feels safe" but the deferred-to-v1.x bucket contains
  the most-used access path
- You're designing around what providers *expose* in account creation
  flows, not what users *do* once an account exists

## References

- `docs/designs/parentbench-d95-consumer-products-track.md` §1–2
  (problem, UX) and §11 (out-of-scope rationale)
- `docs/designs/parentbench-d95-publication-runbook.md` Account
  hygiene section
- `src/types/parentbench.ts` `EvaluationSurface` enum
