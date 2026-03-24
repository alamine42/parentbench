# Real-World Incident Correlation

## Problem Statement

Benchmarks are only valuable if they predict real harm. Currently:

1. **No validation** — We don't know if low scores correlate with actual incidents
2. **No incident tracking** — No systematic database of AI-child safety failures
3. **No feedback loop** — Real-world incidents don't inform test case development
4. **Skeptic vulnerability** — Critics can dismiss scores as "just a benchmark"

Without demonstrating predictive validity, ParentBench risks being ignored by both industry and regulators.

## Goals

1. **Incident database** — Track reported AI-child safety incidents from public sources
2. **Correlation analysis** — Measure relationship between benchmark scores and incident rates
3. **Incident-driven testing** — Generate test cases from real incidents
4. **Predictive validity metrics** — Publish correlation statistics
5. **Responsible reporting** — Handle sensitive incident data appropriately

## Solution Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 Incident Correlation System                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Incident Collection                             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                  │  │
│  │  │ News/Media  │ │ Academic    │ │ Direct      │                  │  │
│  │  │ Reports     │ │ Literature  │ │ Reports     │                  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                  │  │
│  │          │               │               │                         │  │
│  │          └───────────────┼───────────────┘                         │  │
│  │                          ▼                                         │  │
│  │              ┌───────────────────────┐                            │  │
│  │              │   Incident Database   │                            │  │
│  │              │   (anonymized)        │                            │  │
│  │              └───────────────────────┘                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Analysis & Feedback                             │  │
│  │                                                                    │  │
│  │  ┌─────────────────┐    ┌─────────────────┐                       │  │
│  │  │ Correlation     │    │ Test Case       │                       │  │
│  │  │ Analysis        │    │ Generation      │                       │  │
│  │  │ (score vs       │    │ (from real      │                       │  │
│  │  │ incidents)      │    │ incidents)      │                       │  │
│  │  └─────────────────┘    └─────────────────┘                       │  │
│  │          │                      │                                  │  │
│  │          ▼                      ▼                                  │  │
│  │  ┌─────────────────┐    ┌─────────────────┐                       │  │
│  │  │ Predictive      │    │ Updated Test    │                       │  │
│  │  │ Validity        │    │ Suite           │                       │  │
│  │  │ Reports         │    │                 │                       │  │
│  │  └─────────────────┘    └─────────────────┘                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Incident Taxonomy

### Incident Severity Levels

| Level | Description | Example |
|-------|-------------|---------|
| **Critical** | Direct harm to child | AI assisted self-harm, provided instructions for dangerous activity |
| **Severe** | High-risk content exposure | Explicit sexual content shown to child, detailed violence |
| **Moderate** | Inappropriate content/behavior | Age-inappropriate relationship advice, scary content to young child |
| **Low** | Minor safety lapse | Overshared information, mildly inappropriate joke |

### Incident Categories (aligned with our scoring)

| Category | Incident Types |
|----------|---------------|
| Age-Inappropriate Content | Sexual content exposure, graphic violence, drug glorification |
| Manipulation Resistance | Grooming-like behavior, emotional manipulation, parasocial exploitation |
| Data Privacy | PII extraction from child, location sharing, personal detail collection |
| Parental Controls | Bypassing restrictions, undermining parental authority |
| Adversarial Resistance | Jailbreak exploitation, prompt injection success |

### Data Sources

1. **News media** — Reported incidents (BBC, NYT, tech press)
2. **Academic literature** — Published research on AI harms
3. **Platform transparency reports** — When available
4. **Direct reports** — Responsible disclosure from researchers/parents
5. **Social media** — Documented incidents (verified only)

## Engineering Architecture

### Database Schema

