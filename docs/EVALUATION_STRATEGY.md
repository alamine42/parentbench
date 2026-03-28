# Evaluation Frequency Strategy

## Overview

This document defines the strategy for how often AI models are evaluated on the ParentBench child safety benchmark. The strategy balances:

- **Freshness**: Users expect scores to reflect current model behavior
- **Cost efficiency**: API calls cost money ($0.01 - $1.15 per evaluation)
- **Statistical robustness**: Single evaluations have high variance (20-60 points between runs)
- **Fairness**: All models should be evaluated with the same test suite version

## Key Findings

### Score Variance

Analysis of 71 evaluations across 34 models revealed significant score variance between runs of the same model:

| Variance Level | Example Models | Score Range |
|----------------|----------------|-------------|
| High (>40 pts) | Claude Haiku 4.5, GPT-5.4 mini | 50-90 points |
| Medium (20-40 pts) | Claude Opus, GPT-4.1, Sonnet | 20-40 points |
| Low (<20 pts) | Gemini Flash-Lite, Gemini Pro | 5-10 points |

**Implication**: A single evaluation is insufficient for defensible rankings. We use the median of 3 runs.

### Cost Distribution

| Provider | Avg Cost/Eval | Cost Tier |
|----------|---------------|-----------|
| Anthropic | $0.32 | Premium |
| xAI | $0.13 | Standard |
| OpenAI | $0.05 | Budget |
| Google | $0.05 | Budget |
| Together AI (Meta, Mistral, etc.) | $0.00* | Free tier |

*Together AI models may have cost tracking issues

### Provider Release Cadence

| Provider | Release Pattern | Examples |
|----------|-----------------|----------|
| OpenAI | Aggressive (monthly) | GPT-4 → 4o → 4.1 → 5 → 5.4 → o3 → o4 |
| Anthropic | Moderate (quarterly) | Claude 4 → 4.1 → 4.5 → 4.6 |
| Google | Moderate (quarterly) | Gemini 1.5 → 2.0 → 2.5 |
| Others | Slow (semi-annual) | Single major versions |

## Evaluation Tiers

Models are assigned to tiers based on their importance and update frequency:

### Tier Definitions

| Tier | Frequency | Run Count | Use Case |
|------|-----------|-----------|----------|
| **active** | Weekly | 3 runs | Flagship models, recently updated models, high user interest |
| **standard** | Bi-weekly | 3 runs | Mid-tier models, stable but relevant |
| **maintenance** | Monthly | 3 runs | Legacy models, open-source, low update frequency |
| **paused** | Manual only | 1 run | Deprecated models, testing, special cases |

### Tier Assignments

#### Active Tier (Weekly)
- Claude Opus 4.5, 4.6
- Claude Sonnet 4.5, 4.6
- GPT-5, GPT-5.4, GPT-5.4 Pro
- o3, o3 Pro, o4-mini
- Gemini 2.5 Pro

#### Standard Tier (Bi-weekly)
- Claude Haiku 4.5
- Claude Opus 4, 4.1
- Claude Sonnet 4
- GPT-4.1, GPT-4.1 mini
- GPT-5 mini, GPT-5.4 mini
- Gemini 2.5 Flash, 2.5 Flash-Lite
- Grok 2

#### Maintenance Tier (Monthly)
- GPT-4o, GPT-4o mini
- GPT-5 nano, GPT-5.4 nano
- Gemini 2.0 Flash, 2.0 Flash-Lite
- Gemini 1.5 Pro, 1.5 Flash
- Llama 3.1 405B
- Mistral Large 2
- Command R+
- DeepSeek V3

## Scoring Methodology

### Multi-Run Aggregation

Each "official" score update consists of 3 evaluation runs:

1. Run evaluation 3 times
2. Compute **median** score (middle value)
3. Store all 3 runs for transparency
4. Calculate **confidence interval** based on variance

### Score Confidence Levels

| Variance | Confidence | Display |
|----------|------------|---------|
| < 5 points | High | Green indicator |
| 5-15 points | Medium | Yellow indicator |
| > 15 points | Low | Red indicator, flagged for review |

### Score Display

Public leaderboard shows:
- **Median score** from last 3 runs
- **Confidence indicator** (high/medium/low)
- **Last evaluated** timestamp
- **Trend** (up/down/stable vs previous)

## Automation

### Scheduled Evaluations

| Schedule | Tier | Cron Expression |
|----------|------|-----------------|
| Daily 2:00 AM UTC | active | `0 2 * * *` |
| Monday & Thursday 2:00 AM UTC | standard | `0 2 * * 1,4` |
| 1st of month 2:00 AM UTC | maintenance | `0 2 1 * *` |

### Event-Triggered Evaluations

1. **New Model Version**: When a new model is added to the database
2. **Score Drift**: If a single run differs >15 points from median, auto-rerun
3. **Manual Trigger**: Admin can trigger any model at any time

### Evaluation Queue

- Max concurrent evaluations: 5 (to respect rate limits)
- Priority: active > standard > maintenance > manual
- Retry failed evaluations: 3 attempts with exponential backoff

## Budget Management

### Monthly Budget Targets

| Tier | Models | Evals/Month | Est. Cost |
|------|--------|-------------|-----------|
| Active (weekly × 3) | ~10 | 120 | $15-25 |
| Standard (bi-weekly × 3) | ~12 | 72 | $5-10 |
| Maintenance (monthly × 3) | ~12 | 36 | $2-5 |
| **Total** | 34 | 228 | **$22-40** |

### Budget Alerts

- **Warning**: 80% of monthly budget reached
- **Critical**: 100% of monthly budget reached
- **Action**: Pause non-active tier evaluations if over budget

## Implementation Checklist

- [x] Document strategy (this file)
- [x] Add `evalTier` field to models schema
- [x] Create tier assignment UI in admin panel
- [x] Implement scheduled evaluation cron jobs
- [ ] Track multiple runs per score update
- [ ] Compute and store median scores
- [ ] Add confidence indicators to leaderboard
- [ ] Implement drift detection
- [ ] Add evaluation queue with priorities

## Maintenance

### Quarterly Review

1. Review tier assignments based on:
   - Model popularity/usage
   - Provider release announcements
   - Score stability trends
   - Cost trends

2. Adjust tiers as needed

3. Archive deprecated models (move to `paused`)

### Annual Benchmark Update

When updating the test suite:
1. Re-run all models at same time for fair comparison
2. Mark scores as "re-baselined" in database
3. Store both old and new scores for trend analysis
