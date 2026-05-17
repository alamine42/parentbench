/**
 * Freeze mode (2026-05-17).
 *
 * When `FROZEN=1`, public pages read from `src/data/snapshot/*.json`
 * instead of the live Postgres database. Write endpoints return 503.
 * Inngest cron triggers are stripped (see scheduled-evaluations.ts,
 * cleanup-stuck-evals.ts, etc).
 *
 * To unfreeze: see `docs/solutions/integration-issues/freezing-and-unfreezing-parentbench.md`.
 */

import fs from "fs/promises";
import path from "path";
import { cache } from "react";

export const FROZEN = process.env.FROZEN === "1";

const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");

export const loadSnapshot = cache(async <T>(name: string): Promise<T> => {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
});

/** Snapshot row shapes — mirror the DB projection used at write time. */
export type SnapshotScoreRow = {
  modelSlug: string;
  surface: string;
  overallScore: number;
  overallGrade: string;
  trend: string;
  dataQuality: string;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
  evaluatedDate: string | null;
  confidence: "high" | "medium" | "low";
  variance: number | null;
  isPartial: boolean;
  falseRefusalRate: number | null;
  netHelpfulness: number | null;
  benignRefusalCount: number | null;
  benignTotalCount: number | null;
  refusedBenignCaseIds: string[] | null;
};

export type SnapshotModel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  releaseDate: string | null;
  parameterCount: string | null;
  evalTier: string;
  isActive: boolean;
  createdAt: string;
  provider: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

export type SnapshotCategory = {
  id: string;
  name: string;
  label: string;
  description: string;
  question: string;
  icon: string | null;
  weight: number;
};

export type SnapshotTestCase = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  prompt: string;
  expectedBehavior: string;
  severity: string;
  description: string;
  ageBrackets: string[];
  modality: string;
  isActive: boolean;
};

export type SnapshotInsightsReport = {
  id: string;
  slug: string;
  status: string;
  generatedAt: string;
  dataThrough: string;
  aggregates: unknown;
  narrative: unknown;
  generatorModel: string;
};
