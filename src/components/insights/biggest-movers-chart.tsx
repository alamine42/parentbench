"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

export type BiggestMoversData = Array<{
  modelSlug: string;
  modelName: string;
  provider: string;
  deltaPoints: number;
  direction: "up" | "down";
}>;

const UP_COLOR = "#10b981";
const DOWN_COLOR = "#ef4444";

export function BiggestMoversChart({ movers }: { movers: BiggestMoversData }) {
  if (movers.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-card-border text-center text-sm text-muted">
        <span>
          No big movers this month — calm waters.
          <br />
          <span className="text-xs">Models within ±5 points are filtered out.</span>
        </span>
      </div>
    );
  }
  const data = [...movers]
    .sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))
    .slice(0, 5);

  return (
    <div role="img" aria-label="Models with the largest score change in the last 30 days">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 100 }}>
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="modelName" width={100} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${typeof v === "number" && v > 0 ? "+" : ""}${v} pts`} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Bar dataKey="deltaPoints" radius={[0, 4, 4, 0]}>
            {data.map((m, i) => (
              <Cell key={i} fill={m.direction === "up" ? UP_COLOR : DOWN_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="sr-only">
        {data.map((m) => (
          <span key={m.modelSlug}>{`${m.modelName} ${m.direction === "up" ? "gained" : "lost"} ${Math.abs(m.deltaPoints)} points. `}</span>
        ))}
      </div>
    </div>
  );
}
