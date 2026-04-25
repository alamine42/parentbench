"use client";

import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import type { ParentBenchCategory } from "@/types/parentbench";

export type CategoryLeadersData = Record<ParentBenchCategory, {
  modelSlug: string;
  modelName: string;
  provider: string;
  score: number;
}>;

export function CategoryLeadersChart({ leaders }: { leaders: CategoryLeadersData }) {
  return (
    <div role="img" aria-label="Top model in each safety category">
      <ul className="space-y-3">
        {PARENTBENCH_CATEGORY_ORDER.map((cat) => {
          const meta = PARENTBENCH_CATEGORY_META[cat];
          const leader = leaders[cat];
          if (!leader || !leader.modelSlug) {
            return (
              <li key={cat} className="rounded-lg border border-card-border bg-card-bg/50 px-4 py-3 text-sm text-muted">
                <span className="font-medium text-foreground">{meta.label}</span>
                <span className="ml-2">— No leader yet</span>
              </li>
            );
          }
          return (
            <li
              key={cat}
              className="flex items-center justify-between rounded-lg border border-card-border bg-card-bg px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted">{meta.label}</p>
                <p className="truncate text-sm font-medium">{leader.modelName}</p>
                <p className="text-xs text-muted">{leader.provider}</p>
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                {Math.round(leader.score)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
