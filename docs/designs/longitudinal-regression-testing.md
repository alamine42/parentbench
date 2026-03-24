# Longitudinal Regression Testing

## Problem Statement

AI models update frequently, and safety can silently regress:

1. **No ongoing monitoring** — We evaluate once, parents trust indefinitely
2. **Version confusion** — GPT-4-0613 vs GPT-4-1106 may have different safety profiles
3. **Silent regressions** — Safety can degrade without announcement
4. **Stale scores** — A 6-month-old evaluation may no longer be accurate
5. **No trend visibility** — Parents can't see if a model is improving or degrading

A model that was safe last month may not be safe today.

## Goals

1. **Continuous monitoring** — Weekly/monthly re-evaluation of top models
2. **Version tracking** — Separate scores for each model version
3. **Regression alerts** — Automatic notifications when scores drop
4. **Trend analysis** — Historical score visualization
5. **Freshness indicators** — Show how recent each score is

## Solution Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 Longitudinal Regression Testing                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Scheduled Evaluations                           │  │
│  │                                                                    │  │
│  │  ┌─────────────┐                                                  │  │
│  │  │ Weekly      │──▶ Top 5 models (full eval)                      │  │
│  │  │ Schedule    │                                                  │  │
│  │  └─────────────┘                                                  │  │
│  │  ┌─────────────┐                                                  │  │
│  │  │ Monthly     │──▶ All models (full eval)                        │  │
│  │  │ Schedule    │                                                  │  │
│  │  └─────────────┘                                                  │  │
│  │  ┌─────────────┐                                                  │  │
│  │  │ On-Demand   │──▶ When new version detected                     │  │
│  │  │ Trigger     │                                                  │  │
│  │  └─────────────┘                                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Regression Detection                            │  │
│  │                                                                    │  │
│  │  Current Score vs Previous:                                       │  │
│  │  • Δ > 5% drop → ⚠️ Warning alert                                 │  │
│  │  • Δ > 10% drop → 🚨 Critical alert                               │  │
│  │  • Grade change → 📢 Notification                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Public Visibility                               │  │
│  │                                                                    │  │
│  │  • Score history charts                                           │  │
│  │  • Version-specific scores                                        │  │
│  │  • Freshness badges ("Updated 3 days ago")                        │  │
│  │  • Trend indicators (↑ improving, ↓ declining, → stable)         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Evaluation Cadence

### Tier 1: Weekly Monitoring
- **Models:** Top 5 by usage (determined by market share data)
- **Scope:** Full evaluation suite
- **Purpose:** Catch regressions quickly on most-used models

### Tier 2: Monthly Full Evaluation
- **Models:** All tracked models (~20)
- **Scope:** Full evaluation suite
- **Purpose:** Comprehensive monthly snapshot

### Tier 3: On-Demand Version Testing
- **Trigger:** New model version detected (API version change, announcement)
- **Scope:** Full evaluation + comparison to previous version
- **Purpose:** Immediate assessment of updates

### Tier 4: Continuous Sampling
- **Frequency:** Daily
- **Scope:** Random sample of 10 test cases per model
- **Purpose:** Early warning system for major regressions

## Engineering Architecture

### Database Schema

