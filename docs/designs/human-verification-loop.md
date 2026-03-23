# Phase 4.5: Human Verification Loop

> **Design Review Status:** Revised after Codex adversarial review (2026-03-23)

## Problem Statement

Current eval system uses heuristic grading (pattern matching for refusals) which:
- Produces artificially low scores (best model: 61.73)
- Misses nuanced safe responses that don't match patterns
- Has no mechanism for humans to correct mistakes
- Lacks transparency into grading decisions

## Solution: Multi-Layer Verification

| Layer | Who | What | When |
|-------|-----|------|------|
| **L1: Automated** | LLM Judge | Grade all test cases with confidence score | Every eval run |
| **L2: Escalation** | Admin | Review low-confidence (<0.7) verdicts | As flagged |
| **L3: Spot-check** | Expert Panel | Random 5% sample verification | Weekly |
| **L4: Community** | Verified Users | Vote on disputed results | Ongoing |
| **L5: Red Team** | Public | Submit adversarial prompts | Ongoing |

## Engineering Plan

### Database Schema Changes

```sql
-- Add to eval_results table
ALTER TABLE eval_results ADD COLUMN confidence DECIMAL(3,2);
ALTER TABLE eval_results ADD COLUMN grader_type ENUM('heuristic', 'llm', 'human');
-- NOTE: Final verdict stored here; history in human_reviews table
ALTER TABLE eval_results ADD COLUMN final_verdict ENUM('pass', 'partial', 'fail');
ALTER TABLE eval_results ADD COLUMN verdict_source ENUM('automated', 'human_override', 'community_consensus');
-- NEW: Gating flag for low-confidence results
ALTER TABLE eval_results ADD COLUMN is_quarantined BOOLEAN DEFAULT FALSE;
ALTER TABLE eval_results ADD COLUMN quarantined_at TIMESTAMP;

-- NEW: Immutable audit trail for human reviews (addresses CRITICAL: data integrity)
CREATE TABLE human_reviews (
  id UUID PRIMARY KEY,
  eval_result_id UUID REFERENCES eval_results(id),
  reviewer_id UUID REFERENCES users(id),
  reviewer_type ENUM('admin', 'expert', 'community'),
  verdict ENUM('pass', 'partial', 'fail'),
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  -- Immutable: no updates allowed, only inserts
  INDEX idx_eval_result_id (eval_result_id),
  INDEX idx_reviewer_id (reviewer_id)
);

-- Review queue with concurrency controls (addresses WARNING: concurrency)
CREATE TABLE review_queue (
  id UUID PRIMARY KEY,
  eval_result_id UUID REFERENCES eval_results(id),
  reason ENUM('low_confidence', 'disputed', 'spot_check', 'escalated'),
  priority INTEGER DEFAULT 0,
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMP,
  -- Optimistic locking
  version INTEGER DEFAULT 1,
  status ENUM('pending', 'in_review', 'completed', 'expired'),
  sla_deadline TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(eval_result_id, status) -- Prevent duplicate active queue entries
);

-- Community votes with reputation weighting (addresses CRITICAL: sybil attacks)
CREATE TABLE community_votes (
  id UUID PRIMARY KEY,
  eval_result_id UUID REFERENCES eval_results(id),
  user_id UUID REFERENCES users(id),
  vote ENUM('pass', 'partial', 'fail'),
  reasoning TEXT,
  -- Weighted voting based on reputation
  vote_weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(eval_result_id, user_id)
);

-- Enhanced user verification for community voting (addresses CRITICAL: sybil)
CREATE TABLE verified_voters (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE,
  verification_method ENUM('email', 'phone', 'oauth_github', 'oauth_google'),
  verified_at TIMESTAMP,
  -- Reputation system
  reputation_score DECIMAL(5,2) DEFAULT 1.0,
  total_votes INTEGER DEFAULT 0,
  agreement_with_final DECIMAL(3,2),
  -- Anti-sybil: accounts must be 7+ days old
  account_age_verified BOOLEAN DEFAULT FALSE,
  -- Cooling period after creation
  can_vote_after TIMESTAMP,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspended_reason TEXT
);

CREATE TABLE expert_reviewers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  expertise TEXT[],
  verified_at TIMESTAMP,
  total_reviews INTEGER DEFAULT 0,
  agreement_rate DECIMAL(3,2),
  -- Track reviewer quality
  avg_reasoning_length INTEGER,
  last_review_at TIMESTAMP
);
```

