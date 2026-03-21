"use client";

type ModelChipProps = {
  name: string;
  provider?: string;
  logoUrl?: string | null;
  onRemove?: () => void;
  showRemove?: boolean;
  className?: string;
};

export function ModelChip({
  name,
  provider,
  logoUrl,
  onRemove,
  showRemove = true,
  className = "",
}: ModelChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-3 py-1.5 ${className}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${provider || name} logo`}
          className="h-4 w-4 rounded-full object-contain"
        />
      ) : (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted-bg text-[10px] font-bold text-muted">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium">{name}</span>
      {provider && (
        <span className="text-xs text-muted">{provider}</span>
      )}
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-muted-bg hover:text-foreground transition-colors"
          aria-label={`Remove ${name}`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
