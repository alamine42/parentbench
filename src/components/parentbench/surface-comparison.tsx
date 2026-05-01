/**
 * Per-model surface comparison panel (parentbench-bb7).
 *
 * "The split": API and Web each get a labeled card; the gap between
 * them is where the story lives — per-metric delta indicators arrayed
 * vertically down the seam. Reads as investigative graphics, not a
 * database row.
 *
 * Recency states are first-class design:
 *   - ok      → unobtrusive "Synced" pill on the panel header
 *   - caveat  → amber sash above the metric grid + per-row asterisk
 *   - stale   → grayscale dim on the metrics; deltas removed; a
 *               centered "refreshing pair" panel takes over the seam
 *
 * Recency logic delegates to compareRecency in src/lib/leaderboard/recency.ts —
 * the band thresholds (≤14d / 14–30d / >30d) and decision are unchanged.
 */

import type {
  ParentBenchResult,
  EvaluationSurface,
  ParentBenchCategory,
} from "@/types/parentbench";
import { compareRecency } from "@/lib/leaderboard/recency";

const SURFACE_LABELS: Record<EvaluationSurface, string> = {
  "api-default": "API default",
  "api-with-system-prompt": "API + system prompt",
  "web-product": "Web (consumer)",
  "web-product-teen-mode": "Web (teen mode)",
};

const SURFACE_SUB: Record<EvaluationSurface, string> = {
  "api-default": "Clean endpoint, no provider wrapper",
  "api-with-system-prompt": "API call with provider system prompt",
  "web-product": "Real account on the consumer app",
  "web-product-teen-mode": "Real teen-DOB account, teen mode on",
};

const CATEGORY_ORDER: ParentBenchCategory[] = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
];

const CATEGORY_LABELS: Record<ParentBenchCategory, string> = {
  age_inappropriate_content: "Age-appropriate content",
  manipulation_resistance: "Manipulation resistance",
  data_privacy_minors: "Privacy for minors",
  parental_controls_respect: "Parental controls",
};

type Props = {
  surfaces: ParentBenchResult[];
};

function getCategoryScore(
  result: ParentBenchResult,
  category: ParentBenchCategory
): number {
  return result.categoryScores.find((c) => c.category === category)?.score ?? 0;
}

function deltaTone(delta: number, lowerIsBetter = false): "good" | "bad" | "neutral" {
  const directional = lowerIsBetter ? -delta : delta;
  if (directional <= -5) return "bad";
  if (directional >= 5) return "good";
  return "neutral";
}

function formatDelta(delta: number, decimals = 0): string {
  if (Math.abs(delta) < 0.5 && decimals === 0) return "0";
  const value = decimals === 0 ? Math.round(delta) : delta;
  return value > 0 ? `+${value}` : `${value}`;
}

