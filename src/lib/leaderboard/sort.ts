export type SortableRow = {
  overallScore: number;
  netHelpfulness?: number | null;
};

export function sortByNetHelpfulness<T extends SortableRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aNH = a.netHelpfulness;
    const bNH = b.netHelpfulness;
    const aHas = aNH !== null && aNH !== undefined;
    const bHas = bNH !== null && bNH !== undefined;

    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas && bNH !== aNH) return (bNH as number) - (aNH as number);

    return b.overallScore - a.overallScore;
  });
}
