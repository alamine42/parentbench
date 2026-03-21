import Link from "next/link";

type EmptyStateVariant = "no-history" | "no-comparison" | "no-results" | "no-data";

type EmptyStateProps = {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
};

// Minimalist, modern illustrations for each variant
const VARIANT_DEFAULTS: Record<
  EmptyStateVariant,
  { title: string; description: string; icon: React.ReactNode }
> = {
  "no-history": {
    title: "No score history yet",
    description: "This model hasn't been evaluated multiple times. History will appear after the next evaluation cycle.",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-muted">
        {/* Chart with dashed line indicating future data */}
        <rect x="8" y="8" width="48" height="48" rx="8" className="fill-muted-bg" />
        <path d="M16 48V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 48H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M20 40L28 32L36 36L44 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 4"
          className="opacity-50"
        />
        <circle cx="44" cy="24" r="3" className="fill-current opacity-50" />
      </svg>
    ),
  },
  "no-comparison": {
    title: "Compare AI models",
    description: "Select 2 or more models to see a detailed side-by-side comparison of their safety scores.",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-muted">
        {/* Two cards side by side */}
        <rect x="6" y="12" width="24" height="40" rx="4" className="fill-muted-bg stroke-current" strokeWidth="2" />
        <rect x="34" y="12" width="24" height="40" rx="4" className="fill-muted-bg stroke-current" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="18" cy="26" r="6" className="fill-current opacity-30" />
        <rect x="12" y="36" width="12" height="2" rx="1" className="fill-current opacity-40" />
        <rect x="12" y="42" width="8" height="2" rx="1" className="fill-current opacity-20" />
        {/* Plus icon on dashed card */}
        <path d="M46 28V36M42 32H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  "no-results": {
    title: "No matching results",
    description: "Try adjusting your search terms or filters to find what you're looking for.",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-muted">
        {/* Magnifying glass with X */}
        <circle cx="28" cy="28" r="16" className="fill-muted-bg stroke-current" strokeWidth="2" />
        <path d="M40 40L52 52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M22 22L34 34M34 22L22 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60" />
      </svg>
    ),
  },
  "no-data": {
    title: "No data available",
    description: "We're still gathering data for this view. Check back soon for updated information.",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-muted">
        {/* Database with loading indicator */}
        <ellipse cx="32" cy="20" rx="18" ry="8" className="fill-muted-bg stroke-current" strokeWidth="2" />
        <path d="M14 20V44C14 48.4 22 52 32 52C42 52 50 48.4 50 44V20" stroke="currentColor" strokeWidth="2" />
        <path d="M14 32C14 36.4 22 40 32 40C42 40 50 36.4 50 32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="opacity-50" />
        {/* Animated dots suggestion */}
        <circle cx="24" cy="32" r="2" className="fill-current opacity-30" />
        <circle cx="32" cy="32" r="2" className="fill-current opacity-50" />
        <circle cx="40" cy="32" r="2" className="fill-current opacity-30" />
      </svg>
    ),
  },
};

export function EmptyState({
  variant,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const defaults = VARIANT_DEFAULTS[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {/* Icon with subtle animation */}
      <div className="mb-6 opacity-80 transition-transform duration-300 hover:scale-105">
        {defaults.icon}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold tracking-tight">
        {title || defaults.title}
      </h3>

      {/* Description */}
      <p className="mt-3 max-w-md text-sm text-muted leading-relaxed">
        {description || defaults.description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] elevation-2 tap-target"
              >
                {action.label}
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] elevation-2 tap-target"
              >
                {action.label}
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-card-border bg-card-bg px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-muted-bg hover:border-muted tap-target"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-card-border bg-card-bg px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-muted-bg hover:border-muted tap-target"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
