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
  className?: string;
};

const VARIANT_DEFAULTS: Record<
  EmptyStateVariant,
  { title: string; description: string; icon: React.ReactNode }
> = {
  "no-history": {
    title: "No score history yet",
    description: "This model hasn't been evaluated multiple times yet. Check back after future evaluations.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 12l4-4 4 4 5-5" />
      </svg>
    ),
  },
  "no-comparison": {
    title: "Select models to compare",
    description: "Add at least 2 models to see a side-by-side comparison of their safety scores.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  "no-results": {
    title: "No matching results",
    description: "Try adjusting your filters or search terms to find what you're looking for.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M8 8l6 6M14 8l-6 6" />
      </svg>
    ),
  },
  "no-data": {
    title: "No data available",
    description: "We don't have enough data to display this information yet.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
};

export function EmptyState({
  variant,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const defaults = VARIANT_DEFAULTS[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <div className="text-muted">{defaults.icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title || defaults.title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {description || defaults.description}
      </p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
