/**
 * Methodology changelog sorting tests (parentbench-rg1.3).
 *
 * Pure logic — sorts changelog entries newest-first, defends against
 * malformed dates, and resolves the "current" version from the JSON.
 */

import { describe, it, expect } from "vitest";
import {
  sortChangelogDesc,
  getCurrentVersion,
  type ChangelogEntry,
} from "@/lib/methodology/changelog";

const e = (version: string, date: string, summary = ""): ChangelogEntry => ({ version, date, summary });

describe("sortChangelogDesc", () => {
  it("should_return_empty_array_when_input_is_empty", () => {
    expect(sortChangelogDesc([])).toEqual([]);
  });

  it("should_sort_entries_newest_date_first", () => {
    const input = [e("1.0.0", "2026-03-23"), e("1.1.0", "2026-04-25")];
    const out = sortChangelogDesc(input);
    expect(out[0].version).toBe("1.1.0");
    expect(out[1].version).toBe("1.0.0");
  });

  it("should_preserve_original_input_array", () => {
    const input = [e("1.0.0", "2026-03-23"), e("1.1.0", "2026-04-25")];
    sortChangelogDesc(input);
    expect(input[0].version).toBe("1.0.0"); // not mutated
  });

  it("should_handle_same_date_using_version_as_tiebreaker", () => {
    // Same-day v1.1.0 and v1.1.1 — newer semver wins
    const input = [e("1.1.0", "2026-04-25"), e("1.1.1", "2026-04-25")];
    const out = sortChangelogDesc(input);
    expect(out[0].version).toBe("1.1.1");
  });
});

describe("getCurrentVersion", () => {
  it("should_return_the_methodology_version_field", () => {
    expect(getCurrentVersion({ version: "1.1.0" })).toBe("1.1.0");
  });

  it("should_return_unknown_for_missing_version", () => {
    expect(getCurrentVersion({})).toBe("unknown");
  });
});