// Surface-distinguishing icons. API = code-brackets, Web = browser frame.
function SurfaceIcon({ surface }: { surface: EvaluationSurface }) {
  const isApi = surface.startsWith("api");
  if (isApi) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path
          d="M6 6l-3 4 3 4M14 6l3 4-3 4M11 4l-2 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 7.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="5.5" r="0.6" fill="currentColor" />
      <circle cx="6.8" cy="5.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function SurfaceComparison({ surfaces }: Props) {
  if (surfaces.length < 2) return null;

  // Normalise surface up front so the rest of the component can rely
  // on a non-null EvaluationSurface (DB column is NOT NULL DEFAULT
  // 'api-default'; the type-level optionality is just history).
  const withSurface: ReadonlyArray<ParentBenchResult & { surface: EvaluationSurface }> =
    surfaces.map((r) => ({ ...r, surface: r.surface ?? "api-default" }));

  // Pick the pair deliberately rather than slicing the first two off a
  // sort. The story we want to tell is "API default vs the consumer
  // surface kids actually use" — not whatever happens to alphabetize
  // first. Future surfaces (api-with-system-prompt, web-product-teen-mode)
  // wouldn't be silently swallowed.
  const baseline =
    withSurface.find((r) => r.surface === "api-default") ??
    withSurface.find((r) => r.surface.startsWith("api")) ??
    withSurface[0];
  const compare =
    withSurface.find(
      (r) => r.surface === "web-product" && r !== baseline
    ) ??
    withSurface.find(
      (r) => r.surface.startsWith("web") && r !== baseline
    ) ??
    withSurface.find((r) => r !== baseline);

  if (!compare) return null; // shouldn't happen with the length guard above
  const extraSurfaceCount = withSurface.length - 2;

  const recency = compareRecency(baseline.evaluatedDate, compare.evaluatedDate);
  const isStale = recency.band === "stale";
  const isCaveat = recency.band === "caveat";
  const deltaDays = Number.isFinite(recency.deltaDays)
    ? Math.round(recency.deltaDays)
    : 0;

  const baselineSurface = baseline.surface;
  const compareSurface = compare.surface;

  return (
    <section
      aria-label="Surface comparison"
      className="relative overflow-hidden rounded-3xl border border-card-border bg-card-bg shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_-12px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_40px_-12px_rgba(0,0,0,0.55)]"
    >
      {/* Top accent line — quiet but present */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
      />

      <header className="flex flex-col gap-3 border-b border-card-border/70 bg-muted-bg/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Cross-surface report
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
            How this model behaves across surfaces
          </h2>
          {extraSurfaceCount > 0 ? (
            <p className="mt-1.5 text-[11px] text-muted">
              Showing API default vs Web (consumer). {extraSurfaceCount} other
              surface{extraSurfaceCount === 1 ? "" : "s"} available — view full
              history below.
            </p>
          ) : null}
        </div>

        <RecencyChip band={recency.band} deltaDays={deltaDays} />
      </header>

      {/* Caveat sash — between header and body, full-width amber rail */}
      {isCaveat ? (
        <div className="flex items-start gap-3 border-b border-amber-300/40 bg-amber-50 px-6 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-900/15 dark:text-amber-100 sm:px-8">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          >
            <path
              d="M8 1.5l7 12.5H1L8 1.5zM8 6.5v3.5M8 11.75v0.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p>
            <span className="font-semibold">Δ may include model drift</span> — last
            paired runs were <span className="tabular-nums">{deltaDays}</span> days
            apart. A fresh API run is queued; deltas will tighten on the next refresh.
          </p>
        </div>
      ) : null}

      {/* Body — paired panes with deltas, OR stale takeover if runs aren't comparable. */}
      {isStale ? (
        <StalePanel
          baseline={baseline}
          compare={compare}
          baselineLabel={SURFACE_LABELS[baselineSurface]}
          compareLabel={SURFACE_LABELS[compareSurface]}
          baselineSurface={baselineSurface}
          compareSurface={compareSurface}
        />
      ) : (
        <div className="grid gap-0 lg:grid-cols-[1fr_minmax(0,140px)_1fr]">
          <SurfacePane
            result={baseline}
            label={SURFACE_LABELS[baselineSurface]}
            sub={SURFACE_SUB[baselineSurface]}
            surface={baselineSurface}
            align="left"
          />

          {/* Center seam — where the deltas live (desktop only). */}
          <div className="relative hidden border-x border-card-border/60 bg-muted-bg/20 lg:block">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-card-border/0 via-card-border to-card-border/0"
            />
            <p
              aria-hidden="true"
              className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Δ
            </p>
            <div className="flex h-full flex-col justify-around py-8">
              <SeamDelta
                base={baseline.overallScore}
                comp={compare.overallScore}
              />
              <SeamDelta
                base={(baseline.falseRefusalRate ?? 0) * 100}
                comp={(compare.falseRefusalRate ?? 0) * 100}
                lowerIsBetter
                suffix="%"
              />
              {CATEGORY_ORDER.map((cat) => (
                <SeamDelta
                  key={cat}
                  base={getCategoryScore(baseline, cat)}
                  comp={getCategoryScore(compare, cat)}
                />
              ))}
            </div>
          </div>

          <SurfacePane
            result={compare}
            label={SURFACE_LABELS[compareSurface]}
            sub={SURFACE_SUB[compareSurface]}
            surface={compareSurface}
            align="right"
          />
        </div>
      )}

      {/* Mobile metrics list — desktop hides via lg:hidden. Skipped in stale
          state because StalePanel renders its own mobile-friendly side-by-side. */}
      {!isStale ? (
        <MetricsMobile
          baseline={baseline}
          compare={compare}
          baselineLabel={SURFACE_LABELS[baselineSurface]}
          compareLabel={SURFACE_LABELS[compareSurface]}
          showDeltas
        />
      ) : null}
    </section>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StalePanel({
  baseline,
  compare,
  baselineLabel,
  compareLabel,
  baselineSurface,
  compareSurface,
}: {
  baseline: ParentBenchResult;
  compare: ParentBenchResult;
  baselineLabel: string;
  compareLabel: string;
  baselineSurface: EvaluationSurface;
  compareSurface: EvaluationSurface;
}) {
  // The stale state is its own design language: no deltas, no seam, just
  // two surfaces stating their numbers and an honest "we're refreshing"
  // message in between. Reads as a status card, not a broken comparison.
  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_minmax(0,260px)_1fr]">
      <StaleSurfaceCard
        result={baseline}
        label={baselineLabel}
        surface={baselineSurface}
        align="left"
      />

      <div className="relative flex flex-col items-center justify-center border-y border-card-border/60 bg-muted-bg/30 px-6 py-8 text-center lg:border-x lg:border-y-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute h-full w-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-muted/70" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-muted" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">
          Scores not paired
        </p>
        <p className="mt-1.5 max-w-[34ch] text-xs leading-relaxed text-muted">
          The two runs are more than 30 days apart, so any delta would
          conflate model drift with surface effect. A fresh pair is being
          collected.
        </p>
      </div>

      <StaleSurfaceCard
        result={compare}
        label={compareLabel}
        surface={compareSurface}
        align="right"
      />
    </div>
  );
}

function StaleSurfaceCard({
  result,
  label,
  surface,
  align,
}: {
  result: ParentBenchResult;
  label: string;
  surface: EvaluationSurface;
  align: "left" | "right";
}) {
  const isWeb = !surface.startsWith("api");
  return (
    <div className={`px-6 py-7 sm:px-8 ${align === "right" ? "lg:text-right" : ""}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "lg:justify-end" : ""}`}>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
            isWeb
              ? "bg-accent/10 text-accent dark:bg-accent/15"
              : "bg-muted-bg text-muted"
          }`}
        >
          <SurfaceIcon surface={surface} />
        </span>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <p className="mt-5 font-serif text-[44px] leading-none tracking-tight tabular-nums text-foreground">
        {result.overallScore}
        <span className="ml-1 align-top text-sm font-sans font-semibold text-muted">
          {result.overallGrade}
        </span>
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
        Last seen {result.evaluatedDate}
      </p>
    </div>
  );
}

function RecencyChip({
  band,
  deltaDays,
}: {
  band: "ok" | "caveat" | "stale";
  deltaDays: number;
}) {
  if (band === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-300/40 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-900/20 dark:text-emerald-200 sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        Synced · paired within 14 days
      </span>
    );
  }
  if (band === "caveat") {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-300/40 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-100 sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {deltaDays}d apart
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-card-border bg-muted-bg/60 px-2.5 py-1 text-xs font-semibold text-muted sm:self-auto">
      <span className="h-1.5 w-1.5 rounded-full bg-muted/70" />
      Refreshing pair
    </span>
  );
}

function SurfacePane({
  result,
  label,
  sub,
  surface,
  align,
}: {
  result: ParentBenchResult;
  label: string;
  sub: string;
  surface: EvaluationSurface;
  align: "left" | "right";
}) {
  const isWeb = !surface.startsWith("api");
  return (
    <div
      className={`relative px-6 py-7 sm:px-8 ${
        align === "right" ? "lg:text-right" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          align === "right" ? "lg:justify-end" : ""
        }`}
      >
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
            isWeb
              ? "bg-accent/10 text-accent dark:bg-accent/15"
              : "bg-muted-bg text-muted"
          }`}
        >
          <SurfaceIcon surface={surface} />
        </span>
        <div className={align === "right" ? "lg:text-right" : ""}>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-[11px] leading-tight text-muted">{sub}</p>
        </div>
      </div>

      {/* Hero metric: overall score, oversized, serif */}
      <div className="mt-6 hidden lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Overall safety
        </p>
        <p className="mt-1 font-serif text-[56px] leading-none tracking-tight tabular-nums text-foreground">
          {result.overallScore}
          <span className="ml-1 align-top text-base font-sans font-semibold text-muted">
            {result.overallGrade}
          </span>
        </p>
        <dl className="mt-6 space-y-3 text-sm">
          <PaneRow
            label="False refusal"
            value={`${Math.round((result.falseRefusalRate ?? 0) * 100)}%`}
            align={align}
          />
          {CATEGORY_ORDER.map((cat) => (
            <PaneRow
              key={cat}
              label={CATEGORY_LABELS[cat]}
              value={String(getCategoryScore(result, cat))}
              align={align}
            />
          ))}
        </dl>
      </div>
    </div>
  );
}

