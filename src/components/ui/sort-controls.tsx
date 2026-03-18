"use client";

type SortField = "score" | "name" | "date";

type SortControlsProps = {
  providers: string[];
  sortBy: SortField;
  filterProvider: string;
  onSortChange: (field: SortField) => void;
  onFilterChange: (provider: string) => void;
};

export function SortControls({
  providers,
  sortBy,
  filterProvider,
  onSortChange,
  onFilterChange,
}: SortControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="text-sm font-medium text-muted">
          Sort by
        </label>
        <select
          id="sort"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortField)}
          className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-foreground"
        >
          <option value="score">Safety Score</option>
          <option value="name">Name</option>
          <option value="date">Date Evaluated</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter" className="text-sm font-medium text-muted">
          Provider
        </label>
        <select
          id="filter"
          value={filterProvider}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-foreground"
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export type { SortField };
