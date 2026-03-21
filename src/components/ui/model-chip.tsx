"use client";

import { useState } from "react";

type ModelChipProps = {
  name: string;
  provider?: string;
  logoUrl?: string | null;
  onRemove?: () => void;
  showRemove?: boolean;
  variant?: "default" | "compact";
  className?: string;
};

export function ModelChip({
  name,
  provider,
  logoUrl,
  onRemove,
  showRemove = true,
  variant = "default",
  className = "",
}: ModelChipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const showFallbackIcon = !logoUrl || imageError;

  return (
    <div
      className={`group inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg transition-all duration-200 elevation-1 hover:elevation-2 hover:border-muted ${
        variant === "compact" ? "px-2.5 py-1" : "px-3 py-1.5"
      } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo/Avatar */}
      <div className="relative flex-shrink-0">
        {showFallbackIcon ? (
          <div className={`flex items-center justify-center rounded-full bg-gradient-to-br from-muted-bg to-card-border font-bold text-muted ${
            variant === "compact" ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]"
          }`}>
            {name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <img
            src={logoUrl}
            alt={`${provider || name} logo`}
            className={`rounded-full object-contain ${
              variant === "compact" ? "h-4 w-4" : "h-5 w-5"
            }`}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Text content */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`font-medium truncate ${
          variant === "compact" ? "text-xs" : "text-sm"
        }`}>
          {name}
        </span>
        {provider && variant !== "compact" && (
          <span className="text-xs text-muted truncate hidden sm:inline">
            {provider}
          </span>
        )}
      </div>

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`flex-shrink-0 flex items-center justify-center rounded-full text-muted transition-all duration-200 tap-target ${
            variant === "compact" ? "h-4 w-4 -mr-0.5" : "h-5 w-5"
          } ${
            isHovered
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "hover:bg-muted-bg hover:text-foreground"
          }`}
          aria-label={`Remove ${name}`}
        >
          <svg
            width={variant === "compact" ? 8 : 10}
            height={variant === "compact" ? 8 : 10}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
