# Phase 2: Historical Scores + Comparison View - Design Document

## Overview

Phase 2 builds analytical and comparison features for ParentBench, allowing users to:
1. Track model safety scores over time
2. Compare multiple models side-by-side
3. Filter results by age bracket
4. Generate shareable PDF report cards

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2 ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐  │
│  │  Historical      │     │  Comparison      │     │  Report Card    │  │
│  │  Score Chart     │     │  View            │     │  Generator      │  │
│  │                  │     │                  │     │                 │  │
│  │  - Line chart    │     │  - Multi-select  │     │  - PDF export   │  │
│  │  - Time range    │     │  - Side-by-side  │     │  - Social share │  │
│  │  - Category      │     │  - Diff view     │     │  - Embed code   │  │
│  │    breakdown     │     │  - Category      │     │                 │  │
│  │                  │     │    comparison    │     │                 │  │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬────────┘  │
│           │                        │                        │           │
│           └────────────────────────┼────────────────────────┘           │
│                                    │                                     │
│                    ┌───────────────▼───────────────┐                    │
│                    │     Age Bracket Filter        │                    │
│                    │                               │                    │
│                    │  ┌─────┐ ┌─────┐ ┌─────┐     │                    │
│                    │  │ 6-9 │ │10-12│ │13-15│     │                    │
│                    │  └─────┘ └─────┘ └─────┘     │                    │
│                    └───────────────┬───────────────┘                    │
│                                    │                                     │
│                    ┌───────────────▼───────────────┐                    │
│                    │        API Layer              │                    │
│                    │                               │                    │
│                    │  /api/scores/history          │                    │
│                    │  /api/scores/compare          │                    │
│                    │  /api/reports/generate        │                    │
│                    └───────────────┬───────────────┘                    │
│                                    │                                     │
│                    ┌───────────────▼───────────────┐                    │
│                    │        Database               │                    │
│                    │                               │                    │
│                    │  scores (with categoryScores) │                    │
│                    │  evaluations                  │                    │
│                    │  test_cases (age_brackets)    │                    │
│                    └───────────────────────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Status

### Completed Components

#### UI Components (`src/components/ui/`)
- [x] `time-range-selector.tsx` - Button group for 1M, 3M, 6M, 1Y, All
- [x] `model-chip.tsx` - Compact model display with logo and remove
- [x] `score-delta.tsx` - Score change indicator with arrows
- [x] `category-legend.tsx` - Toggle visibility of chart series
- [x] `empty-state.tsx` - Various empty state variants

#### Charts (`src/components/charts/`)
- [x] `score-history-chart.tsx` - Recharts line chart with categories

#### Filters (`src/components/filters/`)
- [x] `age-bracket-filter.tsx` - Dropdown and button group variants

#### Hooks (`src/hooks/`)
- [x] `use-age-bracket-filter.ts` - URL state sync

#### Comparison (`src/components/comparison/`)
- [x] `model-selector.tsx` - Searchable dropdown
- [x] `comparison-card.tsx` - Model card with score
- [x] `category-comparison-bar.tsx` - Horizontal bars per category
- [x] `model-comparison-view.tsx` - Full comparison UI

#### Reports (`src/components/reports/`, `src/lib/pdf/`)
- [x] `share-buttons.tsx` - Share functionality
- [x] `embed-code.tsx` - Embed snippets
- [x] `report-generator.tsx` - PDF document component

#### Pages
- [x] `/compare` - Model comparison page
- [x] `/model/[slug]/history` - Score history
- [x] `/reports/[modelSlug]` - Report card preview
- [x] `/verify/[reportId]` - Verification page

#### API Endpoints
- [x] `/api/internal/models/[slug]/scores` - Enhanced with time range
- [x] `/api/internal/scores/compare` - Compare multiple models
- [x] `/api/internal/reports/[modelSlug]` - Generate PDF

#### Database Queries
- [x] `getModelScoreHistoryWithCategories()`
- [x] `calculateScoreTrend()`
- [x] `getModelsForComparison()`

### Tests
- [x] 45 tests passing for UI components
- [ ] API integration tests (to be added)
- [ ] Database query tests (to be added)

## API Contracts

