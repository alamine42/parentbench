# Evaluation Statistical Robustness Design

**Epic:** `parentbench-er1`
**Status:** Ready for Implementation
**Author:** Claude
**Date:** 2026-04-10
**Reviewed:** Codex adversarial review (2026-04-10)

## Problem Statement

Analysis of 71 evaluations across 34 models revealed significant score variance between runs:
- High variance (>40 pts): Claude Haiku 4.5, GPT-5.4 mini
- Medium variance (20-40 pts): Claude Opus, GPT-4.1, Sonnet
- Low variance (<20 pts): Gemini Flash-Lite, Gemini Pro

Current single-run evaluations create unfair rankings, indefensible scores, and missed regressions.

## Solution

Run each model evaluation **3 times** and use the **median** score as the official result.

---

## Database Schema

```sql
-- New table: score_batches
CREATE TABLE score_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,

  -- Version pinning (CRITICAL: prevents mixing methodology versions)
  methodology_version TEXT NOT NULL,      -- e.g., "2026-04-01"
  test_suite_hash TEXT NOT NULL,          -- SHA256 of active test case IDs
  model_version TEXT,                     -- Provider's model version if known

  -- Aggregated results
  median_score REAL,
  min_score REAL,
  max_score REAL,
  variance REAL,
  confidence TEXT,  -- 'high', 'medium', 'low'

  -- Status tracking
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed', 'failed'
  target_runs INTEGER DEFAULT 3,
  completed_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,          -- Track failures (WARNING fix)
  max_runs INTEGER DEFAULT 5,             -- Cap for drift detection (SUGGESTION fix)

  -- Error handling
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  triggered_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX idx_score_batches_model_status ON score_batches(model_id, status);
CREATE INDEX idx_score_batches_created ON score_batches(created_at DESC);

-- Add to evaluations table
ALTER TABLE evaluations ADD COLUMN score_batch_id UUID REFERENCES score_batches(id);
ALTER TABLE evaluations ADD COLUMN run_number INTEGER;

-- Add to scores table (NO run_scores JSONB - avoid duplication per WARNING)
ALTER TABLE scores ADD COLUMN variance REAL;
ALTER TABLE scores ADD COLUMN confidence TEXT;
ALTER TABLE scores ADD COLUMN score_batch_id UUID REFERENCES score_batches(id);
-- run_scores removed: query evaluations table instead
```

### Schema Notes (from Codex review)

1. **Methodology versioning** - Each batch pins `methodology_version` and `test_suite_hash` at creation. Runs whose versions don't match are rejected.

2. **No duplicate run_scores** - Run scores live in `evaluations` table only. UI queries evaluations via `score_batch_id` for tooltips.

3. **Failure tracking** - `failed_runs`, `last_error`, `retry_count` enable proper error handling.

4. **Run cap** - `max_runs` (default 5) prevents infinite drift loops.

---

## Version Pinning (CRITICAL)

To prevent mixing methodology versions within a batch:

```typescript
async function createBatch(modelId: string, triggeredBy: string) {
  // Snapshot current methodology
  const activeTestCases = await db.select().from(testCases)
    .where(eq(testCases.isActive, true));

  const testSuiteHash = crypto
    .createHash('sha256')
    .update(activeTestCases.map(t => t.id).sort().join(','))
    .digest('hex');

  const methodologyVersion = await getMethodologyVersion(); // from methodology.json

  const [batch] = await db.insert(scoreBatches).values({
    modelId,
    methodologyVersion,
    testSuiteHash,
    triggeredBy,
    status: 'pending',
  }).returning();

  return batch;
}

async function validateRunVersion(batchId: string) {
  const batch = await db.select().from(scoreBatches).where(eq(scoreBatches.id, batchId));
  const currentHash = await computeTestSuiteHash();

  if (batch.testSuiteHash !== currentHash) {
    throw new Error('Test suite changed since batch created. Requeue fresh batch.');
  }
}
```

---

## Failure & Retry Strategy (WARNING fix)

### Run Failure Handling

