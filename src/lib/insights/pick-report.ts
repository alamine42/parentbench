/**
 * Report-selection logic for /insights (parentbench-ov1.5).
 *
 * Rules (per design §5.4 P7, P8):
 *   - Pick the most recent `published` report.
 *   - Skip drafts, generation_failed, and retracted entries.
 *   - Return null if no published report exists (caller renders 404).
 */

export type ReportPickerRow = {
  id: string;
  status: "draft" | "generation_failed" | "published" | "retracted";
  generatedAt: Date;
};

export function pickPublishedForInsightsRoute<T extends ReportPickerRow>(rows: T[]): T | null {
  const published = rows.filter((r) => r.status === "published");
  if (published.length === 0) return null;
  return published.reduce((best, r) =>
    r.generatedAt > best.generatedAt ? r : best
  );
}