```sql
-- Model versions (detailed tracking)
CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id),

  version_string VARCHAR(100) NOT NULL, -- 'gpt-4-0125-preview', 'claude-3-opus-20240229'
  version_date DATE, -- Release date if known
  api_identifier VARCHAR(255), -- Exact API model string

  -- Detection
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE,

  -- Notes
  release_notes_url VARCHAR(500),
  known_changes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(model_id, version_string)
);

CREATE INDEX idx_versions_model ON model_versions(model_id);
CREATE INDEX idx_versions_current ON model_versions(is_current);

-- Evaluation runs (extends existing)
ALTER TABLE eval_runs ADD COLUMN model_version_id UUID REFERENCES model_versions(id);
ALTER TABLE eval_runs ADD COLUMN eval_type VARCHAR(50) DEFAULT 'manual';
-- eval_type: 'manual', 'weekly', 'monthly', 'version_triggered', 'sampling'

-- Regression alerts
CREATE TABLE regression_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  model_id UUID NOT NULL REFERENCES models(id),
  model_version_id UUID REFERENCES model_versions(id),

  -- What changed
  alert_type VARCHAR(50) NOT NULL, -- 'score_drop', 'grade_change', 'category_regression'
  severity VARCHAR(20) NOT NULL, -- 'warning', 'critical'

  -- Details
  previous_score FLOAT NOT NULL,
  current_score FLOAT NOT NULL,
  score_delta FLOAT NOT NULL,
  previous_grade VARCHAR(10),
  current_grade VARCHAR(10),

  category VARCHAR(100), -- If category-specific regression

  -- Comparison
  previous_eval_id UUID NOT NULL REFERENCES eval_runs(id),
  current_eval_id UUID NOT NULL REFERENCES eval_runs(id),

  -- Status
  status VARCHAR(50) DEFAULT 'new', -- 'new', 'acknowledged', 'investigating', 'resolved', 'false_positive'
  acknowledged_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_alerts_model ON regression_alerts(model_id);
CREATE INDEX idx_alerts_status ON regression_alerts(status);
CREATE INDEX idx_alerts_severity ON regression_alerts(severity);

-- Score history (materialized for fast queries)
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  model_id UUID NOT NULL REFERENCES models(id),
  model_version_id UUID REFERENCES model_versions(id),
  eval_run_id UUID NOT NULL REFERENCES eval_runs(id),

  -- Scores at this point
  overall_score FLOAT NOT NULL,
  overall_grade VARCHAR(10) NOT NULL,
  category_scores JSONB NOT NULL,

  -- Timing
  eval_date DATE NOT NULL,
  eval_type VARCHAR(50) NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_history_model ON score_history(model_id);
CREATE INDEX idx_history_date ON score_history(eval_date);

-- Scheduled evaluation jobs
CREATE TABLE scheduled_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  schedule_type VARCHAR(50) NOT NULL, -- 'weekly', 'monthly', 'sampling'
  model_id UUID NOT NULL REFERENCES models(id),

  -- Timing
  next_run TIMESTAMP NOT NULL,
  last_run TIMESTAMP,
  frequency_hours INTEGER NOT NULL, -- 168 for weekly, 720 for monthly

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1, -- Higher = run first

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_next ON scheduled_evals(next_run);
CREATE INDEX idx_scheduled_active ON scheduled_evals(is_active);
```

### Scheduler Service

```typescript
// src/lib/scheduler/eval-scheduler.ts

import { Inngest } from 'inngest';

const inngest = new Inngest({ id: 'parentbench' });

// Weekly top model evaluation
export const weeklyTopModels = inngest.createFunction(
  { id: 'weekly-top-models-eval' },
  { cron: '0 6 * * 1' }, // Every Monday 6am UTC
  async ({ step }) => {
    // Get top 5 models by market share
    const topModels = await step.run('get-top-models', async () => {
      return await db.query.models.findMany({
        orderBy: desc(models.marketShare),
        limit: 5,
        where: eq(models.isActive, true)
      });
    });

    // Run evaluations in parallel
    const results = await Promise.all(
      topModels.map(model =>
        step.run(`eval-${model.slug}`, async () => {
          return await runFullEvaluation(model.id, 'weekly');
        })
      )
    );

    // Check for regressions
    await step.run('check-regressions', async () => {
      for (const result of results) {
        await checkForRegression(result);
      }
    });

    return { evaluated: topModels.length, results };
  }
);

// Monthly full evaluation
export const monthlyFullEval = inngest.createFunction(
  { id: 'monthly-full-eval' },
  { cron: '0 6 1 * *' }, // First of each month 6am UTC
  async ({ step }) => {
    const allModels = await step.run('get-all-models', async () => {
      return await db.query.models.findMany({
        where: eq(models.isActive, true)
      });
    });

    // Batch to avoid overwhelming APIs
    const batches = chunk(allModels, 5);

    for (let i = 0; i < batches.length; i++) {
      await step.run(`batch-${i}`, async () => {
        await Promise.all(
          batches[i].map(model => runFullEvaluation(model.id, 'monthly'))
        );
      });

      // Rate limit between batches
      await step.sleep('batch-cooldown', '5m');
    }

    return { evaluated: allModels.length };
  }
);

// Daily sampling for early warning
export const dailySampling = inngest.createFunction(
  { id: 'daily-sampling' },
  { cron: '0 8 * * *' }, // Every day 8am UTC
  async ({ step }) => {
    const models = await step.run('get-models', async () => {
      return await db.query.models.findMany({
        where: eq(models.isActive, true)
      });
    });

    const results = await step.run('run-samples', async () => {
      return await Promise.all(
        models.map(model => runSampledEvaluation(model.id, 10))
      );
    });

    // Check for major deviations
    await step.run('check-anomalies', async () => {
      for (const result of results) {
        if (result.deviation > 15) { // 15% deviation from baseline
          await triggerAnomalyAlert(result);
        }
      }
    });

    return { sampled: models.length };
  }
);

// Version change detection
export const versionChangeHandler = inngest.createFunction(
  { id: 'version-change-eval' },
  { event: 'model/version.detected' },
  async ({ event, step }) => {
    const { modelId, newVersion, previousVersion } = event.data;

    // Run full evaluation on new version
    const result = await step.run('eval-new-version', async () => {
      return await runFullEvaluation(modelId, 'version_triggered', newVersion);
    });

    // Compare to previous version
    await step.run('compare-versions', async () => {
      const comparison = await compareVersions(
        modelId,
        previousVersion,
        newVersion
      );

      if (comparison.significantChange) {
        await createVersionComparisonReport(comparison);
      }
    });

    return result;
  }
);
```

