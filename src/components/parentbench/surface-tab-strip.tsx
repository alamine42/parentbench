/**
 * Surface tab strip for the leaderboard (parentbench-bb7).
 *
 * Pill-rail design: a soft rounded container holds two pills; the active
 * pill lifts up with a white surface + soft shadow + thin border.
 * Mobile: full-bleed segmented control with equal pill widths.
 *
 * The "Web" pill carries a small accent dot to signal that it represents
 * the consumer surface (what kids actually see) — the actionable view —
 * versus the API default which is a measurement instrument.
 */

import Link from "next/link";
import type { EvaluationSurface } from "@/types/parentbench";

type SurfaceMeta = {
  value: EvaluationSurface;
  label: string;
  shortLabel: string;
  hint: string;
  icon: React.ReactNode;
  /** Subtle accent dot on inactive state to distinguish surfaces. */
  accentDot?: "new";
};

const SURFACES: ReadonlyArray<SurfaceMeta> = [
  {
    value: "api-default",
    label: "API default",
    shortLabel: "API",
    hint: "How the model behaves on a clean API call",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          d="M5 5l-3 3 3 3M11 5l3 3-3 3M9 3l-2 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    value: "web-product",
    label: "Web (consumer)",
    shortLabel: "Web",
    hint: "What kids actually see in chatgpt.com, claude.ai, gemini & grok",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
        <rect
          x="2"
          y="3"
          width="12"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M2 6h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="4.5" cy="4.75" r="0.5" fill="currentColor" />
      </svg>
    ),
    accentDot: "new",
  },
];

export function surfaceFromQuery(
  raw: string | string[] | undefined
): EvaluationSurface {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === "api-default" ||
    value === "web-product" ||
    value === "web-product-anonymous" ||
    value === "web-product-teen-mode" ||
    value === "api-with-system-prompt"
  ) {
    return value;
  }
  return "api-default";
}

export function SurfaceTabStrip({ active }: { active: EvaluationSurface }) {
  const activeMeta = SURFACES.find((s) => s.value === active) ?? SURFACES[0];

  return (
    <div className="mb-6">
      <nav
        aria-label="Surface filter"
        className="inline-flex w-full items-stretch gap-1 rounded-2xl border border-card-border bg-muted-bg/50 p-1
                   shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm
                   sm:w-auto dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        {SURFACES.map((s) => {
          const isActive = s.value === active;
          const href =
            s.value === "api-default" ? "/leaderboard" : `/leaderboard?surface=${s.value}`;

          const baseClass =
            "group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 " +
            "text-sm font-semibold transition-all duration-200 ease-out " +
            "min-h-[44px] sm:flex-initial sm:min-w-[160px]";

          const activeClass =
            "bg-card-bg text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.08)] " +
            "ring-1 ring-card-border/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_12px_-2px_rgba(0,0,0,0.5)]";

          const inactiveClass =
            "text-muted hover:text-foreground hover:bg-card-bg/60 active:scale-[0.98]";

          return (
            <Link
              key={s.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={`${s.label} — ${s.hint}`}
              className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
            >
              <span
                className={`transition-colors duration-200 ${
                  isActive ? "text-accent" : "text-muted/70 group-hover:text-foreground"
                }`}
              >
                {s.icon}
              </span>

              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.shortLabel}</span>

              {s.accentDot === "new" && !isActive ? (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent
                             shadow-[0_0_0_3px_rgba(37,99,235,0.18)] dark:shadow-[0_0_0_3px_rgba(96,165,250,0.22)]"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <p className="mt-2.5 text-xs text-muted">
        <span className="font-medium text-foreground/80">{activeMeta.label}:</span>{" "}
        {activeMeta.hint}
      </p>
    </div>
  );
}
