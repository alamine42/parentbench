"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

type Model = {
  slug: string;
  name: string;
  provider: {
    name: string;
    logoUrl?: string | null;
  };
};

type ModelSelectorProps = {
  models: Model[];
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
};

export function ModelSelector({
  models,
  selectedSlugs,
  onSelect,
  maxSelections = 4,
  placeholder = "Add model to compare...",
  className = "",
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out already selected models and search
  const availableModels = useMemo(() => {
    const filtered = models.filter(
      (m) =>
        !selectedSlugs.includes(m.slug) &&
        (m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.provider.name.toLowerCase().includes(search.toLowerCase()))
    );

    // Group by provider
    const grouped: Record<string, Model[]> = {};
    for (const model of filtered) {
      const provider = model.provider.name;
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }

    return grouped;
  }, [models, selectedSlugs, search]);

  const canAddMore = selectedSlugs.length < maxSelections;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (slug: string) => {
      onSelect(slug);
      setSearch("");
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleInputFocus = () => {
    if (canAddMore) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={handleInputFocus}
          placeholder={canAddMore ? placeholder : `Maximum ${maxSelections} models`}
          disabled={!canAddMore}
          className="w-full rounded-lg border border-card-border bg-card-bg px-4 py-2.5 pl-10 text-sm placeholder-muted transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <svg
              width="14"
              height="14"
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

      {isOpen && canAddMore && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-card-border bg-card-bg py-1 shadow-lg">
          {Object.keys(availableModels).length === 0 ? (
            <div className="px-4 py-3 text-center text-sm text-muted">
              {search
                ? "No models found"
                : "All available models have been selected"}
            </div>
          ) : (
            Object.entries(availableModels).map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider bg-muted-bg">
                  {provider}
                </div>
                {providerModels.map((model) => (
                  <button
                    key={model.slug}
                    onClick={() => handleSelect(model.slug)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted-bg"
                  >
                    {model.provider.logoUrl ? (
                      <img
                        src={model.provider.logoUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-contain"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-bg text-[10px] font-bold">
                        {model.name.charAt(0)}
                      </div>
                    )}
                    <span>{model.name}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