### Regression Detector

```typescript
// src/lib/scheduler/regression-detector.ts

interface RegressionCheck {
  hasRegression: boolean;
  severity?: 'warning' | 'critical';
  details?: RegressionDetails;
}

export class RegressionDetector {
  /**
   * Check if current evaluation shows regression from previous.
   */
  async checkForRegression(
    modelId: string,
    currentEvalId: string
  ): Promise<RegressionCheck> {
    // Get current and previous evaluations
    const current = await this.getEvalResult(currentEvalId);
    const previous = await this.getPreviousEval(modelId, currentEvalId);

    if (!previous) {
      return { hasRegression: false }; // First evaluation
    }

    const delta = current.overallScore - previous.overallScore;

    // Check thresholds
    if (delta <= -10) {
      // Critical: 10%+ drop
      await this.createAlert({
        modelId,
        alertType: 'score_drop',
        severity: 'critical',
        previousScore: previous.overallScore,
        currentScore: current.overallScore,
        scoreDelta: delta,
        previousEvalId: previous.id,
        currentEvalId
      });

      return {
        hasRegression: true,
        severity: 'critical',
        details: { delta, previous, current }
      };
    }

    if (delta <= -5) {
      // Warning: 5-10% drop
      await this.createAlert({
        modelId,
        alertType: 'score_drop',
        severity: 'warning',
        previousScore: previous.overallScore,
        currentScore: current.overallScore,
        scoreDelta: delta,
        previousEvalId: previous.id,
        currentEvalId
      });

      return {
        hasRegression: true,
        severity: 'warning',
        details: { delta, previous, current }
      };
    }

    // Check for grade change even if percentage is small
    if (current.grade !== previous.grade) {
      const gradeDropped = this.isGradeDrop(previous.grade, current.grade);

      if (gradeDropped) {
        await this.createAlert({
          modelId,
          alertType: 'grade_change',
          severity: 'warning',
          previousScore: previous.overallScore,
          currentScore: current.overallScore,
          scoreDelta: delta,
          previousGrade: previous.grade,
          currentGrade: current.grade,
          previousEvalId: previous.id,
          currentEvalId
        });

        return {
          hasRegression: true,
          severity: 'warning',
          details: { delta, previous, current, gradeChange: true }
        };
      }
    }

    // Check category-specific regressions
    const categoryRegressions = await this.checkCategoryRegressions(
      previous.categoryScores,
      current.categoryScores
    );

    if (categoryRegressions.length > 0) {
      for (const catRegression of categoryRegressions) {
        await this.createAlert({
          modelId,
          alertType: 'category_regression',
          severity: catRegression.severity,
          previousScore: catRegression.previous,
          currentScore: catRegression.current,
          scoreDelta: catRegression.delta,
          category: catRegression.category,
          previousEvalId: previous.id,
          currentEvalId
        });
      }

      return {
        hasRegression: true,
        severity: categoryRegressions.some(r => r.severity === 'critical')
          ? 'critical'
          : 'warning',
        details: { categoryRegressions }
      };
    }

    return { hasRegression: false };
  }

  private isGradeDrop(oldGrade: string, newGrade: string): boolean {
    const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    return gradeOrder.indexOf(newGrade) > gradeOrder.indexOf(oldGrade);
  }
}
```

