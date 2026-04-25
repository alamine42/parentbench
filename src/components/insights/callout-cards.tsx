import type { ReactNode } from "react";

export type CalloutCardData = {
  kind: "category_leader" | "biggest_mover" | "newcomer" | "regression";
  title: string;
  body: string;
  subjectSlug: string;
};

const ICONS: Record<CalloutCardData["kind"], ReactNode> = {
  category_leader: <span aria-hidden>🥇</span>,
  biggest_mover: <span aria-hidden>📈</span>,
  newcomer: <span aria-hidden>✨</span>,
  regression: <span aria-hidden>⚠️</span>,
};

export function CalloutCards({
  callouts,
  hasMovers,
  hasNewcomers,
  hasRegressions,
}: {
  callouts: CalloutCardData[];
  hasMovers: boolean;
  hasNewcomers: boolean;
  hasRegressions: boolean;
}) {
  // Always show 3 slots: leader (always), mover or "calm waters", newcomer or "no debuts"
  const leader = callouts.find((c) => c.kind === "category_leader");
  const mover = callouts.find((c) => c.kind === "biggest_mover");
  const newcomer = callouts.find((c) => c.kind === "newcomer");
  const regression = callouts.find((c) => c.kind === "regression");

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {leader ? (
        <CalloutCard {...leader} />
      ) : (
        <CalloutFallback icon={ICONS.category_leader} title="Category leader" body="No leader data this month." />
      )}
      {mover ? (
        <CalloutCard {...mover} />
      ) : !hasMovers ? (
        <CalloutFallback icon={ICONS.biggest_mover} title="Biggest mover" body="No big movers this month — calm waters." />
      ) : regression ? (
        <CalloutCard {...regression} />
      ) : !hasRegressions ? (
        <CalloutFallback icon={ICONS.regression} title="Regression watch" body="No regressions worth flagging." />
      ) : null}
      {newcomer ? (
        <CalloutCard {...newcomer} />
      ) : !hasNewcomers ? (
        <CalloutFallback icon={ICONS.newcomer} title="New on the leaderboard" body="No new entrants this month." />
      ) : null}
    </div>
  );
}

function CalloutCard({ kind, title, body }: CalloutCardData) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {ICONS[kind]} <span>{labelFor(kind)}</span>
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

function CalloutFallback({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-card-border bg-card-bg/50 p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon} <span>{title}</span>
      </div>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

function labelFor(kind: CalloutCardData["kind"]): string {
  switch (kind) {
    case "category_leader": return "Category leader";
    case "biggest_mover": return "Biggest mover";
    case "newcomer": return "New entrant";
    case "regression": return "Regression watch";
  }
}