```sql
-- Incident records (anonymized)
CREATE TABLE safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Incident identification
  incident_date DATE NOT NULL,
  reported_date DATE NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'news', 'academic', 'direct_report', 'social_media'
  source_url VARCHAR(500),
  source_citation TEXT,

  -- Model involved (if known)
  model_id UUID REFERENCES models(id),
  model_name VARCHAR(255), -- For models not in our DB
  model_version VARCHAR(100),

  -- Incident details
  category VARCHAR(100) NOT NULL REFERENCES categories(slug),
  severity VARCHAR(20) NOT NULL, -- 'critical', 'severe', 'moderate', 'low'
  incident_summary TEXT NOT NULL, -- Anonymized description
  harm_type VARCHAR(100) NOT NULL, -- 'content_exposure', 'manipulation', 'data_extraction', etc.

  -- Child context (anonymized)
  child_age_range VARCHAR(20), -- 'early_childhood', 'middle_childhood', etc.
  interaction_context VARCHAR(100), -- 'educational', 'entertainment', 'unsupervised'

  -- Verification
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'disputed', 'retracted'
  verified_by UUID REFERENCES users(id),
  verification_notes TEXT,

  -- Test case linkage
  derived_test_case_id UUID REFERENCES test_cases(id),

  -- Metadata
  is_public BOOLEAN DEFAULT FALSE, -- Only verified, non-sensitive incidents
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_incidents_model ON safety_incidents(model_id);
CREATE INDEX idx_incidents_category ON safety_incidents(category);
CREATE INDEX idx_incidents_severity ON safety_incidents(severity);
CREATE INDEX idx_incidents_date ON safety_incidents(incident_date);

-- Correlation analysis results
CREATE TABLE correlation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Analysis parameters
  analysis_date DATE NOT NULL,
  model_id UUID REFERENCES models(id), -- NULL for all-model analysis
  category VARCHAR(100) REFERENCES categories(slug), -- NULL for overall
  time_period_start DATE NOT NULL,
  time_period_end DATE NOT NULL,

  -- Results
  sample_size INTEGER NOT NULL, -- Number of incidents in analysis
  correlation_coefficient FLOAT, -- Pearson r between score and incident rate
  p_value FLOAT,
  confidence_interval JSONB, -- {lower: float, upper: float}

  -- Interpretation
  statistical_significance BOOLEAN,
  practical_significance VARCHAR(50), -- 'strong', 'moderate', 'weak', 'none'
  interpretation TEXT,

  -- Methodology
  methodology_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Incident-to-test-case derivation log
CREATE TABLE incident_derived_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES safety_incidents(id),
  test_case_id UUID NOT NULL REFERENCES test_cases(id),

  derivation_notes TEXT NOT NULL, -- How the test was derived
  abstraction_level VARCHAR(50), -- 'direct', 'generalized', 'pattern'

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(incident_id, test_case_id)
);

-- Predictive validity tracking
CREATE TABLE predictive_validity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  report_period VARCHAR(20) NOT NULL, -- 'Q1-2026', 'H1-2026', etc.
  report_type VARCHAR(50) NOT NULL, -- 'quarterly', 'annual'

  -- Key metrics
  overall_correlation FLOAT,
  overall_p_value FLOAT,
  models_analyzed INTEGER,
  incidents_analyzed INTEGER,

  -- Per-category correlations
  category_correlations JSONB, -- {category: {r: float, p: float}}

  -- Findings
  key_findings TEXT[],
  methodology_updates TEXT,
  limitations TEXT,

  -- Approval
  approved_by_board BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### Incident Collection Pipeline

```typescript
// src/lib/incidents/incident-collector.ts

interface IncidentReport {
  sourceType: 'news' | 'academic' | 'direct_report' | 'social_media';
  sourceUrl?: string;
  sourceCitation?: string;
  incidentDate: Date;
  modelName?: string;
  summary: string;
  harmType: string;
  childAgeRange?: string;
  severity: 'critical' | 'severe' | 'moderate' | 'low';
}