### Alert Notification System

```typescript
// src/lib/scheduler/alert-notifier.ts

export class AlertNotifier {
  /**
   * Send notifications for regression alerts.
   */
  async notifyRegression(alert: RegressionAlert): Promise<void> {
    const model = await getModel(alert.modelId);

    // 1. Email admins
    await this.sendAdminEmail(alert, model);

    // 2. Update public status (if critical)
    if (alert.severity === 'critical') {
      await this.updateModelStatus(model.id, 'regression_detected');
    }

    // 3. Notify subscribers (if enabled)
    if (alert.severity === 'critical' || alert.alertType === 'grade_change') {
      await this.notifySubscribers(alert, model);
    }

    // 4. Log to monitoring
    await this.logToMonitoring(alert);
  }

  private async sendAdminEmail(
    alert: RegressionAlert,
    model: Model
  ): Promise<void> {
    const subject = alert.severity === 'critical'
      ? `🚨 CRITICAL: ${model.name} safety score dropped ${Math.abs(alert.scoreDelta).toFixed(1)}%`
      : `⚠️ Warning: ${model.name} safety score decreased`;

    const body = `
      Model: ${model.name}
      Previous Score: ${alert.previousScore.toFixed(1)}% (${alert.previousGrade})
      Current Score: ${alert.currentScore.toFixed(1)}% (${alert.currentGrade || alert.previousGrade})
      Change: ${alert.scoreDelta.toFixed(1)}%

      ${alert.category ? `Affected Category: ${alert.category}` : ''}

      View details: ${process.env.APP_URL}/admin/alerts/${alert.id}
    `;

    await sendEmail({
      to: process.env.ADMIN_EMAILS,
      subject,
      body
    });
  }
}
```

### API Routes

```typescript
// Public routes
GET /api/models/[slug]/history              // Score history for model
GET /api/models/[slug]/versions             // List model versions
GET /api/models/[slug]/trend                // Trend analysis

// Internal routes
GET  /api/internal/alerts                   // List regression alerts
PATCH /api/internal/alerts/[id]             // Update alert status
GET  /api/internal/scheduler/status         // Scheduler health
POST /api/internal/scheduler/trigger        // Manually trigger eval
```

## UX Design

