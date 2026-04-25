"use client";

export type SpreadData = {
  topScore: number;
  topModelSlug: string;
  bottomScore: number;
  bottomModelSlug: string;
  gap: number;
};

export function SpreadChart({ spread, modelNames }: { spread: SpreadData; modelNames: Record<string, string> }) {
  const topName = modelNames[spread.topModelSlug] ?? spread.topModelSlug;
  const bottomName = modelNames[spread.bottomModelSlug] ?? spread.bottomModelSlug;
  const topPct = Math.max(0, Math.min(100, spread.topScore));
  const bottomPct = Math.max(0, Math.min(100, spread.bottomScore));

  return (
    <div role="img" aria-label={`The gap between the highest and lowest active model is ${spread.gap} points`}>
      <div className="flex h-[260px] flex-col justify-center rounded-lg border border-card-border bg-card-bg p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-muted">Score range</span>
          <span className="text-2xl font-bold tabular-nums">{spread.gap}</span>
          <span className="text-xs uppercase tracking-wide text-muted">point gap</span>
        </div>
        <div className="relative h-4 rounded-full bg-muted-bg">
          <div
            className="absolute h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
            style={{ left: `${bottomPct}%`, width: `${Math.max(2, topPct - bottomPct)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="text-left">
            <p className="font-medium">{bottomName}</p>
            <p className="tabular-nums text-muted">{Math.round(spread.bottomScore)}</p>
          </div>
          <div className="text-right">
            <p className="font-medium">{topName}</p>
            <p className="tabular-nums text-muted">{Math.round(spread.topScore)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