### Gating Logic (addresses CRITICAL: unreviewed low-confidence results)

Low-confidence and disputed results are **quarantined** from published scores:

```typescript
// When saving eval result
async function saveEvalResult(result: EvalResult) {
  if (result.confidence < 0.7) {
    result.is_quarantined = true;
    result.quarantined_at = new Date();
    await createQueueEntry(result.id, 'low_confidence');
  }
  await db.evalResults.insert(result);
}

// When computing model scores, exclude quarantined results
async function computeModelScore(modelId: string) {
  const results = await db.evalResults.findMany({
    where: {
      model_id: modelId,
      is_quarantined: false  // Only use verified results
    }
  });
  return calculateWeightedScore(results);
}

// When human review clears a result
async function clearQuarantine(evalResultId: string, verdict: Verdict) {
  await db.evalResults.update({
    where: { id: evalResultId },
    data: {
      is_quarantined: false,
      final_verdict: verdict,
      verdict_source: 'human_override'
    }
  });
  // Trigger score recalculation
  await recalculateScores(result.model_id);
}
```

### Community Voting with Reputation Weighting (addresses CRITICAL: sybil attacks)

```typescript
// Consensus calculation with reputation weights
async function getVoteConsensus(evalResultId: string): Promise<ConsensusResult> {
  const votes = await db.communityVotes.findMany({
    where: { eval_result_id: evalResultId },
    include: { voter: { include: { verified_voter: true } } }
  });

  // Only count votes from verified voters with reputation > 0.5
  const validVotes = votes.filter(v =>
    v.voter.verified_voter?.reputation_score >= 0.5 &&
    v.voter.verified_voter?.account_age_verified
  );

  // Weighted voting
  const weightedTallies = { pass: 0, partial: 0, fail: 0 };
  for (const vote of validVotes) {
    const weight = vote.voter.verified_voter?.reputation_score ?? 1.0;
    weightedTallies[vote.vote] += weight;
  }

  const totalWeight = Object.values(weightedTallies).reduce((a, b) => a + b, 0);
  const threshold = totalWeight * 0.6; // 60% weighted consensus required

  for (const [verdict, weight] of Object.entries(weightedTallies)) {
    if (weight >= threshold) {
      return { verdict, confidence: weight / totalWeight, votes: validVotes.length };
    }
  }

  return { verdict: null, confidence: 0, votes: validVotes.length }; // No consensus
}

// Update reputation after final verdict is known
async function updateVoterReputation(evalResultId: string, finalVerdict: Verdict) {
  const votes = await db.communityVotes.findMany({ where: { eval_result_id: evalResultId } });

  for (const vote of votes) {
    const correct = vote.vote === finalVerdict;
    const delta = correct ? 0.05 : -0.1; // Penalize incorrect votes more

    await db.verifiedVoters.update({
      where: { user_id: vote.user_id },
      data: {
        reputation_score: sql`GREATEST(0, LEAST(2, reputation_score + ${delta}))`,
        agreement_with_final: sql`(agreement_with_final * total_votes + ${correct ? 1 : 0}) / (total_votes + 1)`,
        total_votes: sql`total_votes + 1`
      }
    });
  }
}
```

### Queue Assignment with Optimistic Locking (addresses WARNING: concurrency)

```typescript
async function claimQueueItem(queueId: string, reviewerId: string): Promise<boolean> {
  const item = await db.reviewQueue.findUnique({ where: { id: queueId } });

  if (item.assigned_to || item.status !== 'pending') {
    return false; // Already claimed
  }

  // Optimistic lock with version check
  const result = await db.reviewQueue.updateMany({
    where: {
      id: queueId,
      version: item.version,
      status: 'pending'
    },
    data: {
      assigned_to: reviewerId,
      assigned_at: new Date(),
      status: 'in_review',
      version: item.version + 1
    }
  });

  return result.count === 1;
}

// Release stale assignments after 30 minutes
async function releaseStaleAssignments() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  await db.reviewQueue.updateMany({
    where: {
      status: 'in_review',
      assigned_at: { lt: thirtyMinutesAgo }
    },
    data: {
      status: 'pending',
      assigned_to: null,
      assigned_at: null
    }
  });
}
```

### Spot-Check Sampling Strategy (addresses WARNING: undefined sampling)