```typescript
async function handleRunFailure(batchId: string, error: string) {
  await db.update(scoreBatches)
    .set({
      failedRuns: sql`failed_runs + 1`,
      lastError: error,
      retryCount: sql`retry_count + 1`,
    })
    .where(eq(scoreBatches.id, batchId));

  const batch = await db.select().from(scoreBatches).where(eq(scoreBatches.id, batchId));

  // Auto-retry up to 3 times per failed run
  if (batch.retryCount < 3) {
    await inngest.send({
      name: "eval/requested",
      data: {
        modelId: batch.modelId,
        scoreBatchId: batchId,
        runNumber: batch.completedRuns + batch.failedRuns + 1,
        isRetry: true,
      }
    });
    return;
  }

  // Mark batch failed if retries exhausted
  if (batch.failedRuns >= batch.targetRuns) {
    await db.update(scoreBatches)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(scoreBatches.id, batchId));

    // Alert admins
    await inngest.send({
      name: "alert/batch-failed",
      data: { batchId, modelId: batch.modelId, error }
    });
  }
}
```

### Batch Status States

```
pending → in_progress → completed
                     ↘ failed (after 3 retries exhausted)
```

---

## Drift Detection (with run cap)

```typescript
const MAX_DRIFT_RUNS = 5;

async function checkForDrift(batchId: string, newRunScore: number): Promise<boolean> {
  const batch = await db.select().from(scoreBatches)
    .where(eq(scoreBatches.id, batchId));

  // Enforce run cap (SUGGESTION fix)
  const totalRuns = batch.completedRuns + batch.failedRuns;
  if (totalRuns >= batch.maxRuns) {
    console.warn(`Batch ${batchId} hit max runs (${batch.maxRuns}), skipping drift check`);
    await alertAdminHighVariance(batchId);
    return false;
  }

  const runs = await db.select().from(evaluations)
    .where(eq(evaluations.scoreBatchId, batchId));

  if (runs.length < 2) return false;

  const scores = runs
    .filter(r => r.status === 'completed')
    .map(r => r.overallScore)
    .sort((a, b) => a - b);

  const median = scores[Math.floor(scores.length / 2)];
  const drift = Math.abs(newRunScore - median);

  if (drift > 15) {
    // Queue additional run
    await db.update(scoreBatches)
      .set({ targetRuns: sql`target_runs + 1` })
      .where(eq(scoreBatches.id, batchId));

    await inngest.send({
      name: "eval/requested",
      data: {
        modelId: batch.modelId,
        scoreBatchId: batchId,
        runNumber: totalRuns + 1,
        triggeredBy: "drift",
      }
    });
    return true;
  }

  return false;
}
```

---

## UX: Accessible Confidence Indicators (WARNING fix)

### Desktop Table