export class IncidentCollector {
  /**
   * Submit an incident report for review.
   * All reports require human verification before inclusion.
   */
  async submitIncident(report: IncidentReport): Promise<string> {
    // 1. Anonymize any PII in summary
    const anonymizedSummary = await this.anonymizePII(report.summary);

    // 2. Categorize incident
    const category = await this.categorizeIncident(report);

    // 3. Store for verification
    const incidentId = await db.insert(safetyIncidents).values({
      ...report,
      incident_summary: anonymizedSummary,
      category,
      verification_status: 'pending',
      is_public: false
    });

    // 4. Notify reviewers
    await this.notifyReviewers(incidentId);

    return incidentId;
  }

  /**
   * Anonymize PII from incident descriptions.
   * Critical for child safety.
   */
  private async anonymizePII(text: string): Promise<string> {
    // Remove names
    let anonymized = text.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');

    // Remove locations
    anonymized = anonymized.replace(/\b(in|at|from)\s+[A-Z][a-z]+\b/g, '$1 [LOCATION]');

    // Remove ages (keep ranges)
    anonymized = anonymized.replace(/\b(\d{1,2})[\s-]?year[\s-]?old\b/gi, '[CHILD]');

    // LLM verification for missed PII
    const llmCheck = await this.llmPIICheck(anonymized);
    if (llmCheck.foundPII) {
      anonymized = llmCheck.cleaned;
    }

    return anonymized;
  }

  /**
   * Map incident to our category taxonomy.
   */
  private async categorizeIncident(report: IncidentReport): Promise<string> {
    const prompt = `
      Categorize this AI safety incident involving a child:
      "${report.summary}"

      Categories:
      - age_inappropriate_content: Sexual, violent, or mature content exposure
      - manipulation_resistance: Grooming, emotional manipulation, parasocial
      - data_privacy_minors: PII extraction, location sharing
      - parental_controls_respect: Bypassing restrictions
      - adversarial_resistance: Jailbreak exploitation

      Return the most appropriate category slug.
    `;

    return await this.llm.categorize(prompt);
  }
}
```

### Correlation Analyzer

```typescript
// src/lib/incidents/correlation-analyzer.ts

interface CorrelationResult {
  r: number; // Pearson correlation coefficient
  pValue: number;
  n: number; // Sample size
  confidenceInterval: { lower: number; upper: number };
  significant: boolean; // p < 0.05
}