function PaneRow({
  label,
  value,
  align,
}: {
  label: string;
  value: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-card-border/40 pt-3 first:border-0 first:pt-0 ${
        align === "right" ? "lg:flex-row-reverse" : ""
      }`}
    >
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function SeamDelta({
  base,
  comp,
  lowerIsBetter,
  suffix,
}: {
  base: number;
  comp: number;
  lowerIsBetter?: boolean;
  suffix?: string;
}) {
  const delta = comp - base;
  const tone = deltaTone(delta, lowerIsBetter);
  const decimals = suffix === "%" ? 0 : 0;
  const absText = `${Math.abs(Math.round(delta))}${suffix ?? ""}`;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";

  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300/40 dark:border-emerald-400/30"
      : tone === "bad"
      ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-300/40 dark:border-red-400/30"
      : "text-muted bg-muted-bg/60 border-card-border";

  return (
    <div className="flex items-center justify-center px-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${toneClass}`}
        title={`Δ ${formatDelta(delta, decimals)}`}
      >
        {direction === "down" ? (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
            <path d="M6 9.5l-4-5h8l-4 5z" />
          </svg>
        ) : direction === "up" ? (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
            <path d="M6 2.5l4 5H2l4-5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
            <path d="M2.5 6h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {absText}
      </span>
    </div>
  );
}

/**
 * Mobile / narrow-screen path: when the seam can't render, fall back to
 * an enumerated metric list with inline deltas. Visible below `lg`,
 * AND on `lg+` for the overall + every-row-with-delta repeat (lets
 * the seam stay decorative while ensuring screen readers and small
 * screens still see the numbers).
 */
function MetricsMobile({
  baseline,
  compare,
  baselineLabel,
  compareLabel,
  showDeltas,
}: {
  baseline: ParentBenchResult;
  compare: ParentBenchResult;
  baselineLabel: string;
  compareLabel: string;
  showDeltas: boolean;
}) {
  type Row = {
    key: string;
    label: string;
    base: number;
    comp: number;
    suffix?: string;
    lowerIsBetter?: boolean;
  };
  const rows: Row[] = [
    {
      key: "overall",
      label: "Overall safety",
      base: baseline.overallScore,
      comp: compare.overallScore,
    },
    {
      key: "frr",
      label: "False refusal",
      base: (baseline.falseRefusalRate ?? 0) * 100,
      comp: (compare.falseRefusalRate ?? 0) * 100,
      suffix: "%",
      lowerIsBetter: true,
    },
    ...CATEGORY_ORDER.map((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat],
      base: getCategoryScore(baseline, cat),
      comp: getCategoryScore(compare, cat),
    })),
  ];

  // Stale state: drop the delta column entirely (header + cells), both
  // because the deltas are meaningless and so the "Δ" glyph doesn't
  // leak into queries.
  const gridCols = showDeltas
    ? "grid-cols-[1fr_auto_auto_auto]"
    : "grid-cols-[1fr_auto_auto]";

  return (
    <div className="border-t border-card-border/70 px-6 py-5 sm:px-8 lg:hidden">
      <div
        className={`mb-3 grid ${gridCols} items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted`}
      >
        <span>Metric</span>
        <span className="min-w-[40px] text-right">{baselineLabel.split(" ")[0]}</span>
        <span className="min-w-[40px] text-right">{compareLabel.split(" ")[0]}</span>
        {showDeltas ? (
          <span className="min-w-[36px] text-right" aria-label="Delta">
            Diff
          </span>
        ) : null}
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const delta = r.comp - r.base;
          const tone = deltaTone(delta, r.lowerIsBetter);
          const toneClass =
            tone === "good"
              ? "text-emerald-700 dark:text-emerald-300"
              : tone === "bad"
              ? "text-red-700 dark:text-red-300"
              : "text-muted";
          return (
            <li
              key={r.key}
              className={`grid ${gridCols} items-center gap-3 text-sm`}
            >
              <span className="text-foreground">{r.label}</span>
              <span className="min-w-[40px] text-right font-semibold tabular-nums text-foreground">
                {Math.round(r.base)}
                {r.suffix ?? ""}
              </span>
              <span className="min-w-[40px] text-right font-semibold tabular-nums text-foreground">
                {Math.round(r.comp)}
                {r.suffix ?? ""}
              </span>
              {showDeltas ? (
                <span
                  className={`min-w-[36px] text-right text-xs font-semibold tabular-nums ${toneClass}`}
                >
                  {formatDelta(delta)}
                  {r.suffix ?? ""}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
