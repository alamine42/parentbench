/**
 * Reader contract tests for parentbench-4tz.
 *
 * Asserts the surface-aware reader API: `getParentBenchScores` filters
 * to a single surface (defaulting to `api-default` for back-compat) and
 * returns one row per model within that surface. A new
 * `getParentBenchScoresByModel` returns one row per surface for a given
 * model — that's what the per-model comparison panel renders from.
 *
 * Mocks @/db so we exercise the contract, not Postgres.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParentBenchResult } from "@/types/parentbench";

type DbRow = {
  modelSlug: string;
  surface: string;
  overallScore: number;
  overallGrade: string;
  trend: string;
  dataQuality: string;
  categoryScores: ParentBenchResult["categoryScores"];
  evaluatedDate: Date;
  confidence: ParentBenchResult["confidence"];
  variance: number | null;
  isPartial: boolean;
  falseRefusalRate: number | null;
  netHelpfulness: number | null;
  benignRefusalCount: number | null;
  benignTotalCount: number | null;
  refusedBenignCaseIds: string[] | null;
  isActive: boolean;
};

function makeRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    modelSlug: "claude-opus-4-7",
    surface: "api-default",
    overallScore: 90,
    overallGrade: "A-",
    trend: "stable",
    dataQuality: "verified",
    categoryScores: [],
    evaluatedDate: new Date("2026-04-29"),
    confidence: "high",
    variance: 1.2,
    isPartial: false,
    falseRefusalRate: 0.04,
    netHelpfulness: 86,
    benignRefusalCount: 1,
    benignTotalCount: 25,
    refusedBenignCaseIds: [],
    isActive: true,
    ...overrides,
  };
}

let dbRows: DbRow[] = [];

// Marker objects standing in for drizzle's `eq`/`and` expressions. The mock
// chain captures these and applies them client-side. This keeps the production
// code's WHERE clauses (eq(scores.surface, X), eq(models.slug, Y), eq(models.isActive, true))
// observable from tests without mocking Postgres.
type Predicate =
  | { kind: "eq"; field: string; value: unknown }
  | { kind: "and"; conditions: Predicate[] };

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>(
    "drizzle-orm"
  );
  return {
    ...actual,
    eq: (col: { name?: string } | unknown, value: unknown): Predicate => {
      // Drizzle column refs carry a `.name` property; otherwise fall back
      // to a stringified handle. The handle never appears in assertions —
      // it just lets the mock filter by column identity.
      const name =
        typeof col === "object" && col !== null && "name" in col
          ? String((col as { name: unknown }).name)
          : String(col);
      return { kind: "eq", field: name, value };
    },
    and: (...conditions: Predicate[]): Predicate => ({
      kind: "and",
      conditions,
    }),
  };
});

function rowMatches(row: DbRow, predicate: Predicate | undefined): boolean {
  if (!predicate) return true;
  if (predicate.kind === "and") {
    return predicate.conditions.every((c) => rowMatches(row, c));
  }
  // kind === "eq"
  switch (predicate.field) {
    case "surface":
      return row.surface === predicate.value;
    case "slug":
      return row.modelSlug === predicate.value;
    case "is_active":
      return row.isActive === predicate.value;
    case "model_id":
      // Cross-table join key — always true in our flattened mock.
      return true;
    default:
      return true;
  }
}

vi.mock("@/db", () => {
  const buildChain = () => {
    let predicate: Predicate | undefined;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.from = () => chain;
    chain.innerJoin = () => chain;
    chain.where = (p: Predicate) => {
      predicate = p;
      return chain;
    };
    chain.orderBy = () =>
      Promise.resolve(
        dbRows
          .filter((r) => rowMatches(r, predicate))
          .slice()
          .sort(
            (a, b) =>
              b.evaluatedDate.getTime() - a.evaluatedDate.getTime()
          )
      );
    return chain;
  };
  // Each `db.select()` call must reset the chain — otherwise predicates leak
  // across queries.
  return {
    db: {
      select: (...args: unknown[]) => {
        const chain = buildChain();
        return (chain.select as (...a: unknown[]) => unknown)(...args);
      },
    },
  };
});

beforeEach(() => {
  vi.resetModules();
  dbRows = [];
});

describe("getParentBenchScores", () => {
  it("should_default_to_api_default_surface_for_back_compat", async () => {
    // Arrange
    dbRows = [
      makeRow({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      makeRow({ modelSlug: "gpt-5", surface: "web-product" }),
    ];
    const { getParentBenchScores } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScores();

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].modelSlug).toBe("claude-opus-4-7");
    expect(result[0].surface).toBe("api-default");
  });

  it("should_filter_to_requested_surface_when_specified", async () => {
    // Arrange
    dbRows = [
      makeRow({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      makeRow({ modelSlug: "gpt-5", surface: "web-product" }),
    ];
    const { getParentBenchScores } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScores("web-product");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].modelSlug).toBe("gpt-5");
    expect(result[0].surface).toBe("web-product");
  });

  it("should_return_one_row_per_model_within_a_surface", async () => {
    // Arrange — same model, same surface, two scores; older one must be dropped
    dbRows = [
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 90,
        evaluatedDate: new Date("2026-04-29"),
      }),
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 60,
        evaluatedDate: new Date("2025-12-01"),
      }),
    ];
    const { getParentBenchScores } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScores();

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].overallScore).toBe(90);
  });

  it("should_not_collapse_distinct_surfaces_for_the_same_model", async () => {
    // Arrange — same model has both an api-default and a web-product score.
    // When we ask for api-default, only the api row appears. When we ask for
    // web-product, only the web row appears. Surfaces are independent.
    dbRows = [
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 90,
      }),
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "web-product",
        overallScore: 76,
      }),
    ];
    const { getParentBenchScores } = await import("@/lib/parentbench");

    // Act
    const apiRows = await getParentBenchScores("api-default");
    const webRows = await getParentBenchScores("web-product");

    // Assert
    expect(apiRows).toHaveLength(1);
    expect(apiRows[0].overallScore).toBe(90);
    expect(webRows).toHaveLength(1);
    expect(webRows[0].overallScore).toBe(76);
  });
});

describe("getParentBenchScoresByModel", () => {
  it("should_return_one_row_per_surface_for_the_given_model", async () => {
    // Arrange
    dbRows = [
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 90,
      }),
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "web-product",
        overallScore: 76,
      }),
      makeRow({
        modelSlug: "gpt-5",
        surface: "api-default",
        overallScore: 80,
      }),
    ];
    const { getParentBenchScoresByModel } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScoresByModel("claude-opus-4-7");

    // Assert
    expect(result).toHaveLength(2);
    const surfaces = result.map((r) => r.surface).sort();
    expect(surfaces).toEqual(["api-default", "web-product"]);
  });

  it("should_keep_only_the_latest_score_per_surface", async () => {
    // Arrange
    dbRows = [
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 90,
        evaluatedDate: new Date("2026-04-29"),
      }),
      makeRow({
        modelSlug: "claude-opus-4-7",
        surface: "api-default",
        overallScore: 60,
        evaluatedDate: new Date("2025-12-01"),
      }),
    ];
    const { getParentBenchScoresByModel } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScoresByModel("claude-opus-4-7");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].overallScore).toBe(90);
  });

  it("should_return_empty_array_when_model_has_no_scores", async () => {
    // Arrange
    dbRows = [
      makeRow({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
    ];
    const { getParentBenchScoresByModel } = await import("@/lib/parentbench");

    // Act
    const result = await getParentBenchScoresByModel("nonexistent-model");

    // Assert
    expect(result).toEqual([]);
  });
});