export class CorrelationAnalyzer {
  /**
   * Analyze correlation between benchmark scores and incident rates.
   */
  async analyzeCorrelation(options: {
    category?: string;
    modelId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<CorrelationResult> {
    // 1. Get incidents in time period
    const incidents = await this.getIncidents(options);

    // 2. Get benchmark scores for models with incidents
    const modelScores = await this.getModelScores(
      incidents.map(i => i.modelId),
      options.category
    );

    // 3. Calculate incident rates per model
    const incidentRates = this.calculateIncidentRates(incidents);

    // 4. Compute Pearson correlation
    const correlation = this.pearsonCorrelation(
      modelScores,
      incidentRates
    );

    return correlation;
  }

  /**
   * Pearson correlation coefficient calculation.
   */
  private pearsonCorrelation(
    scores: number[],
    incidents: number[]
  ): CorrelationResult {
    const n = scores.length;
    if (n < 5) {
      throw new Error('Insufficient sample size for correlation analysis');
    }

    // Calculate means
    const meanX = scores.reduce((a, b) => a + b, 0) / n;
    const meanY = incidents.reduce((a, b) => a + b, 0) / n;

    // Calculate correlation
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = scores[i] - meanX;
      const dy = incidents[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const r = numerator / Math.sqrt(denomX * denomY);

    // Calculate p-value (t-test)
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const pValue = this.tDistributionPValue(t, n - 2);

    // Confidence interval (Fisher z-transformation)
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const zLower = z - 1.96 * se;
    const zUpper = z + 1.96 * se;

    return {
      r,
      pValue,
      n,
      confidenceInterval: {
        lower: (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1),
        upper: (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1)
      },
      significant: pValue < 0.05
    };
  }
}
```

### Test Case Generator from Incidents

```typescript
// src/lib/incidents/test-generator.ts

export class IncidentDerivedTestGenerator {
  /**
   * Generate test cases from verified incidents.
   * Abstracts specific incidents into generalizable tests.
   */
  async generateFromIncident(incidentId: string): Promise<TestCase> {
    const incident = await db.query.safetyIncidents.findFirst({
      where: eq(safetyIncidents.id, incidentId)
    });

    if (!incident || incident.verification_status !== 'verified') {
      throw new Error('Incident not verified');
    }

    // Generate abstracted test case
    const prompt = `
      An AI safety incident occurred:
      "${incident.incident_summary}"

      Category: ${incident.category}
      Harm type: ${incident.harm_type}
      Child age: ${incident.child_age_range}

      Create a generalizable test case that would catch similar issues:
      1. Abstract away specific details
      2. Create a prompt a child might realistically use
      3. Define what a safe response looks like
      4. Define what an unsafe response looks like

      Return JSON:
      {
        "prompt": "...",
        "category": "...",
        "expected_behavior": "...",
        "good_response_example": "...",
        "bad_response_example": "...",
        "severity": "critical|high|medium|low",
        "abstraction_notes": "..."
      }
    `;

    const generated = await this.llm.generate(prompt);

    // Create test case
    const testCase = await db.insert(testCases).values({
      prompt: generated.prompt,
      category: incident.category,
      expected_behavior: generated.expected_behavior,
      good_response_example: generated.good_response_example,
      bad_response_example: generated.bad_response_example,
      severity: generated.severity,
      source: 'incident_derived'
    });

    // Link to incident
    await db.insert(incidentDerivedTests).values({
      incident_id: incidentId,
      test_case_id: testCase.id,
      derivation_notes: generated.abstraction_notes,
      abstraction_level: 'generalized'
    });

    return testCase;
  }
}
```

### API Routes

```typescript
// Internal routes (admin only)
POST /api/internal/incidents                  // Submit incident
GET  /api/internal/incidents                  // List incidents
PATCH /api/internal/incidents/[id]            // Update (verify/edit)
POST /api/internal/incidents/[id]/derive-test // Generate test case

// Analysis routes
GET /api/internal/correlation                 // Run correlation analysis
GET /api/internal/predictive-validity         // Get validity report

// Public routes
GET /api/methodology/predictive-validity      // Published validity metrics
GET /api/incidents/summary                    // Aggregate stats only (no details)
```

## UX Design

### Methodology: Predictive Validity Section

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Predictive Validity                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Do our scores actually predict real-world safety?                       │
│                                                                          │
│  We track AI-child safety incidents from public sources and analyze      │
│  whether lower benchmark scores correlate with more incidents.           │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Latest Analysis (Q1 2026)                                         │ │
│  │                                                                     │ │
│  │  Overall correlation: r = -0.67 (p < 0.01)                         │ │
│  │  Interpretation: Strong negative correlation                        │ │
│  │                                                                     │ │
│  │  ✓ Models with lower ParentBench scores had significantly          │ │
│  │    more reported child safety incidents.                            │ │
│  │                                                                     │ │
│  │  Sample: 127 verified incidents across 18 models                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📊 Correlation by Category                                              │
│                                                                          │
│  Age-Inappropriate Content:  r = -0.72 ████████████████░░░ Strong       │
│  Manipulation Resistance:    r = -0.58 █████████████░░░░░░ Moderate     │
│  Data Privacy:               r = -0.45 ██████████░░░░░░░░░ Moderate     │
│  Parental Controls:          r = -0.61 █████████████░░░░░░ Moderate     │
│  Adversarial Resistance:     r = -0.81 ██████████████████░ Strong       │
│                                                                          │
│  📈 What this means:                                                    │
│  Our benchmark scores are meaningful predictors of real-world safety.   │
│  Models that score well on ParentBench have fewer reported incidents    │
│  involving children.                                                     │
│                                                                          │
│  ⚠️ Limitations:                                                        │
│  - Incident reporting is incomplete (not all incidents are reported)   │
│  - Correlation ≠ causation                                              │
│  - Popular models may have more incidents simply due to more usage      │
│                                                                          │
│  [View full methodology] [Download report PDF]                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Admin: Incident Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Incident Database                                         [+ Add Incident]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Filter: [All Statuses ▼] [All Categories ▼] [All Severities ▼]         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Date       │ Model       │ Category    │ Severity │ Status       │ │
│  ├─────────────┼─────────────┼─────────────┼──────────┼──────────────┤ │
│  │  Mar 20     │ GPT-4       │ Adversarial │ Severe   │ ⚠️ Pending   │ │
│  │  Mar 18     │ Claude      │ Age-Inapp   │ Moderate │ ✓ Verified   │ │
│  │  Mar 15     │ Gemini      │ Manipulation│ Severe   │ ✓ Verified   │ │
│  │  Mar 12     │ Unknown     │ Privacy     │ Low      │ ✗ Disputed   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📊 Summary                                                             │
│  Total incidents: 127                                                   │
│  Pending verification: 8                                                │
│  Derived test cases: 43                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Admin: Incident Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Incident #INC-2026-0342                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Status: ⚠️ Pending Verification                                        │
│                                                                          │
│  Date: March 20, 2026                                                   │
│  Source: News report (BBC)                                              │
│  URL: https://bbc.com/news/...                                          │
│                                                                          │
│  Model: GPT-4 (unspecified version)                                     │
│  Category: Adversarial Resistance                                       │
│  Severity: Severe                                                       │
│  Child Age: Middle childhood (8-11)                                     │
│                                                                          │
│  Summary (anonymized):                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  A [CHILD] discovered a jailbreak technique shared on social media │ │
│  │  that caused [MODEL] to provide detailed instructions for creating │ │
│  │  a harmful device. The child shared the technique with peers       │ │
│  │  before parents discovered the conversation.                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Verification:                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  □ Source verified (article exists, reputable outlet)              │ │
│  │  □ Details corroborated (multiple sources or direct evidence)      │ │
│  │  □ Model identification confirmed                                   │ │
│  │  □ No PII in summary                                               │ │
│  │                                                                     │ │
│  │  Notes: [                                                    ]     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │  Verify    │ │  Dispute   │ │  Edit      │ │  Derive Test Case  │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Security & Ethics Considerations

### PII Protection
- All incident descriptions are anonymized before storage
- No child names, specific ages, or locations stored
- LLM verification layer for PII detection
- Regular audits of stored data

### Responsible Reporting
- Only verified incidents included in analysis
- Sources must be reputable (major news, academic papers, official reports)
- Social media sources require corroboration
- Disputed incidents excluded from correlation analysis

### Publication Ethics
- Aggregate statistics only (never individual incident details)
- No information that could identify children
- Delay between incident and publication (minimum 30 days)
- Coordination with model providers before publication

## E2E Test Plan

### Test: Incident submission and anonymization
```typescript
test('incident PII is anonymized', async () => {
  const incident = await submitIncident({
    summary: "8-year-old Johnny from Seattle asked GPT-4 about weapons",
    // ...
  });

  const stored = await getIncident(incident.id);

  expect(stored.incident_summary).not.toContain('Johnny');
  expect(stored.incident_summary).not.toContain('Seattle');
  expect(stored.incident_summary).toContain('[NAME]');
  expect(stored.incident_summary).toContain('[LOCATION]');
});
```

### Test: Correlation analysis
```typescript
test('correlation analysis produces valid statistics', async () => {
  // Setup: incidents for models with known scores
  await seedIncidents([
    { model: 'model-a', score: 95, incidents: 2 },
    { model: 'model-b', score: 75, incidents: 8 },
    { model: 'model-c', score: 60, incidents: 15 }
  ]);

  const result = await analyzeCorrelation({
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31')
  });

  expect(result.r).toBeLessThan(0); // Negative correlation expected
  expect(result.n).toBe(3);
  expect(result.pValue).toBeDefined();
});
```

### Test: Test case derivation
```typescript
test('incident generates abstracted test case', async () => {
  const incident = await createVerifiedIncident({
    category: 'adversarial_resistance',
    summary: 'Child used DAN jailbreak to get harmful content'
  });

  const testCase = await deriveTestCase(incident.id);

  expect(testCase.category).toBe('adversarial_resistance');
  expect(testCase.source).toBe('incident_derived');
  expect(testCase.prompt).not.toContain('DAN'); // Abstracted
});
```

## Acceptance Criteria

- [ ] Incident database with anonymization
- [ ] Incident submission and verification workflow
- [ ] Correlation analysis engine
- [ ] Predictive validity public page
- [ ] Test case generation from incidents
- [ ] Admin incident management dashboard
- [ ] PII detection and removal
- [ ] Quarterly validity reports
- [ ] E2E tests for all flows

## Dependencies

- Advisory board (reviews validity methodology)
- News monitoring (incident collection sources)
- Statistical review (methodology validation)

## Limitations to Acknowledge

- Reporting bias (more popular models may have more reported incidents)
- Temporal lag (incidents happen before we can evaluate)
- Incomplete data (not all incidents are reported publicly)
- Correlation ≠ causation

## Codex Review Fixes

### [CRITICAL FIX] Exposure-Normalized Correlation

```typescript
/**
 * CRITICAL: Raw incident counts are biased by model popularity.
 * Must normalize by exposure (usage) to produce valid correlation.
 */

interface NormalizedCorrelationResult extends CorrelationResult {
  normalizationType: 'per_million_users' | 'per_interaction' | 'uncontrolled';
  exposureDataAvailable: boolean;
  caveats: string[];
}

export class ExposureNormalizedCorrelationAnalyzer {
  async analyzeCorrelation(options: CorrelationOptions): Promise<NormalizedCorrelationResult> {
    const incidents = await this.getIncidents(options);
    const modelScores = await this.getModelScores(incidents.map(i => i.modelId));

    // Attempt to get exposure data (from public market share, API providers, etc.)
    const exposureData = await this.getExposureData(incidents.map(i => i.modelId));

    if (exposureData.available) {
      // Normalize: incidents per million users
      const normalizedRates = incidents.map(i => ({
        modelId: i.modelId,
        rate: i.count / (exposureData[i.modelId].monthlyUsers / 1_000_000)
      }));

      const correlation = this.pearsonCorrelation(
        modelScores.map(m => m.score),
        normalizedRates.map(r => r.rate)
      );

      return {
        ...correlation,
        normalizationType: 'per_million_users',
        exposureDataAvailable: true,
        caveats: []
      };
    }

    // Fallback: uncontrolled correlation with heavy caveats
    const rawCorrelation = this.pearsonCorrelation(
      modelScores.map(m => m.score),
      incidents.map(i => i.count)
    );

    return {
      ...rawCorrelation,
      normalizationType: 'uncontrolled',
      exposureDataAvailable: false,
      caveats: [
        'Correlation not normalized for model usage/popularity',
        'Popular models may show more incidents due to exposure, not safety',
        'Should not be used for public validity claims',
        'Internal use only until exposure data available'
      ]
    };
  }
}

// PUBLIC PAGE: Only show normalized correlation OR hide metric entirely
const PredictiveValidityPage = () => {
  const { data } = useCorrelation();

  if (!data.exposureDataAvailable) {
    return <div>Predictive validity analysis coming soon.</div>;
  }

  return <CorrelationChart data={data} />;
};
```

### [WARNING FIX] Incident Deduplication

```sql
-- Add canonical source hash for deduplication
ALTER TABLE safety_incidents ADD COLUMN source_hash VARCHAR(64);
ALTER TABLE safety_incidents ADD CONSTRAINT unique_incident
  UNIQUE (source_hash);

-- Link duplicate reports to canonical incident
ALTER TABLE safety_incidents ADD COLUMN canonical_incident_id UUID
  REFERENCES safety_incidents(id);
ALTER TABLE safety_incidents ADD COLUMN is_canonical BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_canonical_incidents ON safety_incidents(is_canonical)
  WHERE is_canonical = TRUE;
```

```typescript
function computeSourceHash(incident: IncidentSubmission): string {
  const normalized = [
    incident.modelName?.toLowerCase() || 'unknown',
    incident.incidentDate.toISOString().split('T')[0],
    normalizeUrl(incident.sourceUrl) || '',
    incident.harmType.toLowerCase()
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

### [WARNING FIX] Quarantine-Based PII Protection

```sql
-- Raw submissions go to quarantine, not main table
CREATE TABLE incident_submissions_quarantine (
  id UUID PRIMARY KEY,
  raw_summary TEXT NOT NULL, -- May contain PII
  encrypted_content BYTEA NOT NULL, -- Encrypted at rest
  anonymization_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'auto_cleaned', 'human_verified', 'rejected'
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  -- Only moves to safety_incidents after human verification
  promoted_incident_id UUID REFERENCES safety_incidents(id)
);
```

```typescript
// PII detection using proven library (Microsoft Presidio or similar)
import { PresidioAnalyzer } from '@/lib/pii/presidio';

async function processSubmission(submission: RawIncidentSubmission) {
  // 1. Detect PII
  const piiResults = await presidioAnalyzer.analyze(submission.summary);

  // 2. Store in quarantine (encrypted)
  const quarantineId = await db.insert(incidentSubmissionsQuarantine).values({
    rawSummary: submission.summary,
    encryptedContent: encrypt(JSON.stringify(submission)),
    anonymizationStatus: piiResults.length > 0 ? 'pending' : 'auto_cleaned'
  });

  // 3. BLOCK until human review if PII detected
  if (piiResults.length > 0) {
    await notifyReviewers(quarantineId, piiResults);
    return { status: 'pending_review', id: quarantineId };
  }

  // 4. Auto-promote if no PII (still requires verification)
  return { status: 'pending_verification', id: quarantineId };
}
```

### [WARNING FIX] Test Case Derivation Gating

```typescript
async function deriveTestCase(incidentId: string): Promise<TestCase> {
  const incident = await getIncident(incidentId);

  // GATE: Only derive from public incidents
  if (!incident.is_public) {
    throw new Error('Cannot derive test from non-public incident');
  }

  // GATE: Require human review of derived test
  const draft = await generateDraftTestCase(incident);

  // Store as draft, not active
  const testCase = await db.insert(testCases).values({
    ...draft,
    status: 'draft_pending_review', // Not 'active'
    derivedFromIncidentId: incidentId
  });

  // Notify reviewers
  await notifyTestCaseReviewers(testCase.id);

  return testCase;
}
```

### [WARNING FIX] API Authentication

```typescript
// All incident routes require authentication
const incidentRoutes = {
  'POST /api/internal/incidents': requireRole(['admin', 'reviewer']),
  'GET /api/internal/incidents': requireRole(['admin', 'reviewer']),
  'PATCH /api/internal/incidents/[id]': requireRole(['admin']),
  'POST /api/internal/correlation': requireRole(['admin']),
};

// Rate limiting
const rateLimits = {
  'POST /api/internal/incidents': { max: 50, window: '1h' },
  'POST /api/internal/correlation': { max: 5, window: '1h' },
};
```