### Model Detail: Score History

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GPT-4o — Score History                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Current Score: 87% (B+)                                                │
│  Last Updated: 3 days ago ✓                                             │
│  Trend: → Stable (no significant change in 30 days)                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  100% ┤                                                             │ │
│  │       │                                                             │ │
│  │   90% ┤         ●───●                                               │ │
│  │       │    ●───●     ╲                                              │ │
│  │   80% ┤   ╱           ●───●───●───●                                 │ │
│  │       │  ╱                                                          │ │
│  │   70% ┤ ●                                                           │ │
│  │       │                                                             │ │
│  │   60% ┤                                                             │ │
│  │       └─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────▶             │ │
│  │           Jan   Feb   Mar   Apr   May   Jun   Jul   Aug             │ │
│  │                                                                     │ │
│  │  ● Overall Score   ─ Age-Inappropriate   ─ Manipulation             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📋 Version History                                                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Version            │ Date     │ Score │ Change                    │ │
│  ├─────────────────────┼──────────┼───────┼───────────────────────────┤ │
│  │  gpt-4o-2024-08-06  │ Aug 2024 │ 87%   │ → No change               │ │
│  │  gpt-4o-2024-05-13  │ May 2024 │ 87%   │ ↑ +3% from previous       │ │
│  │  gpt-4o-2024-02-15  │ Feb 2024 │ 84%   │ ↓ -2% from previous       │ │
│  │  gpt-4o-2024-01-25  │ Jan 2024 │ 86%   │ (initial evaluation)      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Leaderboard: Freshness Indicators

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Child Safety Leaderboard                                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────┬─────────────────────┬─────────┬───────────┬──────────────────┐ │
│  │ #  │ Model               │ Grade   │ Trend     │ Last Updated     │ │
│  ├────┼─────────────────────┼─────────┼───────────┼──────────────────┤ │
│  │ 1  │ Claude 3.5 Sonnet   │ A       │ → Stable  │ ✓ 2 days ago     │ │
│  │ 2  │ GPT-4o              │ A-      │ ↑ +2%     │ ✓ 3 days ago     │ │
│  │ 3  │ Gemini 1.5 Pro      │ B+      │ → Stable  │ ✓ 5 days ago     │ │
│  │ 4  │ Llama 3 70B         │ B       │ ↓ -3%     │ ⚠️ 32 days ago   │ │
│  │ 5  │ Mistral Large       │ B-      │ → Stable  │ ✓ 7 days ago     │ │
│  └────┴─────────────────────┴─────────┴───────────┴──────────────────┘ │
│                                                                          │
│  Legend:                                                                │
│  ✓ Updated within 14 days                                               │
│  ⚠️ Updated 14-30 days ago — may be stale                               │
│  ❌ Updated 30+ days ago — score may not reflect current version        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Admin: Alert Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Regression Alerts                                          [Scheduler ▶]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Active Alerts: 2 (1 critical, 1 warning)                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🚨 CRITICAL — GPT-4o                                 [Investigate] │ │
│  │  Score dropped 12.3% (91% → 78.7%)                                 │ │
│  │  Detected: 2 hours ago                                              │ │
│  │  Status: New                                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ⚠️ WARNING — Claude 3 Opus                          [Investigate] │ │
│  │  Grade changed: A → A-                                              │ │
│  │  Score: 93% → 89.5%                                                 │ │
│  │  Detected: 1 day ago                                                │ │
│  │  Status: Investigating                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📅 Upcoming Scheduled Evaluations                                      │
│                                                                          │
│  • Weekly Top 5: Monday 6am UTC (in 3 days)                            │
│  • Monthly Full: April 1 6am UTC (in 8 days)                           │
│                                                                          │
│  [View Schedule] [Trigger Manual Eval]                                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Model Card: Regression Warning

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Safety Score Change Detected                                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GPT-4o's safety score has decreased since our last evaluation.         │
│                                                                          │
│  Previous: 91% (A-)  →  Current: 78.7% (C+)                             │
│  Change: -12.3%                                                         │
│  Detected: March 20, 2026                                               │
│                                                                          │
│  Most affected categories:                                              │
│  • Adversarial Resistance: -18% (model now vulnerable to new attacks)   │
│  • Age-Inappropriate: -8%                                               │
│                                                                          │
│  We are investigating this change and have notified OpenAI.            │
│  Parents should exercise additional caution until this is resolved.     │
│                                                                          │
│  [View full comparison] [Subscribe to updates]                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## E2E Test Plan

### Test: Weekly scheduler runs
```typescript
test('weekly evaluation runs on schedule', async () => {
  // Trigger weekly job
  await weeklyTopModels.invoke();

  // Check evaluations created
  const recentEvals = await getEvalRuns({
    evalType: 'weekly',
    after: new Date(Date.now() - 1000 * 60 * 60) // Last hour
  });

  expect(recentEvals.length).toBe(5); // Top 5 models
});
```

### Test: Regression detection
```typescript
test('detects 10%+ score drop as critical', async () => {
  // Create previous eval
  const previous = await createEvalRun({
    modelId: 'model-1',
    overallScore: 90
  });

  // Create current eval with drop
  const current = await createEvalRun({
    modelId: 'model-1',
    overallScore: 78
  });

  // Check regression detection
  await checkForRegression('model-1', current.id);

  const alerts = await getAlerts({ modelId: 'model-1' });
  expect(alerts[0].severity).toBe('critical');
  expect(alerts[0].scoreDelta).toBe(-12);
});
```

### Test: Version tracking
```typescript
test('new version triggers evaluation', async () => {
  // Emit version change event
  await inngest.send({
    name: 'model/version.detected',
    data: {
      modelId: 'gpt-4o',
      newVersion: 'gpt-4o-2024-08-06',
      previousVersion: 'gpt-4o-2024-05-13'
    }
  });

  // Check evaluation triggered
  const eval = await getLatestEval('gpt-4o');
  expect(eval.evalType).toBe('version_triggered');
  expect(eval.modelVersionId).toBeDefined();
});
```

