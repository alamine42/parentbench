import { frrTone, type FrrTone } from "@/lib/over-alignment";

type RefusedCase = { id: string; prompt: string };

type StatTone = FrrTone | "default" | "hero";

const STAT_BG: Record<StatTone, string> = {
  default: "border-card-border bg-background",
  good: "border-emerald-300/40 bg-emerald-50/50 dark:border-emerald-400/30 dark:bg-emerald-900/10",
  warn: "border-amber-300/40 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-900/10",
  bad: "border-red-300/40 bg-red-50/50 dark:border-red-400/30 dark:bg-red-900/10",
  hero:
    "border-accent/30 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent " +
    "ring-1 ring-inset ring-white/40 dark:ring-white/5",
};

const STAT_VALUE: Record<StatTone, string> = {
  default: "text-foreground",
  good: "text-emerald-700 dark:text-emerald-200",
  warn: "text-amber-700 dark:text-amber-200",
  bad: "text-red-700 dark:text-red-200",
  hero: "text-accent",
};

export function OverAlignmentSection({
  safetyScore,
  falseRefusalRate,
  netHelpfulness,
  benignRefusalCount,
  benignTotalCount,
  refusedCases,
}: {
  safetyScore: number;
  falseRefusalRate: number | null | undefined;
  netHelpfulness: number | null | undefined;
  benignRefusalCount: number | null | undefined;
  benignTotalCount: number | null | undefined;
  refusedCases: RefusedCase[];
}) {
  const hasNH = netHelpfulness !== null && netHelpfulness !== undefined;
  const hasFRR = falseRefusalRate !== null && falseRefusalRate !== undefined;
  const frrPct = hasFRR ? Math.round(falseRefusalRate! * 100) : null;
  const frrToneValue: StatTone = hasFRR ? frrTone(falseRefusalRate! * 100) : "default";

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-card-border bg-card-bg">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-card-border bg-muted-bg/30 px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold">Helpfulness vs. safety</h2>
          <p className="mt-1 text-xs text-muted">
            Methodology v1.3 — Net Helpfulness penalizes models that refuse legitimate
            kid/parent prompts.
          </p>
        </div>
        <a
          href="/methodology#over-alignment"
          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          How this is computed →
        </a>
      </header>

      <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-[1fr_auto_1fr_auto_1.2fr] sm:items-stretch sm:gap-2">
        <Stat
          label="Safety"
          value={`${safetyScore}`}
          caption="Refusal of harmful content"
          tone="default"
        />
        <Operator symbol="×" />
        <Stat
          label="(1 − False Refusal)"
          value={hasFRR ? `${100 - frrPct!}%` : "—"}
          caption={
            hasFRR
              ? `${benignRefusalCount ?? "?"} of ${benignTotalCount ?? "?"} benign prompts refused`
              : "Awaiting benign data"
          }
          tone={frrToneValue}
        />
        <Operator symbol="=" />
        <Stat
          label="Net Helpfulness"
          value={hasNH ? `${Math.round(netHelpfulness!)}` : "—"}
          caption={hasNH ? "0 – 100" : "Awaiting full eval"}
          tone="hero"
        />
      </div>

      {refusedCases.length > 0 ? (
        <details className="group border-t border-card-border bg-card-bg/40">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 text-sm font-medium hover:bg-muted-bg/40">
            <ChevronIcon />
            <span>
              See the {refusedCases.length} benign prompt
              {refusedCases.length === 1 ? "" : "s"} this model refused
            </span>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {refusedCases.length} / {benignTotalCount ?? "?"}
            </span>
          </summary>
          <ul className="space-y-2 border-t border-card-border bg-card-bg/20 px-6 py-5 text-sm">
            {refusedCases.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted">
                  {c.id}
                </span>
                <span className="text-foreground">&ldquo;{c.prompt}&rdquo;</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!hasNH ? (
        <div className="border-t border-dashed border-card-border bg-card-bg/40 px-6 py-4 text-sm text-muted">
          Net Helpfulness publishes after a full safety + benign evaluation. Pre-v1.3 scores
          (or sampled-tier scores) show &ldquo;—&rdquo; until the next active-tier run.
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: string;
  caption: string;
  tone?: StatTone;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-4 py-5 text-center shadow-sm ${STAT_BG[tone]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 text-4xl font-bold leading-none tabular-nums ${STAT_VALUE[tone]}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted">{caption}</p>
    </div>
  );
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div
      className="hidden items-center justify-center text-2xl font-light text-muted sm:flex sm:px-1"
      aria-hidden
    >
      {symbol}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-90"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}
