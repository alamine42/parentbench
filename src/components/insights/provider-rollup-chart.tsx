"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PROVIDER_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function ProviderRollupChart({
  providers,
}: {
  providers: Array<{ name: string; avgOverall: number }>;
}) {
  if (providers.length === 0) {
    return <EmptyChart message="No provider data this month." />;
  }
  const data = [...providers].sort((a, b) => b.avgOverall - a.avgOverall);

  return (
    <div role="img" aria-label="Average overall score per provider, ranked highest to lowest">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v} / 100`} />
          <Bar dataKey="avgOverall" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="sr-only">
        {data.map((p) => (
          <span key={p.name}>{`${p.name}: ${p.avgOverall} of 100. `}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-card-border text-sm text-muted">
      {message}
    </div>
  );
}
