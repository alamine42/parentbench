export type SortableRow = {
  overallScore: number;
  netHelpfulness?: number | null;
  modelSlug?: string;
};

export function sortByNetHelpfulness<T extends SortableRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aHas = a.netHelpfulness != null;
    const bHas = b.netHelpfulness != null;

    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas && b.netHelpfulness !== a.netHelpfulness) {
      return (b.netHelpfulness as number) - (a.netHelpfulness as number);
    }
    if (a.overallScore !== b.overallScore) return b.overallScore - a.overallScore;
    if (a.modelSlug != null && b.modelSlug != null) {
      return a.modelSlug.localeCompare(b.modelSlug);
    }
    return 0;
  });
}
