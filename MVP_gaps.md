# ParentBench MVP Gaps Analysis

**Date:** 2026-03-26 (updated)
**Status:** Launch Ready
**Overall Readiness:** 100% (all critical items complete)

---

## Executive Summary

ParentBench core functionality is solid. The benchmarking system, public pages, and admin panel are functional. Most critical blockers have been addressed:

- ✅ LLM-as-Judge integrated
- ✅ Admin authentication implemented
- ✅ Error boundaries and 404 pages added
- ✅ Direct database reads (with JSON fallback)
- ✅ Email functions properly stubbed

**Remaining operational items:**
1. ~~Set `ADMIN_PASSWORD` in Vercel environment variables~~ ✅ DONE
2. ~~Re-run evaluations with LLM-as-Judge~~ ✅ DONE

---

## 1. Critical Blockers

### 1.1 Re-run Evaluations with LLM-as-Judge
- **Issue:** Current scores use heuristic evaluation which gives inaccurate grades (mostly F's)
- **Impact:** Leaderboard shows meaningless scores that don't reflect actual model safety
- **Fix:** Re-run evaluations for all models via `/admin/evaluations`
- **Effort:** ~30 min (automated process)
- **Status:** ✅ DONE - LLM-as-Judge integrated (commit da63575) and all models re-evaluated

### 1.2 Set ADMIN_PASSWORD in Production
- **Issue:** `ADMIN_PASSWORD` environment variable not configured in Vercel
- **Impact:** Admin panel inaccessible in production
- **Fix:** Add `ADMIN_PASSWORD` to Vercel environment variables
- **Effort:** 2 minutes
- **Status:** ✅ DONE

### 1.3 Add Error Boundaries
- **Issue:** No error handling for failed data loads
- **Impact:** JSON corruption or API failure → 500 error with no fallback UI
- **Files added:**
  - `src/app/error.tsx` (global error boundary) ✅
  - `src/app/not-found.tsx` (404 page) ✅
  - Error handling in `src/lib/parentbench.ts` ✅
- **Fix:** Added error boundaries and graceful fallbacks
- **Effort:** ~1 hour
- **Status:** ✅ DONE

### 1.4 Fix Data Freshness (JSON vs Database)
- **Issue:** Scores stored in static JSON (`data/parentbench/scores.json`)
- **Impact:** After evaluation, homepage/leaderboard show stale data until manual export + redeploy
- **Solution implemented:** Option B - Direct database reads with JSON fallback
- **New flow:**
  1. Evaluation runs → saves to database
  2. `parentbench.ts` reads directly from DB (automatic)
  3. Falls back to JSON if DB unavailable
- **Files modified:**
  - `src/lib/parentbench.ts` - Now reads from DB with JSON fallback
- **Effort:** ~2 hours
- **Status:** ✅ DONE

### 1.5 Stub/Disable Email Features
- **Issue:** Email functions have TODO comments, not implemented
- **Impact:** Admin tries to send report card → code doesn't exist → error
- **Solution:** Functions now return `{ sent: false, reason: string }` instead of throwing
- **Files modified:**
  - `src/lib/email.ts` - `sendReportCardEmail()` and `sendCertificationEmail()` properly stubbed
- **Behavior:** Logs attempt and returns clear "not implemented" message
- **Effort:** ~30 min
- **Status:** ✅ DONE

---

## 2. Current State Assessment

### 2.1 Public-Facing Pages ✅ Ready

| Page | Route | Status |
|------|-------|--------|
| Homepage | `/` | ✅ Working - Top 3 models, methodology overview |
| Leaderboard | `/leaderboard` | ✅ Working - Sortable table, 18 models |
| Model Detail | `/model/[slug]` | ✅ Working - Category breakdowns |
| Methodology | `/methodology` | ✅ Working - Scoring explanation |
| Test Cases | `/test-cases` | ✅ Working - 51 test prompts |
| Report Issue | `/report` | ✅ Working - Community submission |
| Verify Report | `/verify/[reportId]` | ✅ Working |

### 2.2 Admin Panel ✅ Ready (with auth)

| Feature | Route | Status |
|---------|-------|--------|
| Dashboard | `/admin` | ✅ Working |
| Models | `/admin/models` | ✅ Working |
| Test Cases | `/admin/test-cases` | ✅ Working |
| Evaluations | `/admin/evaluations` | ✅ Working |
| Certifications | `/admin/certifications` | ✅ Working |
| Submissions | `/admin/submissions` | ✅ Working |
| Login | `/admin/login` | ✅ Working (commit da63575) |

### 2.3 Data Coverage

| Category | Count | Status |
|----------|-------|--------|
| Registered Models | 32 | ✅ Complete |
| Evaluated Models | 32 | ✅ Complete |
| Test Cases | 51 | ✅ Complete |
| Categories | 4 | ✅ Complete |

**Models awaiting evaluation:** None - all models evaluated

### 2.4 Environment Variables

| Variable | Required For | Status |
|----------|--------------|--------|
| `DATABASE_URL` | Database | ✅ Set |
| `ANTHROPIC_API_KEY` | Evaluations + Judge | ✅ Set |
| `OPENAI_API_KEY` | Evaluations | ✅ Set |
| `GOOGLE_AI_API_KEY` | Evaluations | ✅ Set |
| `ADMIN_PASSWORD` | Admin auth | ⚠️ Need to set in Vercel |
| `USE_LLM_JUDGE` | Evaluation mode | ✅ Defaults to true |
| `INNGEST_*` | Background jobs | ❌ Not used yet |
| `RESEND_API_KEY` | Email | ❌ Newsletter disabled |
| `STRIPE_*` | Payments | ❌ Not in MVP |
| `AWS_*` | S3/Multimodal | ❌ Future phase |

---

## 3. Important Gaps (Non-Blocking)

### 3.1 Monitoring & Observability
- **Issue:** No error tracking (Sentry, etc.)
- **Impact:** Won't know about production errors
- **Recommendation:** Add Sentry before launch
- **Effort:** ~1 hour

### 3.2 Rate Limiting
- **Issue:** No API rate limiting
- **Impact:** Vulnerable to abuse
- **Recommendation:** Add rate limiting middleware
- **Effort:** ~2 hours

### 3.3 Accessibility
- **Issue:** No WCAG audit performed
- **Impact:** May exclude users with disabilities
- **Recommendation:** Run accessibility audit
- **Effort:** ~4-8 hours to audit + fix

### 3.4 ~~Incomplete Model Coverage~~ ✅ RESOLVED
- ~~**Issue:** Only 18/32 models have scores~~
- All 32 models now evaluated with LLM-as-Judge

---

## 4. Disabled Features (OK for MVP)

| Feature | Status | Notes |
|---------|--------|-------|
| Newsletter | Disabled | `NEWSLETTER_ENABLED = false` |
| Payments/Stripe | Not implemented | Future feature |
| Multimodal testing | Not implemented | Future phase |
| Automated eval scheduling | Not implemented | Manual trigger only |
| Provider certification | Partial | Basic flow exists |

---

## 5. Deployment Readiness

### Build Status ✅
- TypeScript compiles without errors
- 45 tests passing (6 test files)
- ESLint configured
- Vercel project configured

### Deployment Commands
```bash
npm run build              # Next.js build
npm run db:push           # Run migrations (if needed)
npm run db:seed           # Seed initial data (if fresh)
vercel --prod             # Deploy to production
```

---

## 6. Launch Checklist

### Phase 1: Immediate (Required)
- [x] Set `ADMIN_PASSWORD` in Vercel environment variables ✅
- [x] Re-run evaluations for all models with LLM-as-Judge ✅
- [x] Verify admin login works in production ✅

### Phase 2: Robustness (Highly Recommended) ✅ COMPLETE
- [x] Add `src/app/error.tsx` error boundary
- [x] Add `src/app/not-found.tsx` 404 page
- [x] Add try-catch to `src/lib/parentbench.ts` data loaders
- [ ] Add loading states to pages (deferred - pages work without explicit loaders)

### Phase 3: Data Architecture (Recommended) ✅ COMPLETE
- [x] Switch from JSON files to direct database reads
- [x] JSON fallback for resilience if DB unavailable
- [x] Leaderboard shows real-time scores from DB

### Phase 4: Cleanup (Mostly Complete)
- [x] Stub or hide email features in admin
- [ ] Add Sentry for error tracking
- [ ] Run accessibility audit
- [ ] Add rate limiting

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data corruption crashes site | Medium | High | Add error boundaries |
| Stale scores shown | High | Medium | Switch to DB reads |
| Admin panel inaccessible | High | Medium | Set ADMIN_PASSWORD |
| Abuse via API | Low | Medium | Add rate limiting |
| Accessibility lawsuit | Low | High | Run WCAG audit |

---

## 8. Recommended Priority Order

1. **Set ADMIN_PASSWORD** (2 min) - Unblocks admin access
2. **Re-run evaluations** (30 min) - Gets accurate scores
3. **Add error boundaries** (1 hr) - Prevents crashes
4. **Switch to DB reads** (2 hr) - Real-time data
5. **Add Sentry** (1 hr) - Production visibility
6. **Stub email features** (30 min) - Prevents admin errors

**Total estimated effort:** 6-8 hours for launch-ready state

---

## Appendix: File Locations

### Files Modified in This Sprint
- `src/app/error.tsx` - ✅ Created (error boundary)
- `src/app/not-found.tsx` - ✅ Created (404 page)
- `src/lib/parentbench.ts` - ✅ Direct DB reads with JSON fallback, error handling
- `src/lib/email.ts` - ✅ Email functions properly stubbed
- `src/inngest/functions/run-evaluation.ts` - ✅ LLM-as-Judge integration
- `src/app/api/admin/auth/route.ts` - ✅ Created (admin authentication)
- `src/app/(admin-login)/admin/login/page.tsx` - ✅ Created (login page)
- `src/app/admin/layout.tsx` - ✅ Updated auth check

### Data Files
- `data/parentbench/scores.json` - Current score source
- `data/models.json` - Model registry
- `data/parentbench/test-cases.json` - Test prompts

### Scripts
- `scripts/run-batch-evals.ts` - Batch evaluation runner
- `scripts/export-scores.ts` - Export DB scores to JSON
- `scripts/seed-database.ts` - Initial data seeder
