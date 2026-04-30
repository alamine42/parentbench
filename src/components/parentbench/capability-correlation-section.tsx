/**
 * "Is ParentBench just measuring how smart the model is?" section
 * (parentbench-rg1.2).
 *
 * Renders the latest correlation_reports row (or an honest empty
 * state). Headlines |ρ| with explicit sign annotation per the
 * Codex-CRITICAL fix — never frames Spearman ρ as "lower is better"
 * since negative values are equally concerning.
 */

import type { LatestCorrelationReport } from "@/lib/capability/get-latest-report";

export function CapabilityCorrelationSection({
  report,
}: {
  report: LatestCorrelationReport;
}) {
  if (!report) {
    return (
      <div className="mt-10 rounded-2xl border border-card-border bg-card-bg/40 p-6">
        <h2 className="text-xl font-bold">Is ParentBench just measuring how smart the model is?</h2>
        <p className="mt-3 text-sm text-muted">
          We&apos;re populating capability benchmark data for our active
          models (MMLU, GPQA Diamond, AIME 2025). The first correlation
          report will publish once at least 5 active models have ≥2
          benchmark scores each.
        </p>
        <p className="mt-3 text-sm text-muted">
          <strong className="text-foreground">Why we&apos;re doing this:</strong>{" "}
          Ren et al. (
          <a className="underline" href="https://arxiv.org/abs/2407.21792" target="_blank" rel="noopener noreferrer">
            Safetywashing, 2024
          </a>
          ) showed that ~half of widely-cited safety benchmarks correlate {">"}0.80
          with raw model capability — i.e., they reward bigger models, not
          safer ones. We&apos;ll report our number transparently and recompute
          quarterly.
        </p>
      </div>
    );
  }

  const sign: "positive" | "negative" | "neutral" =
    report.spearmanRho > 0.05 ? "positive" : report.spearmanRho < -0.05 ? "negative" : "neutral";

  const interpretation = describeStrength(report.spearmanRhoAbs);

  return (
    <div className="mt-10 rounded-2xl border border-card-border bg-card-bg/40 p-6">
      <h2 className="text-xl font-bold">Is ParentBench just measuring how smart the model is?</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-baseline">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Coupling to capability</span>
          <span className="text-3xl font-bold tabular-nums">|ρ| = {report.spearmanRhoAbs.toFixed(2)}</span>
          <SignBadge sign={sign} />
        </div>
        <p className="text-sm text-muted">
          {interpretation}
          {sign === "positive" ? (
            <> Sign is <strong className="text-foreground">positive</strong>: more-capable models tend to score higher on ParentBench.</>
          ) : sign === "negative" ? (
            <> Sign is <strong className="text-foreground">negative</strong>: more-capable models tend to score lower on ParentBench. <em>Worth investigating</em> — it usually points to over-cautious refusal patterns in the largest models.</>
          ) : (
            <> Sign is roughly <strong className="text-foreground">neutral</strong>.</>
          )}
        </p>
      </div>

      <ul className="mt-5 space-y-1 text-sm text-muted">
        <li><strong className="text-foreground">|ρ| near 0</strong> — ParentBench captures something independent of raw capability.</li>
        <li><strong className="text-foreground">|ρ| near 1</strong> — the score mostly tracks how strong the model is overall (the &quot;safetywashing&quot; risk).</li>
      </ul>

      <p className="mt-5 text-xs text-muted">
        Computed across <strong>{report.modelCount}</strong> active models against{" "}
        <strong>{report.benchmarksUsed.map((b) => b.toUpperCase()).join(", ")}</strong> as a capability component
        (z-score average). Last updated{" "}
        {new Date(report.computedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}{" "}
        (methodology v{report.methodologyVersion}).
        With n={report.modelCount}, treat this as a directional signal, not a precise estimate.
      </p>

      {report.isStale ? (
        <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠️ This figure was computed {report.ageInDays} days ago. A refresh is overdue.
        </div>
      ) : null}
    </div>
  );
}

function SignBadge({ sign }: { sign: "positive" | "negative" | "neutral" }) {
  const styles = {
    positive: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    negative: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  const symbol = sign === "positive" ? "+" : sign === "negative" ? "−" : "±";
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${styles[sign]}`} title={`Sign: ${sign}`}>
      {symbol}
    </span>
  );
}

function describeStrength(absRho: number): string {
  if (absRho < 0.2) return "ParentBench shows almost no coupling to general capability — strong evidence the score reflects child-safety behavior, not raw model strength.";
  if (absRho < 0.4) return "Modest coupling to general capability — most of what ParentBench measures is independent of how capable a model is overall.";
  if (absRho < 0.6) return "Moderate coupling — capability explains a meaningful chunk of ParentBench scores. We track this number to keep ourselves honest.";
  if (absRho < 0.8) return "Strong coupling — a large share of the ParentBench score moves with raw capability. Worth scrutinizing.";
  return "Very strong coupling — ParentBench is largely tracking general capability.";
}