```typescript
interface SpotCheckConfig {
  sampleRate: 0.05; // 5%
  stratifyBy: ['model_id', 'category_id'];
  excludeStatuses: ['disputed', 'low_confidence']; // Already in queue
  randomSeed: Date; // Weekly seed for reproducibility
}

async function generateWeeklySpotChecks() {
  const seed = getWeekStartDate();
  const rng = seedrandom(seed.toISOString());

  // Get all results from past week, stratified
  const results = await db.evalResults.findMany({
    where: {
      created_at: { gte: subDays(new Date(), 7) },
      is_quarantined: false,
      // Exclude items already being reviewed
      NOT: {
        id: { in: await getActiveQueueIds() }
      }
    }
  });

  // Stratified sampling by model and category
  const strata = groupBy(results, r => `${r.model_id}:${r.category_id}`);
  const selected: string[] = [];

  for (const [key, items] of Object.entries(strata)) {
    const sampleSize = Math.max(1, Math.ceil(items.length * 0.05));
    const shuffled = shuffle(items, rng);
    selected.push(...shuffled.slice(0, sampleSize).map(r => r.id));
  }

  // Create queue entries
  for (const evalResultId of selected) {
    await db.reviewQueue.create({
      data: {
        eval_result_id: evalResultId,
        reason: 'spot_check',
        priority: 0, // Lower priority than disputes
        sla_deadline: addDays(new Date(), 7)
      }
    });
  }

  return selected.length;
}
```

### API Routes with Authentication (addresses WARNING: RBAC)

```typescript
// Middleware for role-based access
const requireRole = (roles: UserRole[]) => async (req, res, next) => {
  const user = await getAuthenticatedUser(req);
  if (!user || !roles.includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.user = user;
  next();
};

// API Routes
export const reviewRoutes = {
  // Admin only
  'GET /api/internal/review/queue': [
    requireRole(['admin']),
    rateLimit({ windowMs: 60000, max: 100 }),
    getReviewQueue
  ],

  'POST /api/internal/review/[id]/claim': [
    requireRole(['admin', 'expert']),
    rateLimit({ windowMs: 60000, max: 30 }),
    claimQueueItem
  ],

  'POST /api/internal/review/[id]/verdict': [
    requireRole(['admin', 'expert']),
    rateLimit({ windowMs: 60000, max: 30 }),
    validateBody(verdictSchema),
    submitVerdict,
    auditLog('verdict_submitted')
  ],

  // Verified voters only
  'POST /api/internal/votes/[evalResultId]': [
    requireRole(['user']),
    requireVerifiedVoter,
    rateLimit({ windowMs: 3600000, max: 50 }), // 50 votes per hour
    validateBody(voteSchema),
    submitVote,
    auditLog('vote_submitted')
  ],

  // Public (with rate limiting)
  'POST /api/internal/disputes': [
    rateLimit({ windowMs: 86400000, max: 5 }), // 5 disputes per day per IP
    validateBody(disputeSchema),
    sanitizeInput,
    createDispute,
    auditLog('dispute_created')
  ]
};
```

### Audit Logging (addresses CRITICAL: data integrity)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_ip INET,
  target_type VARCHAR(50),
  target_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### Components

- src/lib/eval/llm-judge.ts — LLM-based grader with confidence
- src/lib/eval/confidence.ts — Confidence scoring logic
- src/lib/eval/quarantine.ts — Gating logic for low-confidence results
- src/lib/voting/reputation.ts — Reputation-weighted consensus
- src/lib/voting/sybil-prevention.ts — Anti-sybil verification
- src/components/review-queue.tsx — Admin review interface
- src/components/dispute-button.tsx — "Dispute this result" CTA
- src/components/vote-widget.tsx — Community voting UI
- src/components/confidence-badge.tsx — Show confidence level
- src/components/quarantine-badge.tsx — Show "Pending Review" status

## UX Design

### Admin Review Queue (/admin/reviews)

- Table: Test case | Model | Auto verdict | Confidence | SLA Status | Actions
- Filter by: confidence level, model, category, date, SLA urgency
- Sort by: priority (low confidence first), SLA deadline, date
- Bulk actions: Approve all, Assign to me
- **Assignment indicator:** Shows who has claimed each item (addresses concurrency)
- **SLA countdown:** Red for overdue, yellow for <24h remaining
- Detail modal: Full response, good/bad examples, verdict buttons, **reasoning text field (required)**

### Model Detail Page Updates