### Score History API
```typescript
// GET /api/internal/models/[slug]/scores?range=6M&categories=true
{
  success: true,
  data: {
    modelId: string,
    modelSlug: string,
    modelName: string,
    provider: { id, name, slug, logoUrl },
    timeRange: "1M" | "3M" | "6M" | "1Y" | "ALL",
    history: Array<{
      date: string,
      overallScore: number,
      overallGrade: string,
      categoryScores?: CategoryScore[]
    }>,
    trend: {
      direction: "up" | "down" | "stable",
      changePercent: number,
      changeAbsolute: number,
      periodStart: string | null,
      periodEnd: string | null
    }
  }
}
```

### Comparison API
```typescript
// GET /api/internal/scores/compare?models=slug1,slug2,slug3
{
  success: true,
  data: {
    models: Array<ModelWithScore & { isOverallBest: boolean }>,
    categoryComparison: {
      [category: string]: Array<{
        modelSlug: string,
        score: number,
        grade: string,
        passRate: number,
        isBest: boolean
      }>
    },
    comparisonDate: string
  }
}
```

### Reports API
```typescript
// GET /api/internal/reports/[modelSlug]?format=pdf|json
// Returns PDF binary or JSON report data
```

## Data Foundation

### Age Bracket Support

The database schema already includes age bracket support:

```typescript
// src/db/schema.ts - test_cases table
ageBrackets: jsonb("age_brackets").$type<string[]>().default(["6-9", "10-12", "13-15"])
```

Each test case can be tagged with applicable age brackets. When filtering by age bracket:
1. Filter `eval_results` by `test_case` age bracket
2. Re-compute category and overall scores for the filtered subset
3. Display filtered scores in UI

**Note:** The UI components are ready; backend filtering will be wired up when age-specific test data is seeded.

### Historical Data Pipeline

Historical scores are stored in the `scores` table with `computedAt` timestamps:

```typescript
// Data flow:
// 1. Inngest triggers evaluation job (scheduled or manual)
// 2. Evaluation runs all test cases against model
// 3. Results stored in eval_results table
// 4. Score computed and stored in scores table with timestamp
// 5. History API queries scores table with time range filter
```

**Migration from JSON:** Existing JSON data in `data/parentbench/scores.json` can be migrated via the `db:seed` script. Historical snapshots will accumulate as evaluations run.

**Graceful degradation:** When history is empty, the UI shows the `EmptyState` component with actionable guidance.

## Edge Cases & Error Handling

1. **Empty History**: Shows EmptyState component with "no-history" variant
2. **Single Model Comparison**: Shows message to add another model
3. **Missing Scores**: Model cards show 0/F grade when no score data
4. **Invalid Time Range**: Falls back to "ALL"
5. **PDF Generation Failure**: Returns JSON error response with status 500
6. **Long Loading**: All pages show loading spinners/skeletons

### Loading States (Implemented)

- **History Page**: Full-page spinner during fetch
- **Comparison View**: Inline spinner while fetching comparison data
- **Model Selector**: Shows "loading" state in dropdown
- **Charts**: Renders skeleton until data arrives
- **Error Recovery**: Inline "Try Again" buttons on failure

## Security Considerations

1. **Report IDs**: Uses salted HMAC (SHA-256) with secret `REPORT_ID_SALT` env var to prevent enumeration
2. **No PII in Reports**: Report cards only contain public model evaluation data
3. **PDF Generation**: Server-side only, no client-side code execution
4. **Rate Limiting**: Should be added via middleware (not yet implemented)

### Environment Variables
```bash
# Required for production - prevents report ID enumeration
REPORT_ID_SALT=your-secret-salt-here
```

## Performance Considerations

### PDF Generation

Current implementation generates PDFs synchronously. For production:

1. **Caching**: PDFs are cached for 1 hour via `Cache-Control` header
2. **Future improvement**: Move to async generation with Inngest queue
3. **Pre-generation**: Consider generating PDFs when scores update

### Database Queries

- `getModelScoreHistoryWithCategories`: Uses `computedAt` index for time range
- `getModelsForComparison`: Batch query with N+1 avoidance

## Mobile Responsiveness

- Charts: Horizontal scroll on small screens
- Comparison: Cards stack vertically (1 per row on mobile)
- Filter: Dropdown on mobile, button group on desktop
- Report: Responsive preview with stacked layout

## Dependencies Added

- `recharts` - Line charts for score history
- `@react-pdf/renderer` - PDF report generation
- `qrcode.react` - QR codes (available, not yet integrated in PDFs)

## Future Enhancements

1. Add QR codes to PDF reports for mobile verification
2. Pre-generate PDFs when scores update (Inngest job)
3. Add rate limiting to PDF endpoint
4. E2E tests for full user flows
5. Real-time updates via WebSocket (Phase 3)
