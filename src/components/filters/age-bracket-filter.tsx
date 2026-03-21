"use client";

import { useCallback, useRef, useState, useEffect } from "react";

export type AgeBracket = "6-9" | "10-12" | "13-15";
export type AgeBracketFilter = AgeBracket | "all";

type AgeBracketFilterProps = {
  value: AgeBracketFilter;
  onChange: (bracket: AgeBracketFilter) => void;
  className?: string;
};

const AGE_BRACKETS: { value: AgeBracketFilter; label: string; description: string }[] = [
  { value: "all", label: "All Ages", description: "Show results for all age groups" },
  { value: "6-9", label: "6-9 years", description: "Early childhood (1st-4th grade)" },
  { value: "10-12", label: "10-12 years", description: "Pre-teen (5th-7th grade)" },
  { value: "13-15", label: "13-15 years", description: "Teen (8th-10th grade)" },
];

export function AgeBracketFilterDropdown({
  value,
  onChange,
  className = "",
}: AgeBracketFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedBracket = AGE_BRACKETS.find((b) => b.value === value) || AGE_BRACKETS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (bracket: AgeBracketFilter) => {
      onChange(bracket);
      setIsOpen(false);
    },
    [onChange]
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-bg"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Age: {selectedBracket.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-card-border bg-card-bg py-1 shadow-lg"
          role="listbox"
        >
          {AGE_BRACKETS.map((bracket) => (
            <button
              key={bracket.value}
              onClick={() => handleSelect(bracket.value)}
              className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-muted-bg ${
                value === bracket.value ? "bg-muted-bg" : ""
              }`}
              role="option"
              aria-selected={value === bracket.value}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {value === bracket.value && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
                <span className={value === bracket.value ? "" : "ml-5"}>
                  {bracket.label}
                </span>
              </span>
              <span className="ml-5 text-xs text-muted">{bracket.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Button group variant for inline use
type AgeBracketButtonGroupProps = {
  value: AgeBracketFilter;
  onChange: (bracket: AgeBracketFilter) => void;
  className?: string;
};

export function AgeBracketButtonGroup({
  value,
  onChange,
  className = "",
}: AgeBracketButtonGroupProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-card-border bg-card-bg p-1 ${className}`}
      role="group"
      aria-label="Filter by age group"
    >
      {AGE_BRACKETS.map((bracket) => (
        <button
          key={bracket.value}
          onClick={() => onChange(bracket.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === bracket.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground hover:bg-muted-bg"
          }`}
          aria-pressed={value === bracket.value}
          title={bracket.description}
        >
          {bracket.value === "all" ? "All" : bracket.value}
        </button>
      ))}
    </div>
  );
}