- Add "Human Verified" badge on results with human review
- **"Pending Review" badge** for quarantined results (not included in score)
- Show confidence indicator (green/yellow/red) per category
- "Dispute this result" button opens modal
- Verification stats: "87% human-verified, 13% automated, 2 pending"

### Community Voting (/test-cases/[id]/votes)

- Show model response (anonymized during voting)
- Three buttons: Pass | Partial | Fail
- **Required reasoning text field** (min 20 characters)
- Vote tally shown after voting (weighted by reputation)
- **Reputation badge** showing voter's trust level
- Requires verified account (email + 7-day account age)

### Dispute Flow

1. User clicks "Dispute this result" on model detail
2. Modal: Select category, describe issue (required), submit
3. Creates review_queue entry with reason='disputed'
4. **Result is quarantined** from published scores
5. User sees "Dispute submitted — result pending review" confirmation
6. Email when dispute is resolved with outcome

## E2E Test Plan

### Test: LLM Judge produces confidence scores

```typescript
test('LLM judge returns confidence score', async () => {
  const result = await llmJudge.evaluate(testCase, modelResponse);
  expect(result.verdict).toMatch(/pass|partial|fail/);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(result.reasoning).toBeDefined();
});
```

### Test: Low confidence triggers quarantine and escalation

```typescript
test('low confidence quarantines result and creates queue entry', async () => {
  const result = await runEvaluation(model, testCase);
  result.confidence = 0.5;
  await saveEvalResult(result);

  const saved = await getEvalResult(result.id);
  expect(saved.is_quarantined).toBe(true);

  const queue = await getReviewQueue();
  expect(queue).toContainEqual(
    expect.objectContaining({
      eval_result_id: result.id,
      reason: 'low_confidence'
    })
  );
});
```

### Test: Quarantined results excluded from scores

```typescript
test('quarantined results not included in model score', async () => {
  const model = await getModel('gpt-4o');

  // Create quarantined result
  await createEvalResult({
    model_id: model.id,
    verdict: 'fail',
    is_quarantined: true
  });

  const score = await computeModelScore(model.id);
  // Score should not include the quarantined fail
  expect(score).toEqual(model.original_score);
});
```

### Test: Human review creates immutable audit trail

```typescript
test('human verdict creates immutable review record', async () => {
  const result = await createEvalResult({ verdict: 'fail', confidence: 0.4 });

  await submitVerdict(result.id, {
    verdict: 'pass',
    reasoning: 'Response is actually safe because...',
    reviewer_id: adminUser.id
  });

  const reviews = await getHumanReviews(result.id);
  expect(reviews).toHaveLength(1);
  expect(reviews[0].verdict).toBe('pass');
  expect(reviews[0].reasoning).toBeDefined();

  // Verify immutability: cannot update
  await expect(updateHumanReview(reviews[0].id, { verdict: 'fail' }))
    .rejects.toThrow('Human reviews are immutable');
});
```

### Test: Queue assignment with optimistic locking

```typescript
test('concurrent claim attempts only one succeeds', async () => {
  const queueItem = await createQueueEntry(evalResultId, 'low_confidence');

  // Simulate concurrent claims
  const results = await Promise.all([
    claimQueueItem(queueItem.id, admin1.id),
    claimQueueItem(queueItem.id, admin2.id),
    claimQueueItem(queueItem.id, admin3.id)
  ]);

  const successCount = results.filter(r => r === true).length;
  expect(successCount).toBe(1);

  const item = await getQueueItem(queueItem.id);
  expect(item.status).toBe('in_review');
});
```

### Test: Community vote requires verified voter with reputation

```typescript
test('vote rejected for unverified or low-reputation voter', async () => {
  const result = await createEvalResult({ verdict: 'fail' });

  // Unverified voter
  await expect(submitVote(result.id, unverifiedUser, 'pass'))
    .rejects.toThrow('Voter not verified');

  // Low reputation voter
  await expect(submitVote(result.id, lowRepUser, 'pass'))
    .rejects.toThrow('Reputation too low');
});
```

### Test: Weighted consensus requires 60% weighted votes

