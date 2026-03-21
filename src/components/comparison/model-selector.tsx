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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Flatten for keyboard navigation
  const flatModels = useMemo(() => {
    return Object.values(availableModels).flat();
  }, [availableModels]);

  const canAddMore = selectedSlugs.length < maxSelections;
  const remainingSlots = maxSelections - selectedSlugs.length;

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

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const handleSelect = useCallback(
    (slug: string) => {
      onSelect(slug);
      setSearch("");
      setIsOpen(false);
      setHighlightedIndex(0);
    },
    [onSelect]
  );

  const handleInputFocus = () => {
    if (canAddMore) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < flatModels.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatModels[highlightedIndex]) {
          handleSelect(flatModels[highlightedIndex].slug);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.querySelector('[data-highlighted="true"]');
      highlighted?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input container */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={canAddMore ? placeholder : `Maximum ${maxSelections} models selected`}
          disabled={!canAddMore}
          className="w-full rounded-xl border border-card-border bg-card-bg px-4 py-3 pl-11 pr-12 text-sm placeholder-muted transition-all duration-200 elevation-1 focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:elevation-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="model-listbox"
          role="combobox"
        />

        {/* Search icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>

        {/* Remaining slots indicator */}
        {canAddMore && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted tabular-nums">
            {remainingSlots} left
          </span>
        )}

        {/* Clear button when searching */}
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors tap-target"
            aria-label="Clear search"
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

      {/* Dropdown */}
      {isOpen && canAddMore && (
        <div
          ref={listRef}
          id="model-listbox"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-card-border bg-card-bg py-2 elevation-4"
        >
          {Object.keys(availableModels).length === 0 ? (
            <div className="px-4 py-6 text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-2 text-muted opacity-50"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p className="text-sm text-muted">
                {search
                  ? "No models match your search"
                  : "All models have been selected"}
              </p>
            </div>
          ) : (
            Object.entries(availableModels).map(([provider, providerModels]) => (
              <div key={provider}>
                {/* Provider header */}
                <div className="sticky top-0 px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider bg-card-bg/95 backdrop-blur-sm border-b border-card-border/50">
                  {provider}
                </div>

                {/* Models */}
                {providerModels.map((model) => {
                  const globalIndex = flatModels.findIndex(
                    (m) => m.slug === model.slug
                  );
                  const isHighlighted = globalIndex === highlightedIndex;

                  return (
                    <button
                      key={model.slug}
                      onClick={() => handleSelect(model.slug)}
                      onMouseEnter={() => setHighlightedIndex(globalIndex)}
                      data-highlighted={isHighlighted}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors tap-target ${
                        isHighlighted
                          ? "bg-muted-bg"
                          : "hover:bg-muted-bg/50"
                      }`}
                      role="option"
                      aria-selected={isHighlighted}
                    >
                      {/* Logo */}
                      {model.provider.logoUrl ? (
                        <img
                          src={model.provider.logoUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-contain"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted-bg text-[10px] font-bold text-muted">
                          {model.name.charAt(0)}
                        </div>
                      )}

                      {/* Name */}
                      <span className="font-medium">{model.name}</span>

                      {/* Keyboard hint */}
                      {isHighlighted && (
                        <span className="ml-auto text-xs text-muted">
                          ↵ select
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