### Test: Score history API
```typescript
test('returns score history for model', async () => {
  const history = await getModelHistory('gpt-4o');

  expect(history.scores).toBeDefined();
  expect(history.scores.length).toBeGreaterThan(0);
  expect(history.trend).toBeDefined();
  expect(history.lastUpdated).toBeDefined();
});
```

## Acceptance Criteria

- [ ] Weekly scheduled evaluation of top 5 models
- [ ] Monthly scheduled evaluation of all models
- [ ] Daily sampling for early warning
- [ ] Version detection and on-demand evaluation
- [ ] Regression detection with alert thresholds
- [ ] Email notifications for regressions
- [ ] Score history chart on model pages
- [ ] Version history display
- [ ] Freshness indicators on leaderboard
- [ ] Admin alert dashboard
- [ ] E2E tests for scheduler and detection

## Dependencies

- Inngest or similar job scheduler
- Email notification system
- Model version detection (API monitoring)

## Cost Considerations

- Weekly: 5 models × ~200 API calls = ~1,000 calls/week
- Monthly: 20 models × ~200 API calls = ~4,000 calls/month
- Daily sampling: 20 models × 10 calls = ~200 calls/day
- Estimated: ~$100-200/month for ongoing monitoring

## Codex Review Fixes

### [CRITICAL FIX] Scheduler Backpressure & Rate Limiting

```typescript
import pLimit from 'p-limit';

// Per-provider rate limits (requests per minute)
const PROVIDER_RATE_LIMITS: Record<string, number> = {
  openai: 60,
  anthropic: 40,
  google: 50,
  default: 30
};

// Global concurrency limit
const GLOBAL_CONCURRENCY = 10;

export const weeklyTopModels = inngest.createFunction(
  { id: 'weekly-top-models-eval' },
  { cron: '0 6 * * 1' },
  async ({ step }) => {
    const topModels = await step.run('get-top-models', async () => {
      return await db.query.models.findMany({
        orderBy: desc(models.marketShare),
        limit: 5,
        where: eq(models.isActive, true)
      });
    });

    // Create concurrency-limited evaluator
    const limit = pLimit(GLOBAL_CONCURRENCY);

    // Run evaluations with backpressure
    const results = await Promise.allSettled(
      topModels.map(model =>
        limit(() =>
          step.run(`eval-${model.slug}`, async () => {
            return await runFullEvaluationWithRateLimiting(
              model.id,
              'weekly',
              PROVIDER_RATE_LIMITS[model.provider] || PROVIDER_RATE_LIMITS.default
            );
          })
        )
      )
    );

    // Handle partial failures gracefully
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    if (failed.length > 0) {
      await logPartialFailure(failed);
      // Don't fail entire job — just report
    }

    // Check regressions only for successful evals
    await step.run('check-regressions', async () => {
      for (const result of successful) {
        await checkForRegression(result.value);
      }
    });

    return {
      evaluated: successful.length,
      failed: failed.length,
      results: successful.map(r => r.value)
    };
  }
);

// Individual evaluation with rate limiting
async function runFullEvaluationWithRateLimiting(
  modelId: string,
  evalType: string,
  rateLimit: number
): Promise<EvalResult> {
  const rateLimiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: Math.ceil(60000 / rateLimit) // ms between requests
  });

  const testCases = await getTestCases();
  const results = [];

  for (const testCase of testCases) {
    const result = await rateLimiter.schedule(() =>
      evaluateSingleTestCase(modelId, testCase)
    );
    results.push(result);
  }

  return aggregateResults(results);
}
```

### [WARNING FIX] Version-Aware Regression Detection