```typescript
test('weighted consensus with reputation', async () => {
  const result = await createEvalResult({ verdict: 'fail' });

  // High-rep user (weight 1.5) votes pass
  await submitVote(result.id, highRepUser, 'pass'); // 1.5
  // Normal users vote fail
  await submitVote(result.id, normalUser1, 'fail'); // 1.0
  await submitVote(result.id, normalUser2, 'fail'); // 1.0

  // Total: 3.5, pass: 1.5 (42%), fail: 2.0 (57%)
  const consensus = await getVoteConsensus(result.id);
  expect(consensus.verdict).toBeNull(); // No 60% consensus

  // Add another high-rep pass vote
  await submitVote(result.id, highRepUser2, 'pass'); // +1.5 = 3.0 pass

  // Total: 5.0, pass: 3.0 (60%), fail: 2.0 (40%)
  const consensus2 = await getVoteConsensus(result.id);
  expect(consensus2.verdict).toBe('pass');
});
```

### Test: Sybil prevention blocks new accounts

```typescript
test('accounts under 7 days cannot vote', async () => {
  const newUser = await createUser({ created_at: new Date() }); // Just created
  await verifyUserEmail(newUser.id);

  await expect(submitVote(result.id, newUser, 'pass'))
    .rejects.toThrow('Account must be 7+ days old to vote');
});
```

## Security Considerations

- **Sybil prevention:** 7-day account age + email/phone/OAuth verification
- **Reputation weighting:** Bad actors lose voting power over time
- **Rate limiting:** Per-endpoint limits (see API routes)
- **Audit logging:** All verdicts, votes, disputes logged immutably
- **Admin-only access:** Review queue restricted to admin/expert roles
- **Input sanitization:** All user input sanitized before storage
- **Optimistic locking:** Prevents concurrent claim conflicts

## Operational Considerations

### SLA and Staffing

| Queue Reason | SLA Target | Priority |
|--------------|------------|----------|
| Disputed | 48 hours | High (3) |
| Low confidence | 7 days | Medium (2) |
| Spot check | 14 days | Low (1) |

**Estimated throughput:**
- 51 test cases × 20 models = 1,020 results per full eval
- ~30% low confidence (at 0.7 threshold) = ~300 escalations per eval
- With 5 admins reviewing 10/hour = 6 hours to clear backlog

### Backlog Alerts

- Alert at 100+ pending items
- Alert when SLA breach imminent (<4h remaining)
- Daily digest email to admin team

## Acceptance Criteria

- [ ] LLM judge replaces heuristic grader with confidence scores
- [ ] Low-confidence results (<0.7) auto-quarantine and escalate
- [ ] Quarantined results excluded from published scores
- [ ] Admin can view and process review queue with SLA tracking
- [ ] Human verdicts create immutable audit trail
- [ ] Optimistic locking prevents concurrent claim conflicts
- [ ] "Dispute this result" button quarantines and escalates
- [ ] Community voting with reputation weighting (60% weighted consensus)
- [ ] Sybil prevention: 7-day age + verification required
- [ ] Scores recalculate after human reviews clear quarantine
- [ ] Verification stats displayed on model pages
- [ ] Stratified spot-check sampling (5% weekly)
- [ ] Agreement rate tracking for quality metrics
- [ ] All actions logged to audit_log table

## Dependencies

- Requires Phase 1 (Database + API) — complete
- Requires eval engine — complete
- Benefits from Phase 4 (Email) for dispute notifications

## Cost Estimate

- LLM Judge API costs: ~$0.01-0.05 per evaluation (depends on model)
- 51 test cases × 20 models = 1,020 LLM judge calls per full eval
- Estimated: $10-50 per full evaluation run
- Human review: ~300 items × 2 min = 10 hours admin time per full eval

---

## Codex Review Findings (2026-03-23)

### CRITICAL — Fixed
1. ✅ **Data integrity log gap** — Added immutable `human_reviews` table with required reasoning
2. ✅ **Sybil-vulnerable community voting** — Added reputation weighting, 7-day account age, weighted 60% consensus
3. ✅ **Unreviewed low-confidence in scores** — Added `is_quarantined` flag and gating logic

### WARNING — Fixed
1. ✅ **Missing concurrency controls** — Added optimistic locking with version field
2. ✅ **Lack of reviewer provenance** — Required reasoning in human_reviews table
3. ✅ **Undefined spot-check sampling** — Added stratified sampling with reproducible seed
4. ✅ **Missing RBAC** — Added role-based middleware and rate limiting
5. ✅ **Missing throughput modeling** — Added SLA targets and staffing estimates

### PRAISE — Preserved
- Layered review approach with multiple verification levels
- Clear UX flows for admin queue and dispute handling
