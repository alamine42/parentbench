export type FrrTone = "good" | "warn" | "bad";

export function frrTone(pct: number): FrrTone {
  if (pct <= 10) return "good";
  if (pct <= 30) return "warn";
  return "bad";
}
