/**
 * Pure helpers for the methodology changelog (parentbench-rg1.3).
 */

export type ChangelogEntry = {
  version: string;
  date: string;     // ISO YYYY-MM-DD
  summary: string;
};

/**
 * Sort entries newest-first by date, falling back to semver-string
 * comparison on identical dates.
 */
export function sortChangelogDesc(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return compareSemverDesc(a.version, b.version);
  });
}

function compareSemverDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getCurrentVersion(methodology: { version?: string }): string {
  return methodology.version ?? "unknown";
}
