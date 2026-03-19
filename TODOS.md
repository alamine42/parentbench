# TODOS

Deferred work from plan reviews and implementation. Organized by priority.

## P1 - High Priority (Pre-Launch or Soon After)

### Security Penetration Testing
**What:** Full security audit before public launch with certification/payments
**Why:** Community submissions, provider portal, and payments create attack surface
**Pros:** Catch vulnerabilities before they're exploited
**Cons:** May require external security firm, cost
**Context:** v2.0 adds user auth, payments (Stripe), community UGC, and public API. All need security review.
**Effort:** L (human: may need external firm) | CC: can prep materials
**Depends on:** v2.0 core features implemented

### Chaos Testing Suite
**What:** Test system resilience under failures (Inngest down, API timeouts, DB connection loss)
**Why:** Ensure graceful degradation and proper error handling
**Pros:** Catch failure modes before production
**Cons:** Takes time to set up properly
**Context:** v2.0 introduces Inngest jobs, external API dependencies, Postgres. All can fail.
**Effort:** M (human: ~2 days) | CC: ~1 hour
**Depends on:** v2.0 infrastructure deployed

### Accessibility Audit
**What:** WCAG AA compliance check, screen reader testing, keyboard navigation verification
**Why:** Public-facing site used by parents with diverse needs; legal/ethical requirement
**Pros:** Broader accessibility, avoids legal issues, better UX for everyone
**Cons:** Manual testing required; may need external auditor for certification
**Context:** v2.0 design review specified a11y requirements (4.5:1 contrast, 44px touch targets, ARIA landmarks, keyboard nav). Audit verifies implementation matches spec.
**Effort:** M (human: ~1 week with auditor) | CC: ~2 hours for automated checks
**Depends on:** v2.0 UI implementation complete

## P2 - Medium Priority (v2.1)

### Automated Eval Scheduling
**What:** Add cron-triggered daily evaluations for all models
**Why:** Keep scores fresh without manual intervention
**Pros:** Continuous monitoring, catches model updates
**Cons:** API costs for daily runs, rate limit management
**Context:** v2.0 will have manual eval triggers. Add cron for production.
**Effort:** S (human: ~2 hours) | CC: ~15 min
**Depends on:** Eval engine deployed

### Provider Webhook API
**What:** Allow providers to receive webhooks when certification status changes
**Why:** Providers want programmatic integration, not just email
**Pros:** Better DX for providers, enables automation
**Cons:** Webhook delivery reliability, retry logic
**Context:** Certification program will email providers. Webhooks are a natural extension.
**Effort:** S (human: ~1 day) | CC: ~30 min
**Depends on:** Certification program

### Multi-Language Support
**What:** Add i18n infrastructure and translated test cases (Spanish, French, German, Mandarin)
**Why:** Non-English-speaking parents need this; global market opportunity
**Pros:** 10x larger addressable market
**Cons:** Translation quality matters; need native reviewers
**Context:** Current site is English-only. Test cases especially need careful translation.
**Effort:** M (human: ~2 weeks with translators) | CC: ~2 hours for infra
**Depends on:** v2.0 shipped

### Provider Dashboard Analytics
**What:** Show providers how their model scores over time vs competitors
**Why:** Motivates providers to improve; potential premium feature
**Pros:** Engagement, potential revenue
**Cons:** Competitors may not want comparison
**Context:** Certification program will have provider logins; analytics is natural extension
**Effort:** M (human: ~1 week) | CC: ~1 hour
**Depends on:** Certification program, historical scores

### Formalize Design System (DESIGN.md)
**What:** Document design system: color palette, typography scale, spacing scale, component library, animation guidelines
**Why:** Ensure consistency across features; enable faster development; onboard new contributors
**Pros:** Faster implementation, consistent UX, easier maintenance
**Cons:** Requires dedicated design effort; may need iteration
**Context:** v2.0 design review documented existing patterns (ScoreRing, LetterGradeBadge, ColorBar, bg-neutral-900). Run /design-consultation to formalize into DESIGN.md.
**Effort:** M (human: ~1 week) | CC: ~2 hours
**Depends on:** v2.0 shipped (design system emerges from real usage)

## P3 - Lower Priority (v2.2+)

### AI-Assisted Moderation
**What:** Use LLM to pre-filter community submissions before human review
**Why:** Scale moderation without scaling humans
**Pros:** Faster review, lower cost
**Cons:** May miss edge cases, need human backup
**Context:** Community submissions will need moderation. AI can flag obvious spam/abuse.
**Effort:** S (human: ~2 days) | CC: ~30 min
**Depends on:** Community submissions feature

---

*Last updated: 2026-03-18 by /plan-design-review*
