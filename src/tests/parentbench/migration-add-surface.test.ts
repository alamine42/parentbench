/**
 * Migration shape tests for parentbench-4tz.
 *
 * Verifies the `add-surface-column` migration script declares the right
 * SQL: a NOT NULL text column with default 'api-default' on both
 * `evaluations` and `scores`, plus the composite index for the
 * leaderboard tab query. Idempotent via `IF NOT EXISTS` and
 * `DO $$ ... duplicate_object`.
 */

import { describe, it, expect } from "vitest";

describe("migrate-add-surface-column", () => {
  it("should_export_a_statements_array", async () => {
    // Arrange + Act
    const mod = await import(
      "../../../scripts/migrate-add-surface-column"
    );

    // Assert
    expect(Array.isArray(mod.STATEMENTS)).toBe(true);
    expect(mod.STATEMENTS.length).toBeGreaterThan(0);
  });

  it("should_add_surface_column_to_evaluations_with_api_default_default", async () => {
    // Arrange
    const { STATEMENTS } = await import(
      "../../../scripts/migrate-add-surface-column"
    );

    // Act
    const evaluationsStmt = STATEMENTS.find(
      (s) => s.label === "evaluations.surface"
    );

    // Assert
    expect(evaluationsStmt).toBeDefined();
    expect(evaluationsStmt!.sql).toMatch(/ALTER TABLE\s+"evaluations"/);
    expect(evaluationsStmt!.sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+"surface"/);
    expect(evaluationsStmt!.sql).toMatch(/text/);
    expect(evaluationsStmt!.sql).toMatch(/NOT NULL/);
    expect(evaluationsStmt!.sql).toMatch(/DEFAULT\s+'api-default'/);
  });

  it("should_add_surface_column_to_scores_with_api_default_default", async () => {
    // Arrange
    const { STATEMENTS } = await import(
      "../../../scripts/migrate-add-surface-column"
    );

    // Act
    const scoresStmt = STATEMENTS.find((s) => s.label === "scores.surface");

    // Assert
    expect(scoresStmt).toBeDefined();
    expect(scoresStmt!.sql).toMatch(/ALTER TABLE\s+"scores"/);
    expect(scoresStmt!.sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+"surface"/);
    expect(scoresStmt!.sql).toMatch(/text/);
    expect(scoresStmt!.sql).toMatch(/NOT NULL/);
    expect(scoresStmt!.sql).toMatch(/DEFAULT\s+'api-default'/);
  });

  it("should_create_composite_index_on_scores_for_surface_tab_query", async () => {
    // Arrange
    const { STATEMENTS } = await import(
      "../../../scripts/migrate-add-surface-column"
    );

    // Act
    const indexStmt = STATEMENTS.find(
      (s) => s.label === "idx_scores_surface_model"
    );

    // Assert
    expect(indexStmt).toBeDefined();
    expect(indexStmt!.sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
    expect(indexStmt!.sql).toMatch(/idx_scores_surface_model/);
    expect(indexStmt!.sql).toMatch(/"scores"/);
    // Index must order by (surface, model_id, computed_at desc)
    expect(indexStmt!.sql).toMatch(
      /\(\s*"surface"\s*,\s*"model_id"\s*,\s*"computed_at"\s+DESC\s*\)/i
    );
  });

  it("should_use_idempotent_guards_on_every_statement", async () => {
    // Arrange
    const { STATEMENTS } = await import(
      "../../../scripts/migrate-add-surface-column"
    );

    // Act + Assert
    for (const { label, sql } of STATEMENTS) {
      const idempotent =
        /IF NOT EXISTS/i.test(sql) || /duplicate_object/i.test(sql);
      expect(
        idempotent,
        `${label} must be idempotent (IF NOT EXISTS or duplicate_object guard)`
      ).toBe(true);
    }
  });
});