```tsx
// Accessible confidence indicator - NOT color-only
function ConfidenceIndicator({ confidence, variance, runs }: Props) {
  const labels = {
    high: { icon: '●', color: 'text-green-600', label: 'High confidence' },
    medium: { icon: '●', color: 'text-yellow-600', label: 'Medium confidence' },
    low: { icon: '●', color: 'text-red-600', label: 'Low confidence' },
  };

  const { icon, color, label } = labels[confidence];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Accessible: includes sr-only text, keyboard focusable */}
        <button
          className={`${color} flex items-center gap-1`}
          aria-label={`${label}. Click for details.`}
        >
          <span aria-hidden="true">{icon}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {confidence}
          </span>
          <span className="sr-only">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            Variance: ±{variance.toFixed(1)} points
          </p>
          <div className="text-sm">
            <p className="font-medium">Individual runs:</p>
            <ul className="list-disc pl-4">
              {runs.map((score, i) => (
                <li key={i}>Run {i + 1}: {score.toFixed(1)}</li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Mobile: Expandable Row (not tooltip)

```tsx
// Mobile: tap-to-expand pattern instead of tooltip
function MobileScoreCard({ model, score, confidence, runs }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex justify-between items-center">
          <span className="font-medium">{model.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{score.toFixed(1)}</span>
            <ConfidenceBadge confidence={confidence} />
            <ChevronDown className={expanded ? 'rotate-180' : ''} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-2">
          <p className="text-sm">
            <span className="font-medium">Confidence:</span> {confidence}
          </p>
          <p className="text-sm">
            <span className="font-medium">Variance:</span> ±{variance.toFixed(1)} pts
          </p>
          <div className="text-sm">
            <span className="font-medium">Runs:</span>
            <span className="ml-2">{runs.join(', ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### WCAG Compliance

- **1.4.1 Use of Color**: Text labels ("high", "medium", "low") accompany icons
- **2.1.1 Keyboard**: All interactive elements are focusable
- **4.1.2 Name, Role, Value**: aria-labels and aria-expanded provided
- **Touch targets**: Mobile uses tap-to-expand, not hover

---

## Migration & Backfill Plan (WARNING fix)

### Phase 1: Schema Migration

```sql
-- Add new columns with defaults
ALTER TABLE scores ADD COLUMN variance REAL DEFAULT NULL;
ALTER TABLE scores ADD COLUMN confidence TEXT DEFAULT 'legacy';
ALTER TABLE scores ADD COLUMN score_batch_id UUID DEFAULT NULL;

-- Create new table
CREATE TABLE score_batches (...);
```

### Phase 2: Mark Legacy Scores

```typescript
// Mark all existing scores as single-run with unknown confidence
await db.update(scores)
  .set({ confidence: 'legacy' })
  .where(isNull(scores.scoreBatchId));
```

### Phase 3: UI Handling for Legacy Scores

```tsx
function ConfidenceIndicator({ confidence }: Props) {
  if (confidence === 'legacy') {
    return (
      <span className="text-muted-foreground text-xs" title="Single-run score (legacy)">
        —
      </span>
    );
  }
  // ... normal display
}
```

### Phase 4: Gradual Backfill via Scheduled Evals

- Active tier models: New batches within 1 week
- Standard tier: New batches within 2 weeks
- Maintenance tier: New batches within 1 month

No forced re-evaluation needed—normal scheduled evals will populate batches.

---

## Evaluation Flow

```
eval/batch-requested
  → createEvaluationBatch
      - Pin methodology_version + test_suite_hash
      - Create score_batch record
  → eval/requested (run 1, 2, 3 in parallel or serial)
      - Validate version matches batch
      - Run evaluation
      - Update completed_runs
      - On failure: handleRunFailure (retry up to 3x)
  → eval/batch-completed (when completed_runs >= target_runs)
      - Compute median, variance, confidence
      - Check for drift (may add runs, up to max_runs=5)
      - Create score record
      - Send alerts if needed
```

---

## Priority Queue

| Priority | Tier | Behavior |
|----------|------|----------|
| 1 | active | Run immediately |
| 2 | standard | Queue behind active |
| 3 | maintenance | Queue behind standard |
| 4 | manual | Queue behind all |

Inngest config:
```typescript
concurrency: {
  limit: 5,
  key: "event.data.modelId", // Serialize runs for same model
},
priority: {
  run: "event.data.priority",
}
```

---

## E2E Tests

### 1. Score Batches
- Creates batch with 3 runs
- Computes median correctly
- Handles outliers with median (not mean)

### 2. Version Pinning
- Rejects runs with mismatched methodology version
- Requeues fresh batch when test suite changes

### 3. Failure Handling
- Retries failed runs up to 3 times
- Marks batch failed after retries exhausted
- Alerts admins on batch failure

### 4. Confidence Calculation
- High when variance < 5
- Medium when variance 5-15
- Low when variance > 15
- Legacy for pre-batch scores

### 5. Drift Detection
- Triggers extra run on >15pt drift
- Caps at max_runs (5)
- Alerts admin when cap reached

### 6. Priority Queue
- Active > standard > maintenance > manual
- Concurrency limit of 5
- Same-model serialization

### 7. Leaderboard Display
- Confidence indicators with text labels (a11y)
- Popover shows run details (desktop)
- Tap-to-expand on mobile
- Legacy scores show "—"

### 8. Migration
- Legacy scores marked correctly
- UI handles legacy gracefully
- New batches created on schedule

---

## Tasks (Updated)

| ID | Title | Priority | Blocks |
|----|-------|----------|--------|
| er1.1 | Implement multi-run score tracking | P1 | Schema + batch creation + version pinning |
| er1.2 | Compute and store median scores | P1 | Batch completion + failure handling | er1.1 |
| er1.3 | Add confidence indicators to leaderboard | P2 | Accessible UI + mobile | er1.2 |
| er1.4 | Implement score drift detection | P2 | Drift logic + run cap | er1.2 |
| er1.5 | Add evaluation queue with priorities | P2 | Inngest priority config |
| er1.6 | Migrate legacy scores | P1 | Schema migration + backfill | er1.1 |

---

## Codex Review Summary

| Finding | Severity | Status |
|---------|----------|--------|
| No methodology versioning | CRITICAL | ✅ Fixed: Added version pinning |
| No failure/retry strategy | WARNING | ✅ Fixed: Added failure handling |
| Duplicated run_scores | WARNING | ✅ Fixed: Removed from scores table |
| Accessibility issues | WARNING | ✅ Fixed: Text labels + tap-expand |
| No migration plan | WARNING | ✅ Fixed: Added backfill strategy |
| No drift run cap | SUGGESTION | ✅ Fixed: Added max_runs field |