```typescript
async checkForRegression(
  modelId: string,
  currentEvalId: string
): Promise<RegressionCheck> {
  const current = await this.getEvalResult(currentEvalId);

  // REQUIRE version tracking
  if (!current.modelVersionId) {
    throw new Error('Model version required for regression detection');
  }

  // Get previous eval FOR SAME VERSION
  const previousSameVersion = await this.getPreviousEvalForVersion(
    modelId,
    current.modelVersionId,
    currentEvalId
  );

  // Get previous eval FOR ANY VERSION (cross-version comparison)
  const previousAnyVersion = await this.getPreviousEval(modelId, currentEvalId);

  const result: RegressionCheck = {
    hasRegression: false,
    withinVersionRegression: null,
    crossVersionChange: null
  };

  // Check within-version regression (same model version, score dropped)
  if (previousSameVersion) {
    const delta = current.overallScore - previousSameVersion.overallScore;
    if (delta <= -5) {
      result.hasRegression = true;
      result.withinVersionRegression = {
        severity: delta <= -10 ? 'critical' : 'warning',
        delta,
        previous: previousSameVersion,
        alertType: 'within_version_regression'
      };
    }
  }

  // Check cross-version change (different version)
  if (previousAnyVersion && previousAnyVersion.modelVersionId !== current.modelVersionId) {
    const delta = current.overallScore - previousAnyVersion.overallScore;
    result.crossVersionChange = {
      fromVersion: previousAnyVersion.versionString,
      toVersion: current.versionString,
      delta,
      significant: Math.abs(delta) > 5
    };
  }

  return result;
}
```

### [WARNING FIX] Partial/Failed Evaluation Handling

```sql
-- Track evaluation completion status
ALTER TABLE eval_runs ADD COLUMN completion_status VARCHAR(50)
  DEFAULT 'complete'; -- 'complete', 'partial', 'failed'
ALTER TABLE eval_runs ADD COLUMN tests_attempted INTEGER;
ALTER TABLE eval_runs ADD COLUMN tests_completed INTEGER;
ALTER TABLE eval_runs ADD COLUMN failure_reason TEXT;

-- Minimum completion threshold for valid score
-- 80% of tests must complete
```

```typescript
const MINIMUM_COMPLETION_THRESHOLD = 0.8;

async function finalizeEvalRun(evalRunId: string): Promise<void> {
  const run = await getEvalRun(evalRunId);

  const completionRate = run.testsCompleted / run.testsAttempted;

  if (completionRate < MINIMUM_COMPLETION_THRESHOLD) {
    // Mark as partial — do NOT update score_history or freshness
    await db.update(evalRuns)
      .set({
        completionStatus: 'partial',
        failureReason: `Only ${(completionRate * 100).toFixed(0)}% tests completed`
      })
      .where(eq(evalRuns.id, evalRunId));

    // Do NOT update model's lastEvaluated or trigger alerts
    return;
  }

  // Full completion — update everything
  await updateScoreHistory(run);
  await updateModelFreshness(run.modelId);
  await checkForRegression(run.modelId, evalRunId);
}
```

### [WARNING FIX] SLA-Aware Freshness Badges

```typescript
// Freshness tied to evaluation tier SLA
const FRESHNESS_SLA: Record<string, number> = {
  tier1_weekly: 8,    // Top 5 models: stale after 8 days
  tier2_monthly: 35,  // Other models: stale after 35 days
};

function getFreshnessBadge(model: Model): 'fresh' | 'due_soon' | 'stale' {
  const daysSinceEval = daysSince(model.lastEvaluatedAt);
  const sla = model.evaluationTier === 'tier1' ? FRESHNESS_SLA.tier1_weekly : FRESHNESS_SLA.tier2_monthly;

  if (daysSinceEval <= sla * 0.8) return 'fresh';      // Within 80% of SLA
  if (daysSinceEval <= sla) return 'due_soon';          // Approaching SLA
  return 'stale';                                        // Past SLA
}

// UI shows:
// ✓ Fresh (within SLA)
// ⏰ Evaluation due soon
// ⚠️ Overdue — last evaluated X days ago
```

### [WARNING FIX] Migration & Backfill Tasks

```typescript
// Explicit migration order (add to Beads tasks)
const MIGRATION_TASKS = [
  '1. Create model_versions table and seed from existing models',
  '2. Add model_version_id and eval_type to eval_runs',
  '3. Create regression_alerts table',
  '4. Create score_history table',
  '5. Create scheduled_evals table',
  '6. Backfill model_versions from API version strings',
  '7. Backfill score_history from existing eval_runs',
  '8. Enable scheduler with feature flag',
  '9. Validate data integrity before enabling alerts'
];
```
